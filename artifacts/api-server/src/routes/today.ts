import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  glowCheckinsTable,
  foodLogsTable,
  weightEntriesTable,
  goalsTable,
  mindCheckinsTable,
  activitiesTable,
  routineCheckinsTable,
  rewardEventsTable,
} from "@workspace/db";
import { GetTodayResponse, CompleteTodayResponse } from "@workspace/api-zod";
import { userIdOf } from "../middlewares/auth";
import { POINTS, getBalance, getActiveCatalog } from "../lib/rewards";
import { todayET, addDays } from "../lib/dates";

const router: IRouter = Router();

export type DailyActionKey =
  | "weigh_in"
  | "log_meal"
  | "glow_checkin"
  | "mind_checkin"
  | "move"
  | "skincare";

const ACTION_LABELS: Record<DailyActionKey, string> = {
  weigh_in: "Log your weigh-in",
  log_meal: "Log a meal",
  glow_checkin: "Glow check-in",
  mind_checkin: "Mind check-in",
  move: "Move your body",
  skincare: "Skincare routine",
};

const FOCUS_COPY: Record<DailyActionKey, { title: string; message: string }> = {
  weigh_in: {
    title: "Step on the scale",
    message: "A quick weigh-in keeps your trend honest — ten seconds and it's done.",
  },
  log_meal: {
    title: "Log your next meal",
    message: "Snap it or search it — logged meals keep your day on track and earn points.",
  },
  glow_checkin: {
    title: "Do your Glow check-in",
    message: "Water, sleep, stress, movement — thirty seconds to keep your streak alive.",
  },
  mind_checkin: {
    title: "Take a mind moment",
    message: "Check in with your mood and energy. It's private — just for you.",
  },
  move: {
    title: "Get moving",
    message: "Even ten minutes counts. Log any movement to keep your momentum.",
  },
  skincare: {
    title: "Skincare time",
    message: "Check off your routine — consistent beats intense every time.",
  },
};

/** Recommended daily actions per primary goal (mirrored in both client wizards). */
export const GOAL_ACTIONS: Record<string, DailyActionKey[]> = {
  weight_nutrition: ["weigh_in", "log_meal", "glow_checkin"],
  better_skin: ["skincare", "glow_checkin", "log_meal"],
  daily_wellness: ["glow_checkin", "mind_checkin", "move"],
  hormone_education: ["glow_checkin", "weigh_in", "mind_checkin"],
  maintain_results: ["weigh_in", "glow_checkin", "move"],
};

const DEFAULT_ACTIONS: DailyActionKey[] = ["glow_checkin", "log_meal", "weigh_in"];

const ALL_KEYS = new Set<string>(Object.keys(ACTION_LABELS));

function selectedActions(user: {
  dailyActions: string[] | null;
  primaryGoal: string | null;
}): DailyActionKey[] {
  const chosen = (user.dailyActions ?? []).filter((k): k is DailyActionKey => ALL_KEYS.has(k));
  if (chosen.length > 0) return chosen;
  if (user.primaryGoal && GOAL_ACTIONS[user.primaryGoal]) return GOAL_ACTIONS[user.primaryGoal]!;
  return DEFAULT_ACTIONS;
}

/**
 * Recompute done-ness for every daily action key straight from the underlying
 * tables. This is the single source of truth for both GET /today and the
 * completion award — the client can never self-attest.
 */
async function computeDoneMap(userId: string, today: string): Promise<Record<DailyActionKey, boolean>> {
  const [weight, food, glow, mind, activity, routine] = await Promise.all([
    db
      .select({ id: weightEntriesTable.id })
      .from(weightEntriesTable)
      .where(and(eq(weightEntriesTable.userId, userId), eq(weightEntriesTable.date, today)))
      .limit(1),
    db
      .select({ id: foodLogsTable.id })
      .from(foodLogsTable)
      .where(and(eq(foodLogsTable.userId, userId), eq(foodLogsTable.date, today)))
      .limit(1),
    db
      .select()
      .from(glowCheckinsTable)
      .where(and(eq(glowCheckinsTable.userId, userId), eq(glowCheckinsTable.date, today)))
      .limit(1),
    db
      .select({ id: mindCheckinsTable.id })
      .from(mindCheckinsTable)
      .where(and(eq(mindCheckinsTable.userId, userId), eq(mindCheckinsTable.date, today)))
      .limit(1),
    db
      .select({ id: activitiesTable.id })
      .from(activitiesTable)
      .where(and(eq(activitiesTable.userId, userId), eq(activitiesTable.date, today)))
      .limit(1),
    db
      .select()
      .from(routineCheckinsTable)
      .where(and(eq(routineCheckinsTable.userId, userId), eq(routineCheckinsTable.date, today)))
      .limit(1),
  ]);
  const glowRow = glow[0];
  const routineRow = routine[0];
  return {
    weigh_in: weight.length > 0,
    log_meal: food.length > 0,
    glow_checkin: glowRow !== undefined,
    mind_checkin: mind.length > 0,
    move: activity.length > 0 || (glowRow?.activityMinutes ?? 0) > 0,
    skincare: (routineRow?.amDone ?? false) || (routineRow?.pmDone ?? false) || (glowRow?.skincareDone ?? false),
  };
}

