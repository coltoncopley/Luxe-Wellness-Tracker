import { sql } from "drizzle-orm";
import { eq, and } from "drizzle-orm";
import {
  db,
  activitiesTable,
  sleepEntriesTable,
  deviceConnectionsTable,
  type DeviceConnection,
} from "@workspace/db";
import { z } from "zod/v4";
import { logger } from "./logger";

const OURA_BASE = "https://api.ouraring.com/v2/usercollection";
const OURA_TIMEOUT_MS = 8000;
const SYNC_WINDOW_DAYS = 14;

export class OuraApiError extends Error {
  constructor(readonly status: number) {
    super(`Oura API responded with status ${status}`);
    this.name = "OuraApiError";
  }
}

async function ouraGet(
  path: string,
  token: string,
  params?: Record<string, string>,
): Promise<unknown> {
  const url = new URL(`${OURA_BASE}/${path}`);
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(OURA_TIMEOUT_MS),
  });
  if (!res.ok) throw new OuraApiError(res.status);
  return res.json();
}

export async function validateOuraToken(token: string): Promise<boolean> {
  try {
    await ouraGet("personal_info", token);
    return true;
  } catch (err) {
    if (err instanceof OuraApiError && (err.status === 401 || err.status === 403)) return false;
    throw err;
  }
}

const dailyActivitySchema = z.object({
  data: z.array(
    z.looseObject({
      day: z.string(),
      steps: z.number().nullish(),
      active_calories: z.number().nullish(),
    }),
  ),
});

const sleepSessionSchema = z.object({
  data: z.array(
    z.looseObject({
      id: z.string(),
      day: z.string(),
      type: z.string().nullish(),
      total_sleep_duration: z.number().nullish(),
      bedtime_start: z.string().nullish(),
      bedtime_end: z.string().nullish(),
    }),
  ),
});

const dailySleepSchema = z.object({
  data: z.array(
    z.looseObject({
      day: z.string(),
      score: z.number().nullish(),
    }),
  ),
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hhmmFromIso(iso: string | null | undefined): string | null {
  if (!iso || iso.length < 16) return null;
  const hhmm = iso.slice(11, 16);
  return /^\d{2}:\d{2}$/.test(hhmm) ? hhmm : null;
}

export async function syncOuraConnection(
  conn: DeviceConnection,
): Promise<{ activitiesImported: number; sleepImported: number }> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - SYNC_WINDOW_DAYS);
  const range = { start_date: toDateString(start), end_date: toDateString(end) };

  let activitiesImported = 0;
  let sleepImported = 0;

  try {
    if (conn.importActivity) {
      const parsed = dailyActivitySchema.parse(
        await ouraGet("daily_activity", conn.accessToken, range),
      );
      for (const day of parsed.data) {
        if (!DATE_RE.test(day.day)) continue;
        const steps = typeof day.steps === "number" ? clampInt(day.steps, 0, 200000) : null;
        const calories =
          typeof day.active_calories === "number" ? clampInt(day.active_calories, 0, 10000) : null;
        if (steps === null && calories === null) continue;
        await db
          .insert(activitiesTable)
          .values({
            userId: conn.userId,
            date: day.day,
            type: "steps",
            durationMin: 0,
            steps,
            calories,
            source: "oura",
            externalId: `oura:activity:${day.day}`,
          })
          .onConflictDoUpdate({
            target: [activitiesTable.userId, activitiesTable.source, activitiesTable.externalId],
            targetWhere: sql`external_id IS NOT NULL`,
            set: { steps, calories },
          });
        activitiesImported += 1;
      }
    }

    if (conn.importSleep) {
      const [sessions, dailyScores] = await Promise.all([
        ouraGet("sleep", conn.accessToken, range).then((r) => sleepSessionSchema.parse(r)),
        ouraGet("daily_sleep", conn.accessToken, range).then((r) => dailySleepSchema.parse(r)),
      ]);
      const scoreByDay = new Map<string, number>();
      for (const d of dailyScores.data) {
        if (DATE_RE.test(d.day) && typeof d.score === "number") {
          scoreByDay.set(d.day, clampInt(d.score, 0, 100));
        }
      }
      for (const s of sessions.data) {
        if (s.type && s.type !== "long_sleep") continue;
        if (!DATE_RE.test(s.day)) continue;
        if (typeof s.total_sleep_duration !== "number" || s.total_sleep_duration <= 0) continue;
        const durationMin = clampInt(s.total_sleep_duration / 60, 1, 1440);
        const values = {
          date: s.day,
          durationMin,
          bedtime: hhmmFromIso(s.bedtime_start),
          wakeTime: hhmmFromIso(s.bedtime_end),
          score: scoreByDay.get(s.day) ?? null,
        };
        await db
          .insert(sleepEntriesTable)
          .values({
            userId: conn.userId,
            ...values,
            source: "oura",
            externalId: `oura:sleep:${s.id}`,
          })
          .onConflictDoUpdate({
            target: [
              sleepEntriesTable.userId,
              sleepEntriesTable.source,
              sleepEntriesTable.externalId,
            ],
            targetWhere: sql`external_id IS NOT NULL`,
            set: values,
          });
        sleepImported += 1;
      }
    }

    await db
      .update(deviceConnectionsTable)
      .set({ lastSyncedAt: new Date(), lastSyncStatus: "ok" })
      .where(eq(deviceConnectionsTable.id, conn.id));
  } catch (err) {
    await db
      .update(deviceConnectionsTable)
      .set({ lastSyncedAt: new Date(), lastSyncStatus: "error" })
      .where(eq(deviceConnectionsTable.id, conn.id))
      .catch(() => undefined);
    throw err;
  }

  return { activitiesImported, sleepImported };
}

export async function getOuraConnection(userId: string): Promise<DeviceConnection | null> {
  const [row] = await db
    .select()
    .from(deviceConnectionsTable)
    .where(
      and(eq(deviceConnectionsTable.userId, userId), eq(deviceConnectionsTable.provider, "oura")),
    );
  return row ?? null;
}

export async function syncAllOuraConnections(): Promise<void> {
  const conns = await db
    .select()
    .from(deviceConnectionsTable)
    .where(eq(deviceConnectionsTable.provider, "oura"));
  for (const conn of conns) {
    try {
      await syncOuraConnection(conn);
    } catch (err) {
      logger.warn({ err, connectionId: conn.id }, "Nightly Oura sync failed for a connection");
    }
  }
  if (conns.length > 0) {
    logger.info({ count: conns.length }, "Nightly Oura sync pass complete");
  }
}
