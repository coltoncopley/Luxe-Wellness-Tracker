import { Router, type IRouter } from "express";
import { and, desc, eq, gte } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  db,
  activitiesTable,
  sleepEntriesTable,
  deviceConnectionsTable,
  type Activity,
  type SleepEntry,
  type DeviceConnection,
} from "@workspace/db";
import { awardOncePerDay, POINTS } from "../lib/rewards";
import { userIdOf } from "../middlewares/auth";
import { validateOuraToken, syncOuraConnection, getOuraConnection, OuraApiError } from "../lib/oura";
import {
  ListActivitiesResponse,
  CreateActivityBody,
  CreateActivityResponse,
  ImportPhoneStepsBody,
  ImportPhoneStepsResponse,
  ListSleepEntriesResponse,
  CreateSleepEntryBody,
  CreateSleepEntryResponse,
  GetActivitySummaryResponse,
  ListDevicesResponse,
  ConnectOuraBody,
  ConnectOuraResponse,
  UpdateOuraSettingsBody,
  UpdateOuraSettingsResponse,
  SyncOuraResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateStringDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d;
}

// In-memory per-user rate limiter (resets on restart; acceptable for abuse damping)
function makeLimiter(max: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (userId: string): boolean => {
    const now = Date.now();
    const entry = hits.get(userId);
    if (!entry || now >= entry.resetAt) {
      hits.set(userId, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= max) return false;
    entry.count += 1;
    return true;
  };
}
const connectLimiter = makeLimiter(5, 60 * 60 * 1000);
const syncLimiter = makeLimiter(4, 60 * 60 * 1000);

function toActivityResponse(a: Activity) {
  return {
    id: a.id,
    date: a.date,
    type: a.type,
    durationMin: a.durationMin,
    steps: a.steps,
    calories: a.calories,
    distanceMi: a.distanceMi,
    notes: a.notes,
    source: a.source,
  };
}

function toSleepResponse(s: SleepEntry) {
  return {
    id: s.id,
    date: s.date,
    durationMin: s.durationMin,
    bedtime: s.bedtime,
    wakeTime: s.wakeTime,
    quality: s.quality,
    score: s.score,
    source: s.source,
  };
}

function toDeviceResponse(c: DeviceConnection) {
  return {
    provider: c.provider,
    tokenLast4: c.accessToken.slice(-4),
    importActivity: c.importActivity,
    importSleep: c.importSleep,
    lastSyncedAt: c.lastSyncedAt ? c.lastSyncedAt.toISOString() : null,
    lastSyncStatus: c.lastSyncStatus,
    connectedAt: c.createdAt.toISOString(),
  };
}

// ---------- Activities ----------

router.get("/activities", async (_req, res): Promise<void> => {
  const userId = userIdOf(res);
  const rows = await db
    .select()
    .from(activitiesTable)
    .where(and(eq(activitiesTable.userId, userId), gte(activitiesTable.date, dateStringDaysAgo(90))))
    .orderBy(desc(activitiesTable.date), desc(activitiesTable.id));
  res.json(ListActivitiesResponse.parse(rows.map(toActivityResponse)));
});

router.post("/activities", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const body = CreateActivityBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { date, type, durationMin, steps, calories, distanceMi, notes } = body.data;
  if (!isValidCalendarDate(date)) {
    res.status(400).json({ error: "date must be a valid YYYY-MM-DD calendar date" });
    return;
  }
  if (!Number.isInteger(durationMin)) {
    res.status(400).json({ error: "durationMin must be a whole number of minutes" });
    return;
  }
  const [row] = await db
    .insert(activitiesTable)
    .values({
      userId,
      date,
      type,
      durationMin,
      steps: steps ?? null,
      calories: calories ?? null,
      distanceMi: distanceMi ?? null,
      notes: notes?.trim() || null,
      source: "manual",
    })
    .returning();

  await awardOncePerDay(userId, "activity_log", date, POINTS.activityLog, "Activity logged");
  res.status(201).json(CreateActivityResponse.parse(toActivityResponse(row!)));
});

router.post("/activities/phone-steps", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const body = ImportPhoneStepsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  let imported = 0;
  for (const entry of body.data.entries) {
    if (!isValidCalendarDate(entry.date) || !Number.isInteger(entry.steps)) continue;
    await db
      .insert(activitiesTable)
      .values({
        userId,
        date: entry.date,
        type: "steps",
        durationMin: 0,
        steps: entry.steps,
        source: "phone",
        externalId: `phone:${entry.date}`,
      })
      .onConflictDoUpdate({
        target: [activitiesTable.userId, activitiesTable.source, activitiesTable.externalId],
        targetWhere: sql`external_id IS NOT NULL`,
        set: { steps: entry.steps },
      });
    imported += 1;
  }
  res.json(ImportPhoneStepsResponse.parse({ imported }));
});

