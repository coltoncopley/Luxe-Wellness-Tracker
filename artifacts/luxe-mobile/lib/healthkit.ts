import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import type {
  AppleHealthImportInput,
  AppleHealthImportInputActivitiesItem,
  AppleHealthImportInputActivitiesItemType,
  AppleHealthImportInputSleepItem,
} from "@workspace/api-client-react";

// This module is the ONLY place that touches @kingstinct/react-native-healthkit.
// The native package initializes Nitro HybridObjects at import time, which throws
// in Expo Go and does not exist on web/Android. We therefore NEVER import it at
// the top level — it is loaded lazily via a guarded dynamic import so an
// unsupported environment degrades to an honest "not available" state instead of
// crashing the screen.

type HKModule = typeof import("@kingstinct/react-native-healthkit");

export type HealthAvailability = "available" | "unavailable-build" | "unsupported-platform";

export type CollectResult =
  | { ok: true; payload: AppleHealthImportInput }
  | { ok: false; reason: HealthAvailability | "error" };

const LAST_SYNC_KEY = "luxe.appleHealth.lastSyncedAt";
const WINDOW_DAYS = 14;

const READ_TYPES = [
  "HKQuantityTypeIdentifierStepCount",
  "HKWorkoutTypeIdentifier",
  "HKCategoryTypeIdentifierSleepAnalysis",
] as const;

let cached: HKModule | null = null;
let loadFailed = false;

async function loadHealthKit(): Promise<HKModule | null> {
  if (cached) return cached;
  if (loadFailed) return null;
  if (Platform.OS !== "ios") {
    loadFailed = true;
    return null;
  }
  try {
    cached = await import("@kingstinct/react-native-healthkit");
    return cached;
  } catch {
    loadFailed = true;
    return null;
  }
}

export async function getHealthAvailability(): Promise<HealthAvailability> {
  if (Platform.OS !== "ios") return "unsupported-platform";
  const hk = await loadHealthKit();
  if (!hk) return "unavailable-build";
  try {
    return hk.isHealthDataAvailable() ? "available" : "unavailable-build";
  } catch {
    return "unavailable-build";
  }
}

