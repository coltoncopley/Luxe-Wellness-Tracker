import { Router, type IRouter } from "express";
import { and, count, eq, gte, inArray, isNotNull, lte, sum } from "drizzle-orm";
import {
  db,
  challengesTable,
  challengeParticipantsTable,
  rewardEventsTable,
  foodLogsTable,
  weightEntriesTable,
  glowCheckinsTable,
  mindCheckinsTable,
  activitiesTable,
  type Challenge,
} from "@workspace/db";
import { userIdOf } from "../middlewares/auth";
import { todayET, monthOfET, addMonths, monthRange } from "../lib/dates";

const router: IRouter = Router();

/**
 * Monthly challenge templates, rotated so every month gets a different focus.
 * All progress is computed from the user's OWN logs; only aggregate
 * participant/completion counts are ever shared.
 */
const TEMPLATES = [
  {
    key: "show_up",
    title: "The Show-Up Challenge",
    description: "Log anything — a meal, weigh-in, glow or mind check-in, or a workout — on 20 different days this month.",
    metric: "log_days",
    target: 20,
    points: 150,
  },
  {
    key: "mindful_meals",
    title: "Mindful Meals",
    description: "Log 40 meals or snacks this month and stay aware of what's on your plate.",
    metric: "meals",
    target: 40,
    points: 150,
  },
  {
    key: "glow_getter",
    title: "Glow Getter",
    description: "Complete 15 glow check-ins this month and watch your skin habits add up.",
    metric: "glow_checkins",
    target: 15,
    points: 150,
  },
  {
    key: "stay_accountable",
    title: "Stay Accountable",
    description: "Step on the scale and log 12 weigh-ins this month — trends beat single numbers.",
    metric: "weigh_ins",
    target: 12,
    points: 150,
  },
  {
    key: "move_more",
    title: "Move More",
    description: "Log 600 active minutes this month — walks, workouts, anything that moves you.",
    metric: "active_minutes",
    target: 600,
    points: 150,
  },
] as const;

function templateForMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return TEMPLATES[(y! * 12 + (m! - 1)) % TEMPLATES.length]!;
}

/** Make sure the challenge rows for the given months exist (insert-once). */
async function ensureChallenges(months: string[]): Promise<void> {
  await db
    .insert(challengesTable)
    .values(months.map((month) => ({ month, ...templateForMonth(month) })))
    .onConflictDoNothing({ target: [challengesTable.month, challengesTable.key] });
}

async function computeProgress(userId: string, challenge: Challenge): Promise<number> {
  const { start, end } = monthRange(challenge.month);
  switch (challenge.metric) {
    case "meals": {
      const [row] = await db
        .select({ n: count() })
        .from(foodLogsTable)
        .where(
          and(
            eq(foodLogsTable.userId, userId),
            gte(foodLogsTable.date, start),
            lte(foodLogsTable.date, end),
          ),
        );
      return Number(row?.n ?? 0);
    }
    case "glow_checkins": {
      const [row] = await db
        .select({ n: count() })
        .from(glowCheckinsTable)
        .where(
          and(
            eq(glowCheckinsTable.userId, userId),
            gte(glowCheckinsTable.date, start),
            lte(glowCheckinsTable.date, end),
          ),
        );
      return Number(row?.n ?? 0);
    }
    case "weigh_ins": {
      const [row] = await db
        .select({ n: count() })
        .from(weightEntriesTable)
        .where(
          and(
            eq(weightEntriesTable.userId, userId),
            gte(weightEntriesTable.date, start),
            lte(weightEntriesTable.date, end),
          ),
        );
      return Number(row?.n ?? 0);
    }
    case "active_minutes": {
      const [row] = await db
        .select({ total: sum(activitiesTable.durationMin) })
        .from(activitiesTable)
        .where(
          and(
            eq(activitiesTable.userId, userId),
            gte(activitiesTable.date, start),
            lte(activitiesTable.date, end),
          ),
        );
      return Number(row?.total ?? 0);
    }
    case "log_days": {
      const [food, weight, glow, mind, activity] = await Promise.all([
        db
          .selectDistinct({ date: foodLogsTable.date })
          .from(foodLogsTable)
          .where(
            and(
              eq(foodLogsTable.userId, userId),
              gte(foodLogsTable.date, start),
              lte(foodLogsTable.date, end),
            ),
          ),
        db
          .selectDistinct({ date: weightEntriesTable.date })
          .from(weightEntriesTable)
          .where(
            and(
              eq(weightEntriesTable.userId, userId),
              gte(weightEntriesTable.date, start),
              lte(weightEntriesTable.date, end),
            ),
          ),
        db
          .selectDistinct({ date: glowCheckinsTable.date })
          .from(glowCheckinsTable)
          .where(
            and(
              eq(glowCheckinsTable.userId, userId),
              gte(glowCheckinsTable.date, start),
              lte(glowCheckinsTable.date, end),
            ),
          ),
        db
          .selectDistinct({ date: mindCheckinsTable.date })
          .from(mindCheckinsTable)
          .where(
            and(
              eq(mindCheckinsTable.userId, userId),
              gte(mindCheckinsTable.date, start),
              lte(mindCheckinsTable.date, end),
            ),
          ),
        db
          .selectDistinct({ date: activitiesTable.date })
          .from(activitiesTable)
          .where(
            and(
              eq(activitiesTable.userId, userId),
              gte(activitiesTable.date, start),
              lte(activitiesTable.date, end),
            ),
          ),
      ]);
      const dates = new Set<string>();
      for (const rows of [food, weight, glow, mind, activity]) {
        for (const r of rows) dates.add(r.date);
      }
      return dates.size;
    }
    default:
      return 0;
  }
}

