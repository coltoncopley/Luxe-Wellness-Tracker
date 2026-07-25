import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  foodLogsTable,
  weightEntriesTable,
  glowCheckinsTable,
  mindCheckinsTable,
  activitiesTable,
  rewardEventsTable,
  workoutsTable,
} from "@workspace/db";
import { GetStreakResponse } from "@workspace/api-zod";
import { userIdOf } from "../middlewares/auth";
import { todayET, addDays } from "../lib/dates";

const router: IRouter = Router();

/** Once-ever streak milestones (dedupe `streak:<days>` survives streak resets). */
const MILESTONES = [
  { days: 7, points: 50 },
  { days: 14, points: 75 },
  { days: 30, points: 150 },
  { days: 60, points: 300 },
  { days: 100, points: 500 },
] as const;

/** Distinct YYYY-MM-DD dates on which the user logged any qualifying activity. */
async function activeDates(userId: string): Promise<Set<string>> {
  const [food, weight, glow, mind, activity, workouts] = await Promise.all([
    db
      .selectDistinct({ date: foodLogsTable.date })
      .from(foodLogsTable)
      .where(eq(foodLogsTable.userId, userId)),
    db
      .selectDistinct({ date: weightEntriesTable.date })
      .from(weightEntriesTable)
      .where(eq(weightEntriesTable.userId, userId)),
    db
      .selectDistinct({ date: glowCheckinsTable.date })
      .from(glowCheckinsTable)
      .where(eq(glowCheckinsTable.userId, userId)),
    db
      .selectDistinct({ date: mindCheckinsTable.date })
      .from(mindCheckinsTable)
      .where(eq(mindCheckinsTable.userId, userId)),
    db
      .selectDistinct({ date: activitiesTable.date })
      .from(activitiesTable)
      .where(eq(activitiesTable.userId, userId)),
    db
      .selectDistinct({ date: workoutsTable.date })
      .from(workoutsTable)
      .where(and(eq(workoutsTable.userId, userId), eq(workoutsTable.status, "completed"))),
  ]);
  const dates = new Set<string>();
  for (const rows of [food, weight, glow, mind, activity, workouts]) {
    for (const r of rows) dates.add(r.date);
  }
  return dates;
}

function currentStreak(dates: Set<string>, today: string): number {
  let cursor = dates.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function longestStreak(dates: Set<string>): number {
  const sorted = [...dates].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev !== null && d === addDays(prev, 1) ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = d;
  }
  return longest;
}

router.get("/streak", async (_req, res): Promise<void> => {
  const userId = userIdOf(res);
  const today = todayET();
  const dates = await activeDates(userId);
  const current = currentStreak(dates, today);
  const longest = Math.max(longestStreak(dates), current);

  // Award reached milestones once-ever (append-only ledger, dedupe key).
  for (const m of MILESTONES) {
    if (current < m.days) break;
    await db
      .insert(rewardEventsTable)
      .values({
        userId,
        type: "streak",
        date: today,
        points: m.points,
        description: `${m.days}-day wellness streak bonus`,
        dedupeKey: `streak:${m.days}`,
      })
      .onConflictDoNothing({
        target: [rewardEventsTable.userId, rewardEventsTable.dedupeKey],
      });
  }

  const milestones = MILESTONES.map((m) => ({
    days: m.days,
    points: m.points,
    achieved: current >= m.days,
  }));
  const next = MILESTONES.find((m) => current < m.days) ?? null;

  res.json(
    GetStreakResponse.parse({
      current,
      longest,
      todayCounted: dates.has(today),
      milestones,
      nextMilestone: next ? { days: next.days, points: next.points } : null,
    }),
  );
});

export default router;
