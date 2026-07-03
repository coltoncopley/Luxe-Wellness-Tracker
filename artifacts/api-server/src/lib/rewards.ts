import { and, asc, eq, sql, sum } from "drizzle-orm";
import {
  db,
  rewardEventsTable,
  redemptionsTable,
  rewardItemsTable,
  type RewardItem,
} from "@workspace/db";

export const POINTS = {
  glowCheckin: 20,
  weightEntry: 10,
  foodLog: 5,
  streakBonus: 50,
  referralReferrer: 100,
  referralFriend: 50,
  progressPhoto: 10,
  skinScan: 25,
  ingredientScan: 5,
  mindCheckin: 15,
  communityPost: 10,
  birthday: 100,
} as const;

export const INGREDIENT_SCAN_DAILY_CAP = 2;

export const FOOD_LOG_DAILY_CAP = 3;

export const TIERS = [
  { name: "Bronze", minPoints: 0 },
  { name: "Silver", minPoints: 500 },
  { name: "Gold", minPoints: 1500 },
  { name: "Platinum", minPoints: 3500 },
] as const;

export function getTierInfo(totalEarned: number): {
  name: string;
  minPoints: number;
  nextName: string | null;
  nextMinPoints: number | null;
} {
  let idx = 0;
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (totalEarned >= TIERS[i]!.minPoints) {
      idx = i;
      break;
    }
  }
  const next = TIERS[idx + 1] ?? null;
  return {
    name: TIERS[idx]!.name,
    minPoints: TIERS[idx]!.minPoints,
    nextName: next ? next.name : null,
    nextMinPoints: next ? next.minPoints : null,
  };
}

export async function getTotalEarned(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: sum(rewardEventsTable.points) })
    .from(rewardEventsTable)
    .where(and(eq(rewardEventsTable.userId, userId), sql`${rewardEventsTable.points} > 0`));
  return Number(row?.total ?? 0);
}

export async function getActiveCatalog(): Promise<RewardItem[]> {
  return db
    .select()
    .from(rewardItemsTable)
    .where(eq(rewardItemsTable.active, true))
    .orderBy(asc(rewardItemsTable.sortOrder), asc(rewardItemsTable.points));
}

export async function getBalance(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: sum(rewardEventsTable.points) })
    .from(rewardEventsTable)
    .where(eq(rewardEventsTable.userId, userId));
  return Number(row?.total ?? 0);
}

export async function awardOncePerDay(
  userId: string,
  type: string,
  date: string,
  points: number,
  description: string,
): Promise<void> {
  await db
    .insert(rewardEventsTable)
    .values({ userId, type, date, points, description, dedupeKey: `${type}:${date}` })
    .onConflictDoNothing({ target: [rewardEventsTable.userId, rewardEventsTable.dedupeKey] });
}

export async function awardStreakMilestone(
  userId: string,
  milestone: number,
  date: string,
  points: number,
): Promise<void> {
  await db
    .insert(rewardEventsTable)
    .values({
      userId,
      type: "glow_streak",
      date,
      points,
      description: `${milestone}-day Glow streak bonus`,
      dedupeKey: `glow_streak:${milestone}`,
    })
    .onConflictDoNothing({ target: [rewardEventsTable.userId, rewardEventsTable.dedupeKey] });
}

export async function awardWithDailyCap(
  userId: string,
  type: string,
  date: string,
  points: number,
  description: string,
  cap: number,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`${userId}:${type}:${date}`}))`,
    );
    const existing = await tx
      .select({ id: rewardEventsTable.id })
      .from(rewardEventsTable)
      .where(
        and(
          eq(rewardEventsTable.userId, userId),
          eq(rewardEventsTable.type, type),
          eq(rewardEventsTable.date, date),
        ),
      );
    if (existing.length >= cap) return;
    await tx.insert(rewardEventsTable).values({ userId, type, date, points, description });
  });
}

export async function redeemPoints(
  userId: string,
  reward: RewardItem,
  date: string,
  code: string,
): Promise<{ ok: true; balance: number } | { ok: false; balance: number }> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`reward_redemption:${userId}`}))`,
    );
    const [row] = await tx
      .select({ total: sum(rewardEventsTable.points) })
      .from(rewardEventsTable)
      .where(eq(rewardEventsTable.userId, userId));
    const balance = Number(row?.total ?? 0);
    if (balance < reward.points) {
      return { ok: false as const, balance };
    }
    await tx.insert(rewardEventsTable).values({
      userId,
      type: "redemption",
      date,
      points: -reward.points,
      description: `Redeemed: ${reward.title} (code ${code})`,
    });
    await tx.insert(redemptionsTable).values({
      userId,
      code,
      rewardId: String(reward.id),
      title: reward.title,
      points: reward.points,
      date,
    });
    return { ok: true as const, balance: balance - reward.points };
  });
}