/** Award completion once-ever and stamp completedAt (idempotent). */
async function markCompleted(userId: string, challenge: Challenge): Promise<void> {
  await db
    .update(challengeParticipantsTable)
    .set({ completedAt: new Date() })
    .where(
      and(
        eq(challengeParticipantsTable.challengeId, challenge.id),
        eq(challengeParticipantsTable.userId, userId),
      ),
    );
  await db
    .insert(rewardEventsTable)
    .values({
      userId,
      type: "challenge",
      date: todayET(),
      points: challenge.points,
      description: `Completed community challenge: ${challenge.title}`,
      dedupeKey: `challenge:${challenge.key}:${challenge.month}`,
    })
    .onConflictDoNothing({
      target: [rewardEventsTable.userId, rewardEventsTable.dedupeKey],
    });
}

interface ChallengeView {
  id: number;
  month: string;
  title: string;
  description: string;
  metric: string;
  target: number;
  points: number;
  endsOn: string;
  joined: boolean;
  progress: number;
  completed: boolean;
  participantCount: number;
  completedCount: number;
}

async function buildViews(userId: string, challenges: Challenge[]): Promise<ChallengeView[]> {
  const ids = challenges.map((c) => c.id);
  const [countRows, myRows] = await Promise.all([
    ids.length
      ? db
          .select({
            challengeId: challengeParticipantsTable.challengeId,
            total: count(),
          })
          .from(challengeParticipantsTable)
          .where(inArray(challengeParticipantsTable.challengeId, ids))
          .groupBy(challengeParticipantsTable.challengeId)
      : [],
    ids.length
      ? db
          .select()
          .from(challengeParticipantsTable)
          .where(
            and(
              inArray(challengeParticipantsTable.challengeId, ids),
              eq(challengeParticipantsTable.userId, userId),
            ),
          )
      : [],
  ]);
  const completedRows = ids.length
    ? await db
        .select({
          challengeId: challengeParticipantsTable.challengeId,
          total: count(),
        })
        .from(challengeParticipantsTable)
        .where(
          and(
            inArray(challengeParticipantsTable.challengeId, ids),
            isNotNull(challengeParticipantsTable.completedAt),
          ),
        )
        .groupBy(challengeParticipantsTable.challengeId)
    : [];

  const totals = new Map(countRows.map((r) => [r.challengeId, Number(r.total)]));
  const completedTotals = new Map(completedRows.map((r) => [r.challengeId, Number(r.total)]));
  const mine = new Map(myRows.map((r) => [r.challengeId, r]));
  const currentMonth = monthOfET();

  const views: ChallengeView[] = [];
  for (const c of challenges) {
    const participant = mine.get(c.id) ?? null;
    const joined = participant !== null;
    // Progress only matters for months the user can still act in (or just finished).
    let progress = 0;
    let completed = participant?.completedAt != null;
    if (joined && c.month <= currentMonth) {
      progress = await computeProgress(userId, c);
      if (!completed && progress >= c.target && c.month >= addMonths(currentMonth, -1)) {
        await markCompleted(userId, c);
        completed = true;
      }
    }
    views.push({
      id: c.id,
      month: c.month,
      title: c.title,
      description: c.description,
      metric: c.metric,
      target: c.target,
      points: c.points,
      endsOn: monthRange(c.month).end,
      joined,
      progress: Math.min(progress, c.target),
      completed,
      participantCount: totals.get(c.id) ?? 0,
      completedCount: completedTotals.get(c.id) ?? 0,
    });
  }
  return views;
}

router.get("/community/challenges", async (_req, res): Promise<void> => {
  const userId = userIdOf(res);
  const currentMonth = monthOfET();
  const months = [addMonths(currentMonth, -1), currentMonth, addMonths(currentMonth, 1)];
  await ensureChallenges([currentMonth, addMonths(currentMonth, 1)]);

  const challenges = await db
    .select()
    .from(challengesTable)
    .where(inArray(challengesTable.month, months));
  challenges.sort((a, b) => a.month.localeCompare(b.month));

  const views = await buildViews(userId, challenges);
  // Show last month only if the user joined it (so a fresh completion is visible).
  res.json({
    challenges: views.filter((v) => v.month >= currentMonth || v.joined),
  });
});

router.post("/community/challenges/:id/join", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const challengeId = Number(req.params.id);
  if (!Number.isInteger(challengeId)) {
    res.status(404).json({ error: "Challenge not found" });
    return;
  }
  const [challenge] = await db
    .select()
    .from(challengesTable)
    .where(eq(challengesTable.id, challengeId));
  if (!challenge || challenge.month !== monthOfET()) {
    res.status(404).json({ error: "Challenge not found or no longer joinable" });
    return;
  }

  await db
    .insert(challengeParticipantsTable)
    .values({ challengeId: challenge.id, userId })
    .onConflictDoNothing({
      target: [challengeParticipantsTable.challengeId, challengeParticipantsTable.userId],
    });

  const [view] = await buildViews(userId, [challenge]);
  res.json({ challenge: view });
});

export default router;
