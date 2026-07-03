import cron from "node-cron";
import { and, eq, gte, or, sql } from "drizzle-orm";
import {
  db,
  notificationPrefsTable,
  glowCheckinsTable,
  foodLogsTable,
  weightEntriesTable,
  rewardEventsTable,
} from "@workspace/db";
import { notifyUser } from "./notifications";
import { logger } from "./logger";

const TIMEZONE = "America/New_York";

function dateStringInET(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

function todayET(): string {
  return dateStringInET(new Date());
}

function daysAgoET(days: number): string {
  // Anchor on today's ET calendar date (noon UTC avoids DST/host-timezone drift),
  // then subtract whole days in UTC.
  const [y, m, d] = todayET().split("-").map(Number);
  const anchor = new Date(Date.UTC(y!, m! - 1, d!, 12));
  anchor.setUTCDate(anchor.getUTCDate() - days);
  return anchor.toISOString().slice(0, 10);
}

/** Users who opted into a topic with at least one channel on. */
async function optedInUsers(
  topic: "habitReminders" | "streakAlerts" | "weeklySummary",
): Promise<string[]> {
  const column = {
    habitReminders: notificationPrefsTable.habitReminders,
    streakAlerts: notificationPrefsTable.streakAlerts,
    weeklySummary: notificationPrefsTable.weeklySummary,
  }[topic];
  const rows = await db
    .select({ userId: notificationPrefsTable.userId })
    .from(notificationPrefsTable)
    .where(
      and(
        eq(column, true),
        or(
          eq(notificationPrefsTable.pushEnabled, true),
          eq(notificationPrefsTable.emailEnabled, true),
        ),
      ),
    );
  return rows.map((r) => r.userId);
}

async function checkedInOn(userId: string, date: string): Promise<boolean> {
  const [row] = await db
    .select({ id: glowCheckinsTable.id })
    .from(glowCheckinsTable)
    .where(and(eq(glowCheckinsTable.userId, userId), eq(glowCheckinsTable.date, date)))
    .limit(1);
  return !!row;
}

async function runHabitReminders(): Promise<void> {
  const today = todayET();
  const users = await optedInUsers("habitReminders");
  for (const userId of users) {
    try {
      if (await checkedInOn(userId, today)) continue;
      await notifyUser(
        userId,
        "habitReminders",
        {
          title: "Your daily check-in awaits 🌿",
          body: "Take 30 seconds to log your Glow habits, meals, and weigh-in — small steps add up.",
          url: "/glow",
        },
        `habit:${today}:${userId}`,
      );
    } catch (err) {
      logger.warn({ err, userId }, "Habit reminder failed");
    }
  }
}

async function runStreakAlerts(): Promise<void> {
  const today = todayET();
  const yesterday = daysAgoET(1);
  const users = await optedInUsers("streakAlerts");
  for (const userId of users) {
    try {
      if (await checkedInOn(userId, today)) continue;
      if (!(await checkedInOn(userId, yesterday))) continue; // no active streak to protect
      await notifyUser(
        userId,
        "streakAlerts",
        {
          title: "Don't lose your streak! 🔥",
          body: "You haven't checked in today. A quick Glow check-in keeps your streak alive.",
          url: "/glow",
        },
        `streak:${today}:${userId}`,
      );
    } catch (err) {
      logger.warn({ err, userId }, "Streak alert failed");
    }
  }
}

async function runWeeklySummaries(): Promise<void> {
  const weekAgo = daysAgoET(7);
  const today = todayET();
  const users = await optedInUsers("weeklySummary");
  for (const userId of users) {
    try {
      const [checkins, meals, weighIns, points] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(glowCheckinsTable)
          .where(and(eq(glowCheckinsTable.userId, userId), gte(glowCheckinsTable.date, weekAgo))),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(foodLogsTable)
          .where(and(eq(foodLogsTable.userId, userId), gte(foodLogsTable.date, weekAgo))),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(weightEntriesTable)
          .where(
            and(eq(weightEntriesTable.userId, userId), gte(weightEntriesTable.date, weekAgo)),
          ),
        db
          .select({
            total: sql<number>`COALESCE(SUM(${rewardEventsTable.points}) FILTER (WHERE ${rewardEventsTable.points} > 0), 0)::int`,
          })
          .from(rewardEventsTable)
          .where(
            and(
              eq(rewardEventsTable.userId, userId),
              sql`${rewardEventsTable.createdAt} > now() - interval '7 days'`,
            ),
          ),
      ]);
      const c = checkins[0]?.count ?? 0;
      const m = meals[0]?.count ?? 0;
      const w = weighIns[0]?.count ?? 0;
      const p = points[0]?.total ?? 0;
      if (c === 0 && m === 0 && w === 0) {
        await notifyUser(
          userId,
          "weeklySummary",
          {
            title: "A fresh week at LUXE 🌸",
            body: "Last week was quiet — this week is a new chance. Start with one small check-in today.",
            url: "/",
          },
          `weekly:${today}:${userId}`,
        );
      } else {
        await notifyUser(
          userId,
          "weeklySummary",
          {
            title: "Your week in review ✨",
            body: `This week: ${c} Glow check-in${c === 1 ? "" : "s"}, ${m} meal${m === 1 ? "" : "s"} logged, ${w} weigh-in${w === 1 ? "" : "s"}, and ${p} points earned. Keep it up!`,
            url: "/rewards",
          },
          `weekly:${today}:${userId}`,
        );
      }
    } catch (err) {
      logger.warn({ err, userId }, "Weekly summary failed");
    }
  }
}

export function startNotificationScheduler(): void {
  // Daily habit reminder — 10:00 AM Eastern
  cron.schedule("0 10 * * *", () => void runHabitReminders(), { timezone: TIMEZONE });
  // Streak protection alert — 7:00 PM Eastern
  cron.schedule("0 19 * * *", () => void runStreakAlerts(), { timezone: TIMEZONE });
  // Weekly summary — Sunday 5:00 PM Eastern
  cron.schedule("0 17 * * 0", () => void runWeeklySummaries(), { timezone: TIMEZONE });
  logger.info("Notification scheduler started (habit 10:00, streak 19:00, weekly Sun 17:00 ET)");
}