export async function collectAppleHealth(): Promise<CollectResult> {
  if (Platform.OS !== "ios") return { ok: false, reason: "unsupported-platform" };
  const hk = await loadHealthKit();
  if (!hk) return { ok: false, reason: "unavailable-build" };

  try {
    if (!hk.isHealthDataAvailable()) return { ok: false, reason: "unavailable-build" };

    await hk.requestAuthorization({ toRead: [...READ_TYPES] });

    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - (WINDOW_DAYS - 1));
    start.setHours(0, 0, 0, 0);

    const activities: AppleHealthImportInputActivitiesItem[] = [];

    try {
      const stats = await hk.queryStatisticsCollectionForQuantity(
        "HKQuantityTypeIdentifierStepCount",
        ["cumulativeSum"],
        new Date(start),
        { day: 1 },
        { unit: "count", filter: { date: { startDate: start, endDate: now } } },
      );
      for (const bucket of stats) {
        const q = bucket.sumQuantity?.quantity;
        if (bucket.startDate && typeof q === "number" && q > 0) {
          const date = toDateStr(bucket.startDate);
          activities.push({
            date,
            type: "steps",
            durationMin: 0,
            steps: clampInt(q, 0, 200000),
            externalId: `apple:steps:${date}`,
          });
        }
      }
    } catch {
      // Steps unavailable or not authorized — continue with other data.
    }

    try {
      const workouts = await hk.queryWorkoutSamples({
        filter: { date: { startDate: start, endDate: now } },
        limit: 0,
        ascending: true,
      });
      for (const w of workouts) {
        if (!w.uuid) continue;
        const durationMin = clampInt(
          (w.endDate.getTime() - w.startDate.getTime()) / 60000,
          0,
          1440,
        );
        if (durationMin < 1) continue;
        activities.push({
          date: toDateStr(w.startDate),
          type: mapWorkoutType(w.workoutActivityType),
          durationMin,
          calories: energyToKcal(w.totalEnergyBurned),
          distanceMi: distanceToMiles(w.totalDistance),
          externalId: `apple:workout:${w.uuid}`,
        });
      }
    } catch {
      // Workouts unavailable or not authorized — continue.
    }

    const sleep: AppleHealthImportInputSleepItem[] = [];
    try {
      const samples = await hk.queryCategorySamples("HKCategoryTypeIdentifierSleepAnalysis", {
        limit: 0,
        ascending: true,
        filter: { date: { startDate: start, endDate: now } },
      });
      // Group asleep segments by the day they end (wake day). Multiple sources
      // (iPhone + Watch) can record overlapping samples for one night, so we
      // merge overlapping intervals before summing instead of adding raw
      // durations — otherwise a night would be double-counted.
      const byDay = new Map<string, { start: number; end: number }[]>();
      for (const s of samples) {
        // CategoryValueSleepAnalysis: 1 asleep(Unspecified), 3 core, 4 deep, 5 REM.
        // Exclude 0 inBed and 2 awake.
        const v = s.value as number;
        if (v !== 1 && v !== 3 && v !== 4 && v !== 5) continue;
        const start = s.startDate.getTime();
        const end = s.endDate.getTime();
        if (!(end > start)) continue;
        const day = toDateStr(s.endDate);
        const list = byDay.get(day);
        if (list) list.push({ start, end });
        else byDay.set(day, [{ start, end }]);
      }
      for (const [day, intervals] of byDay) {
        intervals.sort((a, b) => a.start - b.start);
        let mergedMs = 0;
        let curStart: number | null = null;
        let curEnd = 0;
        let first = Number.POSITIVE_INFINITY;
        let last = 0;
        for (const iv of intervals) {
          if (iv.start < first) first = iv.start;
          if (iv.end > last) last = iv.end;
          if (curStart === null) {
            curStart = iv.start;
            curEnd = iv.end;
          } else if (iv.start <= curEnd) {
            if (iv.end > curEnd) curEnd = iv.end;
          } else {
            mergedMs += curEnd - curStart;
            curStart = iv.start;
            curEnd = iv.end;
          }
        }
        if (curStart === null) continue;
        mergedMs += curEnd - curStart;
        const durationMin = clampInt(mergedMs / 60000, 1, 1440);
        if (durationMin < 1) continue;
        sleep.push({
          date: day,
          durationMin,
          bedtime: toHHMM(new Date(first)),
          wakeTime: toHHMM(new Date(last)),
          externalId: `apple:sleep:${day}`,
        });
      }
    } catch {
      // Sleep unavailable or not authorized — continue.
    }

    return {
      ok: true,
      payload: {
        activities: activities.slice(0, 60),
        sleep: sleep.slice(0, 30),
      },
    };
  } catch {
    return { ok: false, reason: "error" };
  }
}

export async function getAppleHealthLastSync(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

export async function setAppleHealthLastSync(iso: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_SYNC_KEY, iso);
  } catch {
    // Non-fatal — the timestamp is display-only.
  }
}

export async function clearAppleHealthLastSync(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAST_SYNC_KEY);
  } catch {
    // Non-fatal.
  }
}

function mapWorkoutType(t: number): AppleHealthImportInputActivitiesItemType {
  switch (t) {
    case 52: // walking
    case 24: // hiking
      return "walk";
    case 37: // running
      return "run";
    case 13: // cycling
    case 74: // handCycling
      return "cycle";
    case 46: // swimming
      return "swim";
    case 57: // yoga
      return "yoga";
    case 20: // functionalStrengthTraining
    case 50: // traditionalStrengthTraining
    case 59: // coreTraining
      return "strength";
    default:
      return "other";
  }
}

function energyToKcal(q?: { unit: string; quantity: number }): number | undefined {
  if (!q || typeof q.quantity !== "number" || !Number.isFinite(q.quantity)) return undefined;
  const u = (q.unit ?? "").toLowerCase();
  let kcal = q.quantity;
  if (u.includes("kj")) kcal = q.quantity / 4.184;
  else if (u === "cal") kcal = q.quantity / 1000;
  const v = clampInt(kcal, 0, 10000);
  return v > 0 ? v : undefined;
}

function distanceToMiles(q?: { unit: string; quantity: number }): number | undefined {
  if (!q || typeof q.quantity !== "number" || !Number.isFinite(q.quantity)) return undefined;
  const u = (q.unit ?? "").toLowerCase();
  let miles: number;
  if (u === "mi") miles = q.quantity;
  else if (u === "km") miles = q.quantity * 0.621371;
  else if (u === "yd") miles = q.quantity / 1760;
  else if (u === "ft") miles = q.quantity / 5280;
  else miles = q.quantity / 1609.34;
  const v = Math.round(miles * 100) / 100;
  if (!Number.isFinite(v) || v <= 0) return undefined;
  return Math.min(v, 200);
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function toHHMM(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
