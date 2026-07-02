import { randomBytes } from "node:crypto";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, rewardEventsTable, redemptionsTable, type Redemption } from "@workspace/db";
import {
  GetRewardsSummaryResponse,
  RedeemRewardBody,
  RedeemRewardResponse,
  LookupRedemptionResponse,
} from "@workspace/api-zod";
import { REWARD_CATALOG, getBalance, redeemPoints } from "../lib/rewards";

const router: IRouter = Router();

function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

router.get("/rewards/summary", async (_req, res): Promise<void> => {
  const events = await db
    .select()
    .from(rewardEventsTable)
    .orderBy(desc(rewardEventsTable.createdAt), desc(rewardEventsTable.id))
    .limit(50);

  const balance = await getBalance();
  const totalEarned = (
    await db.select().from(rewardEventsTable)
  ).reduce((acc, e) => (e.points > 0 ? acc + e.points : acc), 0);

  res.json(
    GetRewardsSummaryResponse.parse({
      balance,
      totalEarned,
      history: events,
      catalog: REWARD_CATALOG,
    }),
  );
});

router.post("/rewards/redeem", async (req, res): Promise<void> => {
  const body = RedeemRewardBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const reward = REWARD_CATALOG.find((r) => r.id === body.data.rewardId);
  if (!reward) {
    res.status(400).json({ error: "Unknown reward" });
    return;
  }
  let code = "";
  let result: Awaited<ReturnType<typeof redeemPoints>> | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    code = generateCode();
    try {
      result = await redeemPoints(reward, todayString(), code);
      break;
    } catch (err) {
      const isUniqueViolation =
        err && typeof err === "object" && "code" in err && err.code === "23505";
      if (!isUniqueViolation || attempt === 2) throw err;
    }
  }
  if (!result) {
    res.status(500).json({ error: "Could not generate a redemption code" });
    return;
  }
  if (!result.ok) {
    res.status(400).json({ error: "Not enough points for this reward" });
    return;
  }

  res.json(
    RedeemRewardResponse.parse({
      code,
      reward,
      balance: result.balance,
    }),
  );
});

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return `LUXE-${out.slice(0, 4)}-${out.slice(4)}`;
}

const lookupHits = new Map<string, { count: number; windowStart: number }>();
const LOOKUP_LIMIT = 15;
const LOOKUP_WINDOW_MS = 60_000;

function rateLimitLookups(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip ?? "unknown";
  const now = Date.now();
  const entry = lookupHits.get(key);
  if (!entry || now - entry.windowStart > LOOKUP_WINDOW_MS) {
    if (lookupHits.size > 1000) lookupHits.clear();
    lookupHits.set(key, { count: 1, windowStart: now });
    next();
    return;
  }
  entry.count += 1;
  if (entry.count > LOOKUP_LIMIT) {
    res.status(429).json({ error: "Too many attempts — try again in a minute" });
    return;
  }
  next();
}

function toDetail(row: Redemption) {
  return LookupRedemptionResponse.parse({
    code: row.code,
    rewardId: row.rewardId,
    title: row.title,
    points: row.points,
    date: row.date,
    usedAt: row.usedAt ? row.usedAt.toISOString() : null,
  });
}

function normalizeCode(raw: string): string {
  let cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.startsWith("LUXE")) cleaned = cleaned.slice(4);
  return `LUXE-${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}`;
}

router.get("/rewards/redemptions/:code", rateLimitLookups, async (req, res): Promise<void> => {
  const code = normalizeCode(String(req.params.code));
  const [row] = await db
    .select()
    .from(redemptionsTable)
    .where(eq(redemptionsTable.code, code));
  if (!row) {
    res.status(404).json({ error: "Code not found" });
    return;
  }
  res.json(toDetail(row));
});

router.post("/rewards/redemptions/:code/use", rateLimitLookups, async (req, res): Promise<void> => {
  const code = normalizeCode(String(req.params.code));
  const [updated] = await db
    .update(redemptionsTable)
    .set({ usedAt: sql`now()` })
    .where(and(eq(redemptionsTable.code, code), isNull(redemptionsTable.usedAt)))
    .returning();
  if (updated) {
    res.json(toDetail(updated));
    return;
  }
  const [existing] = await db
    .select()
    .from(redemptionsTable)
    .where(eq(redemptionsTable.code, code));
  if (!existing) {
    res.status(404).json({ error: "Code not found" });
    return;
  }
  res.status(409).json(toDetail(existing));
});

export default router;