function computeStreakET(dates: Set<string>, today: string): number {
  let streak = 0;
  let cursor = dates.has(today) ? today : addDays(today, -1);
  while (dates.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

router.get("/today", async (_req, res): Promise<void> => {
  const userId = userIdOf(res);
  const today = todayET();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  const actions = selectedActions(user);
  const [doneMap, balance, catalog, glowDates, weightRows, goalRows, weekEvents, claimed] =
    await Promise.all([
      computeDoneMap(userId, today),
      getBalance(userId),
      getActiveCatalog(),
      db
        .select({ date: glowCheckinsTable.date })
        .from(glowCheckinsTable)
        .where(eq(glowCheckinsTable.userId, userId)),
      db
        .select()
        .from(weightEntriesTable)
        .where(eq(weightEntriesTable.userId, userId))
        .orderBy(asc(weightEntriesTable.date)),
      db.select().from(goalsTable).where(eq(goalsTable.userId, userId)),
      db
        .select({ total: sql<number>`coalesce(sum(${rewardEventsTable.points}), 0)` })
        .from(rewardEventsTable)
        .where(
          and(
            eq(rewardEventsTable.userId, userId),
            gte(rewardEventsTable.date, addDays(today, -6)),
            sql`${rewardEventsTable.points} > 0`,
          ),
        ),
      db
        .select({ id: rewardEventsTable.id })
        .from(rewardEventsTable)
        .where(
          and(
            eq(rewardEventsTable.userId, userId),
            eq(rewardEventsTable.dedupeKey, `daily_loop:${today}`),
          ),
        )
        .limit(1),
    ]);

  const checkins = actions.map((key) => ({ key, label: ACTION_LABELS[key], done: doneMap[key] }));
  const allDone = checkins.every((c) => c.done);
  const completedToday = claimed.length > 0;

  // Focus: first undone selected action; when everything is done, celebrate.
  const firstUndone = actions.find((key) => !doneMap[key]);
  const focus = firstUndone
    ? { ...FOCUS_COPY[firstUndone], actionKey: firstUndone }
    : {
        title: "You're all wrapped for today",
        message: completedToday
          ? "Every daily action is done and your points are in. See you tomorrow."
          : "Every daily action is done — claim your daily points below.",
        actionKey: null,
      };

  // Next reward: the cheapest catalog item the balance doesn't cover yet.
  const nextItem = catalog
    .slice()
    .sort((a, b) => a.points - b.points)
    .find((item) => item.points > balance);
  const nextReward = nextItem
    ? { title: nextItem.title, points: nextItem.points, pointsAway: nextItem.points - balance }
    : null;

  // Trend: one encouraging, deterministic line (first match wins).
  let trend: string | null = null;
  const streak = computeStreakET(new Set(glowDates.map((r) => r.date)), today);
  const goal = goalRows[0];
  const first = weightRows[0];
  const last = weightRows[weightRows.length - 1];
  const startWeight = goal?.startWeightLbs ?? first?.weightLbs ?? null;
  const change =
    startWeight != null && last != null
      ? Math.round((last.weightLbs - startWeight) * 10) / 10
      : null;
  const weekPoints = Number(weekEvents[0]?.total ?? 0);
  if (streak >= 2) {
    trend = `You're on a ${streak}-day check-in streak.`;
  } else if (change != null && change <= -1) {
    trend = `Down ${Math.abs(change)} lbs since you started.`;
  } else if (weekPoints > 0) {
    trend = `You've earned ${weekPoints} points in the last 7 days.`;
  }

  res.json(
    GetTodayResponse.parse({
      focus,
      checkins,
      allDone,
      completedToday,
      completePoints: POINTS.dailyLoop,
      points: balance,
      nextReward,
      trend,
    }),
  );
});

router.post("/today/complete", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const today = todayET();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  // Server-side recompute — the client cannot claim what the data doesn't show.
  const actions = selectedActions(user);
  const doneMap = await computeDoneMap(userId, today);
  const allDone = actions.every((key) => doneMap[key]);
  if (!allDone) {
    res.status(409).json({ error: "Finish today's actions first" });
    return;
  }

  const inserted = await db
    .insert(rewardEventsTable)
    .values({
      userId,
      type: "daily_loop",
      date: today,
      points: POINTS.dailyLoop,
      description: "Completed your daily loop",
      dedupeKey: `daily_loop:${today}`,
    })
    .onConflictDoNothing({ target: [rewardEventsTable.userId, rewardEventsTable.dedupeKey] })
    .returning({ id: rewardEventsTable.id });

  const awarded = inserted.length > 0;
  if (awarded) req.log.info({ userId, date: today }, "daily loop completed");
  const balance = await getBalance(userId);
  res.json(CompleteTodayResponse.parse({ awarded, points: balance }));
});

export default router;
