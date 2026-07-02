import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, glowCheckinsTable, type GlowCheckin } from "@workspace/db";
import { awardOncePerDay, awardStreakMilestone, POINTS } from "../lib/rewards";
import { userIdOf } from "../middlewares/auth";
import {
  UpsertGlowCheckinBody,
  UpsertGlowCheckinResponse,
  GetGlowSummaryResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function computeGlowScore(c: GlowCheckin): number {
  const water = Math.min(c.waterCups / 8, 1) * 15;
  const sleepHours = c.sleepHours;
  let sleep: number;
  if (sleepHours >= 7 && sleepHours <= 9) {
    sleep = 20;
  } else if (sleepHours < 7) {
    sleep = (sleepHours / 7) * 20;
  } else {
    sleep = Math.max(0, 1 - (sleepHours - 9) / 6) * 20;
  }
  const stress = ((5 - c.stressLevel) / 4) * 15;
  const activity = Math.min(c.activityMinutes / 30, 1) * 15;
  const protein = Math.min(c.proteinGrams / 100, 1) * 20;
  const skincare = c.skincareDone ? 15 : 0;
  return Math.round(water + sleep + stress + activity + protein + skincare);
}

function withScore(c: GlowCheckin) {
  return { ...c, score: computeGlowScore(c) };
}

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}

function computeStreak(dateSet: Set<string>): number {
  let streak = 0;
  const cursor = new Date();
  if (!dateSet.has(todayString())) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    if (!dateSet.has(`${y}-${m}-${d}`)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

router.get("/glow/summary", async (_req, res): Promise<void> => {
  const userId = userIdOf(res);
  const today = todayString();
  const rows = await db
    .select()
    .from(glowCheckinsTable)
    .where(eq(glowCheckinsTable.userId, userId))
    .orderBy(desc(glowCheckinsTable.date));

  const todayRow = rows.find((r) => r.date === today) ?? null;
  const streak = computeStreak(new Set(rows.map((r) => r.date)));

  const history = rows
    .slice(0, 14)
    .reverse()
    .map((r) => ({ date: r.date, score: computeGlowScore(r) }));

  res.json(
    GetGlowSummaryResponse.parse({
      today: todayRow ? withScore(todayRow) : null,
      streakDays: streak,
      history,
    }),
  );
});

router.put("/glow/checkin", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const body = UpsertGlowCheckinBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const { date, ...fields } = body.data;
  const targetDate = date ?? todayString();
  if (!isValidCalendarDate(targetDate)) {
    res.status(400).json({ error: "date must be a valid YYYY-MM-DD calendar date" });
    return;
  }

  const [row] = await db
    .insert(glowCheckinsTable)
    .values({ userId, date: targetDate, ...fields })
    .onConflictDoUpdate({
      target: [glowCheckinsTable.userId, glowCheckinsTable.date],
      set: fields,
    })
    .returning();

  await awardOncePerDay(
    userId,
    "glow_checkin",
    targetDate,
    POINTS.glowCheckin,
    "Daily Glow check-in",
  );

  const allRows = await db
    .select({ date: glowCheckinsTable.date })
    .from(glowCheckinsTable)
    .where(eq(glowCheckinsTable.userId, userId));
  const streak = computeStreak(new Set(allRows.map((r) => r.date)));
  for (let milestone = 7; milestone <= streak; milestone += 7) {
    await awardStreakMilestone(userId, milestone, todayString(), POINTS.streakBonus);
  }

  res.json(UpsertGlowCheckinResponse.parse(withScore(row)));
});

export default router;