router.delete("/activities/:id", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const deleted = await db
    .delete(activitiesTable)
    .where(
      and(
        eq(activitiesTable.id, id),
        eq(activitiesTable.userId, userId),
        eq(activitiesTable.source, "manual"),
      ),
    )
    .returning({ id: activitiesTable.id });
  if (deleted.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(204).end();
});

// ---------- Sleep ----------

router.get("/sleep-entries", async (_req, res): Promise<void> => {
  const userId = userIdOf(res);
  const rows = await db
    .select()
    .from(sleepEntriesTable)
    .where(
      and(eq(sleepEntriesTable.userId, userId), gte(sleepEntriesTable.date, dateStringDaysAgo(90))),
    )
    .orderBy(desc(sleepEntriesTable.date), desc(sleepEntriesTable.id));
  res.json(ListSleepEntriesResponse.parse(rows.map(toSleepResponse)));
});

router.post("/sleep-entries", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const body = CreateSleepEntryBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { date, durationMin, bedtime, wakeTime, quality } = body.data;
  if (!isValidCalendarDate(date)) {
    res.status(400).json({ error: "date must be a valid YYYY-MM-DD calendar date" });
    return;
  }
  if (!Number.isInteger(durationMin) || (quality != null && !Number.isInteger(quality))) {
    res.status(400).json({ error: "durationMin and quality must be whole numbers" });
    return;
  }
  const [row] = await db
    .insert(sleepEntriesTable)
    .values({
      userId,
      date,
      durationMin,
      bedtime: bedtime ?? null,
      wakeTime: wakeTime ?? null,
      quality: quality ?? null,
      source: "manual",
    })
    .returning();

  await awardOncePerDay(userId, "sleep_log", date, POINTS.sleepLog, "Sleep logged");
  res.status(201).json(CreateSleepEntryResponse.parse(toSleepResponse(row!)));
});

router.delete("/sleep-entries/:id", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const deleted = await db
    .delete(sleepEntriesTable)
    .where(
      and(
        eq(sleepEntriesTable.id, id),
        eq(sleepEntriesTable.userId, userId),
        eq(sleepEntriesTable.source, "manual"),
      ),
    )
    .returning({ id: sleepEntriesTable.id });
  if (deleted.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(204).end();
});

// ---------- Summary ----------

router.get("/activity/summary", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const days = req.query["days"] === "30" ? 30 : 7;
  const cutoff = dateStringDaysAgo(days - 1);

  const [activities, sleep, streakActivityDates, streakSleepDates] = await Promise.all([
    db
      .select()
      .from(activitiesTable)
      .where(and(eq(activitiesTable.userId, userId), gte(activitiesTable.date, cutoff))),
    db
      .select()
      .from(sleepEntriesTable)
      .where(and(eq(sleepEntriesTable.userId, userId), gte(sleepEntriesTable.date, cutoff))),
    db
      .selectDistinct({ date: activitiesTable.date })
      .from(activitiesTable)
      .where(
        and(eq(activitiesTable.userId, userId), gte(activitiesTable.date, dateStringDaysAgo(400))),
      ),
    db
      .selectDistinct({ date: sleepEntriesTable.date })
      .from(sleepEntriesTable)
      .where(
        and(
          eq(sleepEntriesTable.userId, userId),
          gte(sleepEntriesTable.date, dateStringDaysAgo(400)),
        ),
      ),
  ]);

  const byDate = new Map<string, { minutes: number; steps: number; sleepMin: number | null }>();
  for (let i = days - 1; i >= 0; i--) {
    byDate.set(dateStringDaysAgo(i), { minutes: 0, steps: 0, sleepMin: null });
  }
  let totalMinutes = 0;
  let totalSteps = 0;
  for (const a of activities) {
    const bucket = byDate.get(a.date);
    if (!bucket) continue;
    bucket.minutes += a.durationMin;
    bucket.steps += a.steps ?? 0;
    totalMinutes += a.durationMin;
    totalSteps += a.steps ?? 0;
  }
  const sleepByDate = new Map<string, number>();
  for (const s of sleep) {
    sleepByDate.set(s.date, Math.max(sleepByDate.get(s.date) ?? 0, s.durationMin));
  }
  let sleepSum = 0;
  for (const [date, mins] of sleepByDate) {
    const bucket = byDate.get(date);
    if (bucket) bucket.sleepMin = mins;
    sleepSum += mins;
  }
  const avgSleepMin = sleepByDate.size > 0 ? Math.round(sleepSum / sleepByDate.size) : null;

  const loggedDates = new Set<string>();
  for (const r of streakActivityDates) loggedDates.add(r.date);
  for (const r of streakSleepDates) loggedDates.add(r.date);
  let streak = 0;
  const cursor = new Date();
  if (!loggedDates.has(todayString())) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    if (!loggedDates.has(`${y}-${m}-${d}`)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  res.json(
    GetActivitySummaryResponse.parse({
      days,
      totalMinutes,
      totalSteps,
      activityCount: activities.length,
      avgSleepMin,
      streak,
      series: Array.from(byDate.entries()).map(([date, v]) => ({ date, ...v })),
    }),
  );
});

