import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { getSubscriptionForCustomer, isSubscriptionActive } from "../lib/billing";

const POSITIVE_TTL_MS = 60_000;
const NEGATIVE_TTL_MS = 5_000;
const MAX_CACHE_SIZE = 5_000;

const cache = new Map<string, { ok: boolean; expiresAt: number }>();

function membershipRequired(res: Response): void {
  res.status(402).json({
    error: "An active LUXE membership is required",
    code: "membership_required",
  });
}

/**
 * Gate for premium patient features: requires an active or trialing membership
 * subscription. Staff accounts are exempt. Must run after requireAuth.
 */
export async function requireActiveSubscription(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = res.locals.userId as string | undefined;
  if (!userId) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    if (cached.ok) {
      next();
      return;
    }
    membershipRequired(res);
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }

    let ok = false;
    if (user.role === "staff" || user.role === "admin") {
      ok = true;
    } else if (user.compLifetime || (user.compUntil && user.compUntil > new Date())) {
      // Complimentary access granted by staff
      ok = true;
    } else if (user.stripeCustomerId) {
      const sub = await getSubscriptionForCustomer(user.stripeCustomerId);
      ok = isSubscriptionActive(sub);
    }

    if (cache.size > MAX_CACHE_SIZE) cache.clear();
    cache.set(userId, {
      ok,
      expiresAt: Date.now() + (ok ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS),
    });

    if (ok) {
      next();
      return;
    }
    membershipRequired(res);
  } catch (err) {
    next(err);
  }
}

/** Clears the cached membership check for a user (e.g. right after checkout). */
export function clearSubscriptionCache(userId: string): void {
  cache.delete(userId);
}
