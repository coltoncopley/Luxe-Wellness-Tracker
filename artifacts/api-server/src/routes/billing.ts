import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, membershipCodesTable } from "@workspace/db";
import {
  GetBillingStatusResponse,
  CreateBillingCheckoutResponse,
  CreateBillingPortalResponse,
  RedeemMembershipCodeBody,
  RedeemMembershipCodeResponse,
} from "@workspace/api-zod";
import { getUncachableStripeClient } from "../lib/stripeClient";
import {
  MEMBERSHIP_PRICE_CENTS,
  TRIAL_DAYS,
  getMembershipPriceId,
  getSubscriptionForCustomer,
  pastDueGraceUntil,
} from "../lib/billing";
import { clearSubscriptionCache } from "../middlewares/subscription";

const router: IRouter = Router();

/** Users with a checkout session creation currently in flight. */
const checkoutInFlight = new Set<string>();

function appBaseUrl(): string {
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (!domain) throw new Error("REPLIT_DOMAINS is not set");
  return `https://${domain}`;
}

type BillingStatusValue = "none" | "trialing" | "active" | "past_due" | "canceled" | "incomplete";

function mapStatus(stripeStatus: string): BillingStatusValue {
  switch (stripeStatus) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "incomplete":
      return "incomplete";
    default:
      return "canceled";
  }
}

router.get("/billing/status", async (_req, res, next): Promise<void> => {
  try {
    const userId = res.locals.userId as string;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }

    const hasComp =
      user.compLifetime || (user.compUntil !== null && user.compUntil > new Date());
    if (user.role === "staff" || user.role === "admin" || hasComp) {
      res.json(
        GetBillingStatusResponse.parse({
          status: "none",
          exempt: true,
          priceCents: MEMBERSHIP_PRICE_CENTS,
          trialEndsAt: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        }),
      );
      return;
    }

    let status: BillingStatusValue = "none";
    let trialEndsAt: string | null = null;
    let currentPeriodEnd: string | null = null;
    let cancelAtPeriodEnd = false;
    let graceUntil: string | null = null;

    if (user.stripeCustomerId) {
      const sub = await getSubscriptionForCustomer(user.stripeCustomerId);
      if (sub) {
        status = mapStatus(sub.status);
        trialEndsAt = sub.trialEnd?.toISOString() ?? null;
        currentPeriodEnd = sub.currentPeriodEnd?.toISOString() ?? null;
        cancelAtPeriodEnd = sub.cancelAtPeriodEnd;
        graceUntil = pastDueGraceUntil(sub)?.toISOString() ?? null;
        if (user.stripeSubscriptionId !== sub.id) {
          await db
            .update(usersTable)
            .set({ stripeSubscriptionId: sub.id })
            .where(eq(usersTable.id, userId));
        }
        if (status === "trialing" || status === "active") {
          clearSubscriptionCache(userId);
        }
      }
    }

    res.json(
      GetBillingStatusResponse.parse({
        status,
        exempt: false,
        priceCents: MEMBERSHIP_PRICE_CENTS,
        trialEndsAt,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        graceUntil,
      }),
    );
  } catch (err) {
    next(err);
  }
});

router.post("/billing/checkout", async (req, res, next): Promise<void> => {
  try {
    const userId = res.locals.userId as string;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }
    if (user.role === "staff" || user.role === "admin") {
      res.status(400).json({ error: "Staff accounts do not need a membership" });
      return;
    }
    if (user.compLifetime || (user.compUntil !== null && user.compUntil > new Date())) {
      res.status(400).json({ error: "You already have free access — no membership needed" });
      return;
    }

    // Per-user lock: prevent concurrent requests from creating duplicate sessions.
    if (checkoutInFlight.has(userId)) {
      res.status(429).json({ error: "Checkout already in progress" });
      return;
    }
    checkoutInFlight.add(userId);
    try {
      const stripe = await getUncachableStripeClient();

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email ?? undefined,
          name: user.firstName ?? undefined,
          metadata: { userId },
        });
        customerId = customer.id;
        await db
          .update(usersTable)
          .set({ stripeCustomerId: customerId })
          .where(eq(usersTable.id, userId));
      }

      // Query Stripe directly (not the sync mirror, which lags behind webhooks)
      // for both the already-active check and trial eligibility.
      const liveSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 100,
      });
      const hasLiveActive = liveSubs.data.some(
        (s) => s.status === "trialing" || s.status === "active",
      );
      if (hasLiveActive) {
        res.status(409).json({ error: "You already have an active membership" });
        return;
      }
      // Only brand-new members get the free trial; returning members resubscribe directly.
      const hadSubscriptionBefore =
        liveSubs.data.length > 0 || user.stripeSubscriptionId !== null;

      const priceId = await getMembershipPriceId();
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        ...(hadSubscriptionBefore
          ? {}
          : { subscription_data: { trial_period_days: TRIAL_DAYS } }),
        success_url: `${appBaseUrl()}/?billing=success`,
        cancel_url: `${appBaseUrl()}/?billing=canceled`,
        allow_promotion_codes: true,
      });

      if (!session.url) {
        req.log.error({ sessionId: session.id }, "Stripe checkout session has no URL");
        res.status(502).json({ error: "Could not start checkout" });
        return;
      }

      clearSubscriptionCache(userId);
      res.json(CreateBillingCheckoutResponse.parse({ url: session.url }));
    } finally {
      checkoutInFlight.delete(userId);
    }
  } catch (err) {
    next(err);
  }
});

