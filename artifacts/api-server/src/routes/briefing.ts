import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import {
  db,
  usersTable,
  glowCheckinsTable,
  foodLogsTable,
  weightEntriesTable,
  goalsTable,
  appointmentsTable,
  activitiesTable,
  sleepEntriesTable,
} from "@workspace/db";
import { GetBriefingResponse } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { userIdOf } from "../middlewares/auth";
import { computeGlowScore } from "./glow";

const router: IRouter = Router();

function dateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayString(): string {
  return dateString(new Date());
}

function yesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateString(d);
}

function computeStreak(dateSet: Set<string>): number {
  let streak = 0;
  const cursor = new Date();
  if (!dateSet.has(todayString())) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    const key = dateString(cursor);
    if (!dateSet.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// Per-user, per-day cache for the AI briefing text so we call the model at
// most once per user per day (in-memory; regenerating after restart is fine).
const briefingCache = new Map<string, { date: string; text: string | null }>();
const briefingInFlight = new Map<string, Promise<string | null>>();

const AI_TIMEOUT_MS = 8000;

interface BriefingStats {
  firstName: string | null;
  wellnessScore: number;
  glowScoreToday: number | null;
  glowStreakDays: number;
  caloriesToday: number;
  calorieTarget: number | null;
  currentWeightLbs: number | null;
  weightChangeLbs: number | null;
  goalWeightLbs: number | null;
  yesterdayCalories: number | null;
  yesterdayGlowScore: number | null;
  nextAppointmentLabel: string | null;
  yesterdayActiveMinutes: number | null;
  yesterdaySteps: number | null;
  lastNightSleepMin: number | null;
}

async function generateAiBriefing(stats: BriefingStats): Promise<string | null> {
  const facts: string[] = [];
  facts.push(`Wellness score today: ${stats.wellnessScore}/100`);
  if (stats.glowScoreToday != null) facts.push(`Glow score today: ${stats.glowScoreToday}/100`);
  if (stats.glowStreakDays > 0) facts.push(`Check-in streak: ${stats.glowStreakDays} days`);
  facts.push(`Calories logged today: ${stats.caloriesToday}`);
  if (stats.calorieTarget != null) facts.push(`Daily calorie target: ${stats.calorieTarget}`);
  if (stats.currentWeightLbs != null) facts.push(`Current weight: ${stats.currentWeightLbs} lbs`);
  if (stats.weightChangeLbs != null)
    facts.push(`Weight change since start: ${stats.weightChangeLbs} lbs`);
  if (stats.goalWeightLbs != null) facts.push(`Goal weight: ${stats.goalWeightLbs} lbs`);
  if (stats.yesterdayCalories != null)
    facts.push(`Yesterday's calories: ${stats.yesterdayCalories}`);
  if (stats.yesterdayGlowScore != null)
    facts.push(`Yesterday's glow score: ${stats.yesterdayGlowScore}/100`);
  if (stats.nextAppointmentLabel != null)
    facts.push(`Next appointment: ${stats.nextAppointmentLabel}`);
  if (stats.yesterdayActiveMinutes != null && stats.yesterdayActiveMinutes > 0)
    facts.push(`Yesterday's active minutes: ${stats.yesterdayActiveMinutes}`);
  if (stats.yesterdaySteps != null && stats.yesterdaySteps > 0)
    facts.push(`Yesterday's steps: ${stats.yesterdaySteps}`);
  if (stats.lastNightSleepMin != null) {
    const h = Math.floor(stats.lastNightSleepMin / 60);
    const m = stats.lastNightSleepMin % 60;
    facts.push(`Last night's sleep: ${h}h ${m}m`);
  }

  const completion = await Promise.race([
    openai.chat.completions.create({
      model: "gpt-5.4",
      messages: [
        {
          role: "system",
          content:
            "You write a short, warm morning briefing for a wellness app user. " +
            "2-3 sentences max. Encouraging, specific to their numbers, never medical advice, " +
            "no diagnoses, no medication guidance. Do not invent data not provided. " +
            "If there is little data, warmly encourage them to log their first entries today.",
        },
        {
          role: "user",
          content: `Write today's briefing${stats.firstName ? ` for ${stats.firstName}` : ""}.\n${facts.join("\n")}`,
        },
      ],
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("AI briefing timeout")), AI_TIMEOUT_MS),
    ),
  ]);
  const text = completion.choices[0]?.message?.content?.trim();
  return text && text.length > 0 ? text : null;
}

router.get("/briefing", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const today = todayString();
  const yesterday = yesterdayString();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  const glowRows = await db
    .select()
    .from(glowCheckinsTable)
    .where(eq(glowCheckinsTable.userId, userId))
    .orderBy(desc(glowCheckinsTable.date));
  const todayFood = await db
    .select()
    .from(foodLogsTable)
    .where(and(eq(foodLogsTable.userId, userId), eq(foodLogsTable.date, today)));
  const yesterdayFood = await db
    .select()
    .from(foodLogsTable)
    .where(and(eq(foodLogsTable.userId, userId), eq(foodLogsTable.date, yesterday)));
  const weightEntries = await db
    .select()
    .from(weightEntriesTable)
    .where(eq(weightEntriesTable.userId, userId))
    .orderBy(asc(weightEntriesTable.date));
  const [goal] = await db.select().from(goalsTable).where(eq(goalsTable.userId, userId));
  const upcoming = await db
    .select()
    .from(appointmentsTable)
    .where(and(eq(appointmentsTable.userId, userId), gte(appointmentsTable.date, today)))
    .orderBy(asc(appointmentsTable.date))
    .limit(5);
  const yesterdayActivities = await db
    .select()
    .from(activitiesTable)
    .where(and(eq(activitiesTable.userId, userId), eq(activitiesTable.date, yesterday)));
  const lastNightSleep = await db
    .select()
    .from(sleepEntriesTable)
    .where(and(eq(sleepEntriesTable.userId, userId), eq(sleepEntriesTable.date, today)))
    .orderBy(desc(sleepEntriesTable.id))
    .limit(1);

  const todayGlow = glowRows.find((r) => r.date === today) ?? null;
  const yesterdayGlow = glowRows.find((r) => r.date === yesterday) ?? null;
  const glowStreak = computeStreak(new Set(glowRows.map((r) => r.date)));
  const glowScoreToday = todayGlow ? computeGlowScore(todayGlow) : null;

  const caloriesToday = todayFood.reduce((sum, r) => sum + r.calories, 0);
  const weighedInToday = weightEntries.some((w) => w.date === today);
  const last = weightEntries.length > 0 ? weightEntries[weightEntries.length - 1] : null;
  const startWeight = goal?.startWeightLbs ?? weightEntries[0]?.weightLbs ?? null;
  const currentWeightLbs = last?.weightLbs ?? null;
  const weightChangeLbs =
    startWeight != null && currentWeightLbs != null
      ? Math.round((currentWeightLbs - startWeight) * 10) / 10
      : null;

  const nextAppointment = upcoming.find((a) => a.status !== "cancelled") ?? null;

  const yesterdayActiveMinutes = yesterdayActivities.reduce((s, a) => s + a.durationMin, 0);
  const yesterdaySteps = yesterdayActivities.reduce((s, a) => Math.max(s, a.steps ?? 0), 0);
  const lastNightSleepMin = lastNightSleep[0]?.durationMin ?? null;

  // --- Wellness score (0-100): habits today + consistency ---
  const habitPoints = glowScoreToday != null ? Math.round(glowScoreToday * 0.4) : 0; // 0-40
  const nutritionLogged = todayFood.length > 0 ? 10 : 0; // 0-10
  const withinTarget =
    todayFood.length > 0 &&
    (goal?.dailyCalorieTarget == null || caloriesToday <= goal.dailyCalorieTarget)
      ? 10
      : 0; // 0-10
  const weighInPoints = weighedInToday ? 15 : 0; // 0-15
  const consistency = Math.round((Math.min(glowStreak, 7) / 7) * 25); // 0-25
  const wellnessScore = habitPoints + nutritionLogged + withinTarget + weighInPoints + consistency;

  const components = [
    { key: "habits", label: "Today's habits (Glow)", points: habitPoints, maxPoints: 40 },
    { key: "nutrition", label: "Meals logged", points: nutritionLogged, maxPoints: 10 },
    { key: "target", label: "Within calorie target", points: withinTarget, maxPoints: 10 },
    { key: "weighin", label: "Weigh-in done", points: weighInPoints, maxPoints: 15 },
    { key: "consistency", label: "Check-in streak", points: consistency, maxPoints: 25 },
  ];

  const todos = [
    {
      id: "glow",
      label: "Complete your Glow check-in",
      done: todayGlow != null,
      href: "/glow",
    },
    { id: "meal", label: "Log a meal", done: todayFood.length > 0, href: "/food" },
    { id: "weighin", label: "Log today's weigh-in", done: weighedInToday, href: "/weight" },
    {
      id: "water",
      label: "Drink 8 cups of water",
      done: (todayGlow?.waterCups ?? 0) >= 8,
      href: "/glow",
    },
    {
      id: "skincare",
      label: "Do your skincare routine",
      done: todayGlow?.skincareDone ?? false,
      href: "/glow",
    },
  ];

  const yesterdaySummary = {
    calories: yesterdayFood.length > 0 ? yesterdayFood.reduce((s, r) => s + r.calories, 0) : null,
    calorieTarget: goal?.dailyCalorieTarget ?? null,
    proteinGrams:
      yesterdayFood.length > 0
        ? Math.round(yesterdayFood.reduce((s, r) => s + (r.proteinG ?? 0), 0))
        : null,
    weightChangeLbs,
    glowScore: yesterdayGlow ? computeGlowScore(yesterdayGlow) : null,
    foodLogged: yesterdayFood.length > 0,
  };

  // --- AI briefing (cached per user per day; never blocks the response on failure) ---
  let aiBriefing: string | null = null;
  const cached = briefingCache.get(userId);
  if (cached && cached.date === today) {
    aiBriefing = cached.text;
  } else {
    try {
      let pending = briefingInFlight.get(userId);
      if (!pending) {
        pending = generateAiBriefing({
          firstName: user?.firstName ?? null,
          wellnessScore,
          glowScoreToday,
          glowStreakDays: glowStreak,
          caloriesToday,
          calorieTarget: goal?.dailyCalorieTarget ?? null,
          currentWeightLbs,
          weightChangeLbs,
          goalWeightLbs: goal?.goalWeightLbs ?? null,
          yesterdayCalories: yesterdaySummary.calories,
          yesterdayGlowScore: yesterdaySummary.glowScore,
          nextAppointmentLabel: nextAppointment
            ? `${nextAppointment.serviceName} on ${nextAppointment.date}`
            : null,
          yesterdayActiveMinutes: yesterdayActiveMinutes > 0 ? yesterdayActiveMinutes : null,
          yesterdaySteps: yesterdaySteps > 0 ? yesterdaySteps : null,
          lastNightSleepMin,
        }).finally(() => {
          briefingInFlight.delete(userId);
        });
        briefingInFlight.set(userId, pending);
      }
      aiBriefing = await pending;
      briefingCache.set(userId, { date: today, text: aiBriefing });
    } catch (err) {
      req.log.warn({ err }, "AI briefing generation failed");
      aiBriefing = null;
    }
  }

  res.json(
    GetBriefingResponse.parse({
      firstName: user?.firstName ?? null,
      wellnessScore,
      components,
      todos,
      yesterday: yesterdaySummary,
      nextAppointment,
      aiBriefing,
    }),
  );
});

export default router;
