import { randomBytes } from "node:crypto";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, usersTable, referralsTable, rewardEventsTable } from "@workspace/db";
import { GetReferralSummaryResponse, ClaimReferralBody, ClaimReferralResponse } from "@workspace/api-zod";
import { POINTS } from "../lib/rewards";
import { userIdOf } from "../middlewares/auth";

const router: IRouter = Router();

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CLAIM_WINDOW_DAYS = 30;

function generateReferralCode(): string {
  const bytes = randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return code;
}

function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function ensureReferralCode(userId: string): Promise<string> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (user?.referralCode) return user.referralCode;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    try {
      const [updated] = await db
        .update(usersTable)
        .set({ referralCode: code })
        .where(and(eq(usersTable.id, userId), isNull(usersTable.referralCode)))
        .returning({ referralCode: usersTable.referralCode });
      if (updated?.referralCode) return updated.referralCode;
      // 0 rows updated — a concurrent request already set the code; read it back
      const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
      if (existing?.referralCode) return existing.referralCode;
    } catch {
      // unique collision — retry with a new code
    }
  }
  throw new Error("Could not generate a unique referral code");
}

const claimHits = new Map<string, { count: number; windowStart: number }>();
const CLAIM_LIMIT = 5;
const CLAIM_WINDOW_MS = 60_000;

function rateLimitClaims(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  const keys = [`ip:${req.ip ?? "unknown"}`, `user:${userIdOf(res)}`];
  for (const key of keys) {
    const entry = claimHits.get(key);
    if (!entry || now - entry.windowStart > CLAIM_WINDOW_MS) {
      if (claimHits.size > 2000) claimHits.clear();
      claimHits.set(key, { count: 1, windowStart: now });
      continue;
    }
    entry.count += 1;
    if (entry.count > CLAIM_LIMIT) {
      res.status(429).json({ error: "Too many attempts — try again in a minute" });
      return;
    }
  }
  next();
}

router.get("/referrals/summary", async (_req, res): Promise<void> => {
  const userId = userIdOf(res);
  const code = await ensureReferralCode(userId);

  const referrals = await db
    .select({ id: referralsTable.id })
    .from(referralsTable)
    .where(eq(referralsTable.referrerUserId, userId));

  const [earned] = await db
    .select({ total: sql<string>`coalesce(sum(${rewardEventsTable.points}), 0)` })
    .from(rewardEventsTable)
    .where(
      sql`${rewardEventsTable.userId} = ${userId} and ${rewardEventsTable.type} = 'referral'`,
    );

  res.json(
    GetReferralSummaryResponse.parse({
      code,
      invitedCount: referrals.length,
      pointsEarned: Number(earned?.total ?? 0),
      referrerPoints: POINTS.referralReferrer,
      friendPoints: POINTS.referralFriend,
    }),
  );
});

router.post("/referrals/claim", rateLimitClaims, async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const body = ClaimReferralBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const code = normalizeCode(body.data.code);

  function reply(claimed: boolean, pointsAwarded: number, reason: string | null) {
    res.json(ClaimReferralResponse.parse({ claimed, pointsAwarded, reason }));
  }

  if (!code) {
    reply(false, 0, "invalid_code");
    return;
  }

  const [referrer] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.referralCode, code));
  if (!referrer) {
    reply(false, 0, "invalid_code");
    return;
  }
  if (referrer.id === userId) {
    reply(false, 0, "own_code");
    return;
  }

  const [me] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!me) {
    reply(false, 0, "invalid_code");
    return;
  }
  const accountAgeMs = Date.now() - me.createdAt.getTime();
  if (accountAgeMs > CLAIM_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
    reply(false, 0, "not_new_user");
    return;
  }

  const date = todayString();
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`referral_claim:${userId}`}))`);
    const [existing] = await tx
      .select({ id: referralsTable.id })
      .from(referralsTable)
      .where(eq(referralsTable.referredUserId, userId));
    if (existing) return { claimed: false as const, reason: "already_claimed" };

    await tx.insert(referralsTable).values({
      referrerUserId: referrer.id,
      referredUserId: userId,
      code,
    });
    await tx
      .insert(rewardEventsTable)
      .values({
        userId: referrer.id,
        type: "referral",
        date,
        points: POINTS.referralReferrer,
        description: "Friend joined LUXE with your invite",
        dedupeKey: `referral:${userId}`,
      })
      .onConflictDoNothing({ target: [rewardEventsTable.userId, rewardEventsTable.dedupeKey] });
    await tx
      .insert(rewardEventsTable)
      .values({
        userId,
        type: "referral",
        date,
        points: POINTS.referralFriend,
        description: "Welcome bonus — joined with a friend's invite",
        dedupeKey: "referral_welcome",
      })
      .onConflictDoNothing({ target: [rewardEventsTable.userId, rewardEventsTable.dedupeKey] });
    return { claimed: true as const, reason: null };
  });

  if (result.claimed) {
    reply(true, POINTS.referralFriend, null);
  } else {
    reply(false, 0, result.reason);
  }
});

export default router;
