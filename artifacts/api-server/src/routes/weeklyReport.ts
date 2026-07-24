import { Router, type IRouter } from "express";
import { and, asc, eq, gte, lte, lt, desc } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  foodLogsTable,
  weightEntriesTable,
  glowCheckinsTable,
  activitiesTable,
  weeklyReportsTable,
  type WeeklyReportContent,
} from "@workspace/db";
import { openrouter as openai } from "@workspace/integrations-openrouter-ai";
import { userIdOf } from "../middlewares/auth";
import { computeGlowScore } from "./glow";
import { todayET, addDays, weekOfET } from "../lib/dates";

const router: IRouter = Router();

const AI_TIMEOUT_MS = 12_000;

const AiReportSchema = z.object({
  summary: z.string().min(1).max(800),
  highlights: z.array(z.string().min(1).max(200)).max(3),
  focus: z.string().min(1).max(300),
});

const inFlight = new Map<string, Promise<WeeklyReportContent | null>>();

interface WeekStats {
  mealsLogged: number;
  avgCalories: number | null;
  weighIns: number;
  weightChangeLbs: number | null;
  glowCheckins: number;
  avgGlowScore: number | null;
  activeMinutes: number;
  steps: number;
}

async function computeWeekStats(
  userId: string,
  weekStart: string,
  weekEnd: string,
): Promise<WeekStats> {
  const [food, weights, prevWeight, glows, activities] = await Promise.all([
    db
      .select()
      .from(foodLogsTable)
      .where(
        and(
          eq(foodLogsTable.userId, userId),
          gte(foodLogsTable.date, weekStart),
          lte(foodLogsTable.date, weekEnd),
        ),
      ),
    db
      .select()
      .from(weightEntriesTable)
      .where(
        and(
          eq(weightEntriesTable.userId, userId),
          gte(weightEntriesTable.date, weekStart),
          lte(weightEntriesTable.date, weekEnd),
        ),
      )
      .orderBy(asc(weightEntriesTable.date), asc(weightEntriesTable.id)),
    db
      .select()
      .from(weightEntriesTable)
      .where(and(eq(weightEntriesTable.userId, userId), lt(weightEntriesTable.date, weekStart)))
      .orderBy(desc(weightEntriesTable.date), desc(weightEntriesTable.id))
      .limit(1),
    db
      .select()
      .from(glowCheckinsTable)
      .where(
        and(
          eq(glowCheckinsTable.userId, userId),
          gte(glowCheckinsTable.date, weekStart),
          lte(glowCheckinsTable.date, weekEnd),
        ),
      ),
    db
      .select()
      .from(activitiesTable)
      .where(
        and(
          eq(activitiesTable.userId, userId),
          gte(activitiesTable.date, weekStart),
          lte(activitiesTable.date, weekEnd),
        ),
      ),
  ]);

  const calorieDays = new Map<string, number>();
  for (const f of food) {
    calorieDays.set(f.date, (calorieDays.get(f.date) ?? 0) + f.calories);
  }
  const avgCalories =
    calorieDays.size > 0
      ? Math.round([...calorieDays.values()].reduce((a, b) => a + b, 0) / calorieDays.size)
      : null;

  // Change across the week: last weigh-in of the week vs the most recent
  // weigh-in before the week (or the first weigh-in of the week).
  const lastOfWeek = weights.length > 0 ? weights[weights.length - 1]! : null;
  const baseline = prevWeight[0] ?? weights[0] ?? null;
  const weightChangeLbs =
    lastOfWeek && baseline && !(weights.length === 1 && !prevWeight[0])
      ? Math.round((lastOfWeek.weightLbs - baseline.weightLbs) * 10) / 10
      : null;

  const glowScores = glows.map((g) => computeGlowScore(g));
  const avgGlowScore =
    glowScores.length > 0
      ? Math.round(glowScores.reduce((a, b) => a + b, 0) / glowScores.length)
      : null;

  // Steps are MAX per date across sources, then summed across days.
  const stepsByDate = new Map<string, number>();
  let activeMinutes = 0;
  for (const a of activities) {
    activeMinutes += a.durationMin;
    if (a.steps != null) {
      stepsByDate.set(a.date, Math.max(stepsByDate.get(a.date) ?? 0, a.steps));
    }
  }
  const steps = [...stepsByDate.values()].reduce((a, b) => a + b, 0);

  return {
    mealsLogged: food.length,
    avgCalories,
    weighIns: weights.length,
    weightChangeLbs,
    glowCheckins: glows.length,
    avgGlowScore,
    activeMinutes,
    steps,
  };
}

