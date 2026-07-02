import { Router, type IRouter } from "express";
import { eq, and, asc, desc, gte } from "drizzle-orm";
import {
  db,
  tipsTable,
  weightEntriesTable,
  foodLogsTable,
  goalsTable,
  appointmentsTable,
} from "@workspace/db";
import {
  ListTipsQueryParams,
  ListTipsResponse,
  GetDailyTipResponse,
  GetDashboardSummaryResponse,
} from "@workspace/api-zod";
import { requireAuth, userIdOf } from "../middlewares/auth";
import { requireActiveSubscription } from "../middlewares/subscription";

const router: IRouter = Router();

function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

router.get("/tips", async (req, res): Promise<void> => {
  const query = ListTipsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const rows = query.data.category
    ? await db.select().from(tipsTable).where(eq(tipsTable.category, query.data.category)).orderBy(asc(tipsTable.id))
    : await db.select().from(tipsTable).orderBy(asc(tipsTable.id));
  res.json(ListTipsResponse.parse(rows));
});

router.get("/tips/daily", async (_req, res): Promise<void> => {
  const rows = await db.select().from(tipsTable).orderBy(asc(tipsTable.id));
  if (rows.length === 0) {
    res.status(404).json({ error: "No tips available" });
    return;
  }
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
  );
  const tip = rows[dayOfYear % rows.length];
  res.json(GetDailyTipResponse.parse(tip));
});

router.get("/dashboard/summary", requireAuth, requireActiveSubscription, async (_req, res): Promise<void> => {
  const userId = userIdOf(res);
  const today = todayString();

  const entries = await db
    .select()
    .from(weightEntriesTable)
    .where(eq(weightEntriesTable.userId, userId))
    .orderBy(asc(weightEntriesTable.date));
  const [goal] = await db.select().from(goalsTable).where(eq(goalsTable.userId, userId));
  const todayLogs = await db
    .select()
    .from(foodLogsTable)
    .where(and(eq(foodLogsTable.userId, userId), eq(foodLogsTable.date, today)));
  const upcoming = await db
    .select()
    .from(appointmentsTable)
    .where(and(eq(appointmentsTable.userId, userId), gte(appointmentsTable.date, today)))
    .orderBy(asc(appointmentsTable.date))
    .limit(5);

  const nextAppointment = upcoming.find((a) => a.status !== "cancelled") ?? null;

  const last = entries.length > 0 ? entries[entries.length - 1] : null;
  const start = goal?.startWeightLbs ?? (entries[0]?.weightLbs ?? null);
  const currentWeightLbs = last?.weightLbs ?? null;
  let weightChangeLbs: number | null = null;
  if (start != null && currentWeightLbs != null) {
    weightChangeLbs = Math.round((currentWeightLbs - start) * 10) / 10;
  }

  const caloriesToday = todayLogs.reduce((sum, r) => sum + r.calories, 0);

  // logging streak: consecutive days (ending today or yesterday) with at least one food log
  const logDates = await db
    .selectDistinct({ date: foodLogsTable.date })
    .from(foodLogsTable)
    .where(eq(foodLogsTable.userId, userId))
    .orderBy(desc(foodLogsTable.date));
  const dateSet = new Set(logDates.map((r) => r.date));
  let streak = 0;
  const cursor = new Date();
  if (!dateSet.has(todayString())) {
    cursor.setDate(cursor.getDate() - 1);
  }
  for (;;) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    if (!dateSet.has(`${y}-${m}-${d}`)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  res.json(
    GetDashboardSummaryResponse.parse({
      currentWeightLbs,
      weightChangeLbs,
      goalWeightLbs: goal?.goalWeightLbs ?? null,
      caloriesToday,
      calorieTarget: goal?.dailyCalorieTarget ?? null,
      loggingStreakDays: streak,
      nextAppointment,
    }),
  );
});

export default router;
