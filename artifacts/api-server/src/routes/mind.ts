import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, mindCheckinsTable, type MindCheckin } from "@workspace/db";
import { awardOncePerDay, POINTS } from "../lib/rewards";
import { userIdOf } from "../middlewares/auth";
import {
  UpsertMindCheckinBody,
  UpsertMindCheckinResponse,
  GetMindSummaryResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function computeCalmScore(c: MindCheckin): number {
  const mood = ((c.mood - 1) / 4) * 30;
  const energy = ((c.energy - 1) / 4) * 25;
  const stress = ((5 - c.stress) / 4) * 25;
  const anxiety = ((5 - c.anxiety) / 4) * 20;
  return Math.round(mood + energy + stress + anxiety);
}

function toResponse(c: MindCheckin) {
  return {
    date: c.date,
    mood: c.mood,
    energy: c.energy,
    stress: c.stress,
    anxiety: c.anxiety,
    gratitude: c.gratitude,
    journal: c.journal,
    score: computeCalmScore(c),
  };
}

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d
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

router.get("/mind/summary", async (_req, res): Promise<void> => {
  const userId = userIdOf(res);
  const today = todayString();
  const rows = await db
    .select()
    .from(mindCheckinsTable)
    .where(eq(mindCheckinsTable.userId, userId))
    .orderBy(desc(mindCheckinsTable.date));

  const todayRow = rows.find((r) => r.date === today) ?? null;
  const streak = computeStreak(new Set(rows.map((r) => r.date)));
  const history = rows
    .slice(0, 14)
    .reverse()
    .map((r) => ({ date: r.date, score: computeCalmScore(r) }));

  res.json(
    GetMindSummaryResponse.parse({
      today: todayRow ? toResponse(todayRow) : null,
      streakDays: streak,
      history,
    }),
  );
});

router.put("/mind/checkin", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const body = UpsertMindCheckinBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { date, gratitude, journal, ...scores } = body.data;
  if (![scores.mood, scores.energy, scores.stress, scores.anxiety].every(Number.isInteger)) {
    res.status(400).json({ error: "mood, energy, stress, and anxiety must be whole numbers 1-5" });
    return;
  }
  const targetDate = date ?? todayString();
  if (!isValidCalendarDate(targetDate)) {
    res.status(400).json({ error: "date must be a valid YYYY-MM-DD calendar date" });
    return;
  }

  const fields = {
    ...scores,
    gratitude: gratitude?.trim() || null,
    journal: journal?.trim() || null,
  };

  const [row] = await db
    .insert(mindCheckinsTable)
    .values({ userId, date: targetDate, ...fields })
    .onConflictDoUpdate({
      target: [mindCheckinsTable.userId, mindCheckinsTable.date],
      set: fields,
    })
    .returning();

  await awardOncePerDay(
    userId,
    "mind_checkin",
    targetDate,
    POINTS.mindCheckin,
    "Mind check-in",
  );

  res.json(UpsertMindCheckinResponse.parse(toResponse(row!)));
});

export default router;