async function generateReport(stats: WeekStats): Promise<WeeklyReportContent | null> {
  const facts: string[] = [];
  facts.push(`Meals logged: ${stats.mealsLogged}`);
  if (stats.avgCalories != null) facts.push(`Average daily calories: ${stats.avgCalories}`);
  facts.push(`Weigh-ins: ${stats.weighIns}`);
  if (stats.weightChangeLbs != null)
    facts.push(
      `Weight change this week: ${stats.weightChangeLbs > 0 ? "+" : ""}${stats.weightChangeLbs} lbs`,
    );
  facts.push(`Glow check-ins: ${stats.glowCheckins}`);
  if (stats.avgGlowScore != null) facts.push(`Average glow score: ${stats.avgGlowScore}/100`);
  if (stats.activeMinutes > 0) facts.push(`Active minutes: ${stats.activeMinutes}`);
  if (stats.steps > 0) facts.push(`Total steps: ${stats.steps}`);

  const completion = await Promise.race([
    openai.chat.completions.create({
      model: "x-ai/grok-4.5",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You write a warm weekly progress recap for a wellness app user based only on the numbers provided. " +
            "Educational and encouraging only — never medical advice, no diagnoses, no medication or dosage guidance, " +
            "do not invent data not provided. If the week was light on logging, be kind and encouraging, never guilt-tripping. " +
            'Respond with JSON: {"summary": "2-4 sentences reviewing the week", ' +
            '"highlights": ["up to 3 short wins from the numbers"], ' +
            '"focus": "one gentle, practical suggestion for the coming week"}',
        },
        {
          role: "user",
          content: `Write this week's recap.\n${facts.join("\n")}`,
        },
      ],
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("weekly report timeout")), AI_TIMEOUT_MS),
    ),
  ]);

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return null;
  const parsed = AiReportSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) return null;
  return { ...parsed.data, stats };
}

router.get("/weekly-report", async (req, res): Promise<void> => {
  const userId = userIdOf(res);

  // Report covers the previous complete Mon-Sun week (ET).
  const { weekStart: currentWeekStart } = weekOfET(todayET());
  const weekStart = addDays(currentWeekStart, -7);
  const weekEnd = addDays(weekStart, 6);

  const [existing] = await db
    .select()
    .from(weeklyReportsTable)
    .where(and(eq(weeklyReportsTable.userId, userId), eq(weeklyReportsTable.weekStart, weekStart)));

  if (existing) {
    res.json({
      report: {
        weekStart,
        weekEnd,
        ...existing.content,
        generatedAt: existing.createdAt.toISOString(),
      },
    });
    return;
  }

  const stats = await computeWeekStats(userId, weekStart, weekEnd);
  const hasData =
    stats.mealsLogged > 0 ||
    stats.weighIns > 0 ||
    stats.glowCheckins > 0 ||
    stats.activeMinutes > 0 ||
    stats.steps > 0;

  if (!hasData) {
    res.json({ report: null });
    return;
  }

  let content: WeeklyReportContent | null = null;
  try {
    let pending = inFlight.get(userId);
    if (!pending) {
      pending = generateReport(stats).finally(() => inFlight.delete(userId));
      inFlight.set(userId, pending);
    }
    content = await pending;
  } catch (err) {
    req.log.warn({ err }, "Weekly report generation failed");
  }

  if (!content) {
    res.status(503).json({ error: "Your weekly report isn't ready yet. Please try again soon." });
    return;
  }

  const [row] = await db
    .insert(weeklyReportsTable)
    .values({ userId, weekStart, content })
    .onConflictDoNothing({
      target: [weeklyReportsTable.userId, weeklyReportsTable.weekStart],
    })
    .returning();

  const createdAt = row?.createdAt ?? new Date();
  res.json({
    report: { weekStart, weekEnd, ...content, generatedAt: createdAt.toISOString() },
  });
});

export default router;