// ---- One-time membership access code redemption ----

const redeemHits = new Map<string, { count: number; windowStart: number }>();
const REDEEM_LIMIT = 5;
const REDEEM_WINDOW_MS = 60_000;

function rateLimitRedeem(req: Request, res: Response, next: NextFunction): void {
  const key = `${req.ip ?? "unknown"}:${(res.locals.userId as string | undefined) ?? ""}`;
  const now = Date.now();
  const entry = redeemHits.get(key);
  if (!entry || now - entry.windowStart > REDEEM_WINDOW_MS) {
    if (redeemHits.size > 1000) redeemHits.clear();
    redeemHits.set(key, { count: 1, windowStart: now });
    next();
    return;
  }
  entry.count += 1;
  if (entry.count > REDEEM_LIMIT) {
    res.status(429).json({ error: "Too many attempts — try again in a minute" });
    return;
  }
  next();
}

/** Add months to a date, clamping the day-of-month to the target month's last day. */
function addMonthsClamped(from: Date, months: number): Date {
  const d = new Date(from);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

const INVALID_CODE_ERROR = "That code is not valid or has already been used";

router.post("/billing/redeem-code", rateLimitRedeem, async (req, res, next): Promise<void> => {
  try {
    const userId = res.locals.userId as string;
    const body = RedeemMembershipCodeBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: INVALID_CODE_ERROR });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }
    if (user.role === "staff" || user.role === "admin") {
      res.status(400).json({ error: "Staff accounts do not need a membership" });
      return;
    }
    if (user.compLifetime || (user.compUntil !== null && user.compUntil > new Date())) {
      res.status(400).json({ error: "You already have free access — no code needed" });
      return;
    }

    const submitted = body.data.code.trim().toUpperCase();

    const result = await db.transaction(async (tx) => {
      const [code] = await tx
        .select()
        .from(membershipCodesTable)
        .where(eq(membershipCodesTable.code, submitted))
        .for("update");
      if (!code || code.revokedAt || code.redeemedBy) return null;

      // Lock the user row and re-check eligibility inside the transaction so
      // two concurrent redemptions by the same user cannot both succeed.
      const [lockedUser] = await tx
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .for("update");
      if (
        !lockedUser ||
        lockedUser.compLifetime ||
        (lockedUser.compUntil !== null && lockedUser.compUntil > new Date())
      ) {
        return "already_free" as const;
      }

      const accessUntil = code.kind === "six_month" ? addMonthsClamped(new Date(), 6) : null;
      await tx
        .update(membershipCodesTable)
        .set({ redeemedBy: userId, redeemedAt: new Date(), accessUntil })
        .where(eq(membershipCodesTable.id, code.id));

      // Write the full comp state so it always reflects exactly this code's
      // grant; compSource records which code granted it so revoke can undo it.
      await tx
        .update(usersTable)
        .set(
          code.kind === "unlimited"
            ? { compLifetime: true, compUntil: null, compSource: `code:${code.id}` }
            : { compLifetime: false, compUntil: accessUntil, compSource: `code:${code.id}` },
        )
        .where(eq(usersTable.id, userId));
      return { kind: code.kind, accessUntil };
    });

    if (result === "already_free") {
      res.status(400).json({ error: "You already have free access — no code needed" });
      return;
    }
    if (!result) {
      res.status(400).json({ error: INVALID_CODE_ERROR });
      return;
    }

    clearSubscriptionCache(userId);
    req.log.info({ userId, kind: result.kind }, "membership code redeemed");
    res.json(
      RedeemMembershipCodeResponse.parse({
        kind: result.kind,
        accessUntil: result.accessUntil ? result.accessUntil.toISOString() : null,
      }),
    );
  } catch (err) {
    next(err);
  }
});

router.post("/billing/portal", async (_req, res, next): Promise<void> => {
  try {
    const userId = res.locals.userId as string;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user?.stripeCustomerId) {
      res.status(400).json({ error: "No billing account yet" });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appBaseUrl()}/`,
    });

    res.json(CreateBillingPortalResponse.parse({ url: session.url }));
  } catch (err) {
    next(err);
  }
});

export default router;
