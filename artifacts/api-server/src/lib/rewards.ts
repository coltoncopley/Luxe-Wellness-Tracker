import { and, eq, sql, sum } from "drizzle-orm";
import { db, rewardEventsTable, redemptionsTable } from "@workspace/db";

export const REWARD_CATALOG = [
  {
    id: "b12-shot",
    title: "Free B12 Energy Shot",
    description: "A complimentary B12 injection at your next visit",
    points: 400,
  },
  {
    id: "ten-off",
    title: "$10 Off Any Service",
    description: "Take $10 off any treatment or service",
    points: 500,
  },
  {
    id: "dermaplane",
    title: "Free Dermaplaning Add-On",
    description: "Add dermaplaning to any facial, on us",
    points: 800,
  },
  {
    id: "twentyfive-off",
    title: "$25 Off Botox or Filler",
    description: "$25 off your next injectable appointment",
    points: 1200,
  },
] as const;

export type CatalogReward = (typeof REWARD_CATALOG)[number];

export const POINTS = {
  glowCheckin: 20,
  weightEntry: 10,
  foodLog: 5,
  streakBonus: 50,
} as const;

export const FOOD_LOG_DAILY_CAP = 3;

export async function getBalance(): Promise<number> {
  const [row] = await db
    .select({ total: sum(rewardEventsTable.points) })
    .from(rewardEventsTable);
  return Number(row?.total ?? 0);
}

export async function awardOncePerDay(
  type: string,
  date: string,
  points: number,
  description: string,
): Promise<void> {
  await db
    .insert(rewardEventsTable)
    .values({ type, date, points, description, dedupeKey: `${type}:${date}` })
    .onConflictDoNothing({ target: rewardEventsTable.dedupeKey });
}

export async function awardStreakMilestone(
  milestone: number,
  date: string,
  points: number,
): Promise<void> {
  await db
    .insert(rewardEventsTable)
    .values({
      type: "glow_streak",
      date,
      points,
      description: `${milestone}-day Glow streak bonus`,
      dedupeKey: `glow_streak:${milestone}`,
    })
    .onConflictDoNothing({ target: rewardEventsTable.dedupeKey });
}

export async function awardWithDailyCap(
  type: string,
  date: string,
  points: number,
  description: string,
  cap: number,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${type}:${date}`}))`);
    const existing = await tx
      .select({ id: rewardEventsTable.id })
      .from(rewardEventsTable)
      .where(and(eq(rewardEventsTable.type, type), eq(rewardEventsTable.date, date)));
    if (existing.length >= cap) return;
    await tx.insert(rewardEventsTable).values({ type, date, points, description });
  });
}

export async function redeemPoints(
  reward: CatalogReward,
  date: string,
  code: string,
): Promise<{ ok: true; balance: number } | { ok: false; balance: number }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('reward_redemption'))`);
    const [row] = await tx
      .select({ total: sum(rewardEventsTable.points) })
      .from(rewardEventsTable);
    const balance = Number(row?.total ?? 0);
    if (balance < reward.points) {
      return { ok: false as const, balance };
    }
    await tx.insert(rewardEventsTable).values({
      type: "redemption",
      date,
      points: -reward.points,
      description: `Redeemed: ${reward.title} (code ${code})`,
    });
    await tx.insert(redemptionsTable).values({
      code,
      rewardId: reward.id,
      title: reward.title,
      points: reward.points,
      date,
    });
    return { ok: true as const, balance: balance - reward.points };
  });
}
