import cron from "node-cron";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db, doctorTipsTable, usersTable, rewardEventsTable } from "@workspace/db";
import { POINTS } from "./rewards";
import { logger } from "./logger";

const TIMEZONE = "America/New_York";

function todayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

/** Publish the oldest approved tip (Monday mornings). */
async function publishWeeklyTip(): Promise<void> {
  const [next] = await db
    .select()
    .from(doctorTipsTable)
    .where(eq(doctorTipsTable.status, "approved"))
    .orderBy(asc(doctorTipsTable.approvedAt), asc(doctorTipsTable.id))
    .limit(1);
  if (!next) {
    logger.info("Weekly tip: no approved tips in the queue");
    return;
  }
  // Atomic guard so a duplicate cron fire can't double-publish.
  const [row] = await db
    .update(doctorTipsTable)
    .set({ status: "sent", sentAt: new Date() })
    .where(and(eq(doctorTipsTable.id, next.id), eq(doctorTipsTable.status, "approved")))
    .returning();
  if (row) logger.info({ tipId: row.id }, "Weekly tip published");
}

/** Award birthday bonus points to users whose birthday (MM-DD) is today in ET. */
async function awardBirthdayPerks(): Promise<void> {
  const today = todayET(); // YYYY-MM-DD
  const monthDay = today.slice(5); // MM-DD
  const year = today.slice(0, 4);
  const celebrants = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(isNotNull(usersTable.birthday), eq(usersTable.birthday, monthDay)));
  for (const user of celebrants) {
    try {
      await db
        .insert(rewardEventsTable)
        .values({
          userId: user.id,
          type: "birthday",
          date: today,
          points: POINTS.birthday,
          description: "Happy birthday from LUXE! 🎂",
          dedupeKey: `birthday:${year}`,
        })
        .onConflictDoNothing({
          target: [rewardEventsTable.userId, rewardEventsTable.dedupeKey],
        });
    } catch (err) {
      logger.warn({ err, userId: user.id }, "Birthday perk award failed");
    }
  }
  if (celebrants.length > 0) {
    logger.info({ count: celebrants.length }, "Birthday perks processed");
  }
}

export function startEngagementScheduler(): void {
  // Weekly tip publish — Monday 9:00 AM Eastern
  cron.schedule("0 9 * * 1", () => void publishWeeklyTip(), { timezone: TIMEZONE });
  // Birthday perks — daily 9:00 AM Eastern
  cron.schedule("0 9 * * *", () => void awardBirthdayPerks(), { timezone: TIMEZONE });
  logger.info("Engagement scheduler started (weekly tip Mon 9:00, birthday perks daily 9:00 ET)");
}