// ---------- Devices ----------

router.get("/devices", async (_req, res): Promise<void> => {
  const userId = userIdOf(res);
  const rows = await db
    .select()
    .from(deviceConnectionsTable)
    .where(eq(deviceConnectionsTable.userId, userId));
  res.json(ListDevicesResponse.parse({ devices: rows.map(toDeviceResponse) }));
});

router.post("/devices/oura", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  if (!connectLimiter(userId)) {
    res.status(429).json({ error: "Too many attempts — please try again later" });
    return;
  }
  const body = ConnectOuraBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const token = body.data.token.trim();
  if (token.length < 8) {
    res.status(400).json({ error: "That token looks too short" });
    return;
  }

  let valid: boolean;
  try {
    valid = await validateOuraToken(token);
  } catch (err) {
    req.log.warn({ err }, "Oura token validation failed (network)");
    res.status(400).json({ error: "Couldn't reach Oura to verify the token — try again" });
    return;
  }
  if (!valid) {
    res.status(400).json({ error: "Oura rejected that token — double-check it and try again" });
    return;
  }

  const [conn] = await db
    .insert(deviceConnectionsTable)
    .values({
      userId,
      provider: "oura",
      accessToken: token,
      importActivity: body.data.importActivity ?? true,
      importSleep: body.data.importSleep ?? true,
    })
    .onConflictDoUpdate({
      target: [deviceConnectionsTable.userId, deviceConnectionsTable.provider],
      set: {
        accessToken: token,
        importActivity: body.data.importActivity ?? true,
        importSleep: body.data.importSleep ?? true,
        lastSyncStatus: null,
      },
    })
    .returning();

  try {
    await syncOuraConnection(conn!);
  } catch (err) {
    req.log.warn({ err }, "Initial Oura sync failed after connect");
  }
  const fresh = await getOuraConnection(userId);
  res.json(ConnectOuraResponse.parse(toDeviceResponse(fresh ?? conn!)));
});

router.put("/devices/oura", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const body = UpdateOuraSettingsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [row] = await db
    .update(deviceConnectionsTable)
    .set({ importActivity: body.data.importActivity, importSleep: body.data.importSleep })
    .where(
      and(eq(deviceConnectionsTable.userId, userId), eq(deviceConnectionsTable.provider, "oura")),
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "No Oura connection" });
    return;
  }
  res.json(UpdateOuraSettingsResponse.parse(toDeviceResponse(row)));
});

router.delete("/devices/oura", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const removeData = req.query["removeData"] === "true";
  await db.transaction(async (tx) => {
    await tx
      .delete(deviceConnectionsTable)
      .where(
        and(
          eq(deviceConnectionsTable.userId, userId),
          eq(deviceConnectionsTable.provider, "oura"),
        ),
      );
    if (removeData) {
      await tx
        .delete(activitiesTable)
        .where(and(eq(activitiesTable.userId, userId), eq(activitiesTable.source, "oura")));
      await tx
        .delete(sleepEntriesTable)
        .where(and(eq(sleepEntriesTable.userId, userId), eq(sleepEntriesTable.source, "oura")));
    }
  });
  res.status(204).end();
});

router.post("/devices/oura/sync", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const conn = await getOuraConnection(userId);
  if (!conn) {
    res.status(404).json({ error: "No Oura connection" });
    return;
  }
  if (!syncLimiter(userId)) {
    res.status(429).json({ error: "Synced recently — please try again later" });
    return;
  }
  try {
    const result = await syncOuraConnection(conn);
    res.json(SyncOuraResponse.parse(result));
  } catch (err) {
    if (err instanceof OuraApiError && (err.status === 401 || err.status === 403)) {
      res
        .status(400)
        .json({ error: "Oura no longer accepts the saved token — reconnect with a new one" });
      return;
    }
    req.log.warn({ err }, "Manual Oura sync failed");
    res.status(400).json({ error: "Sync failed — please try again later" });
  }
});

export default router;
