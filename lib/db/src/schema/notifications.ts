import {
  pgTable,
  text,
  serial,
  timestamp,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const notificationPrefsTable = pgTable(
  "notification_prefs",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id),
    pushEnabled: boolean("push_enabled").notNull().default(false),
    emailEnabled: boolean("email_enabled").notNull().default(false),
    emailOverride: text("email_override"),
    announcements: boolean("announcements").notNull().default(true),
    habitReminders: boolean("habit_reminders").notNull().default(true),
    streakAlerts: boolean("streak_alerts").notNull().default(true),
    weeklySummary: boolean("weekly_summary").notNull().default(true),
    treatmentReminders: boolean("treatment_reminders").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("notification_prefs_user_unique").on(t.userId)],
);

export const pushSubscriptionsTable = pgTable(
  "push_subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("push_subscriptions_endpoint_unique").on(t.endpoint)],
);

export const notificationSendsTable = pgTable(
  "notification_sends",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id),
    dedupeKey: text("dedupe_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("notification_sends_dedupe_unique").on(t.userId, t.dedupeKey)],
);

export type NotificationPrefs = typeof notificationPrefsTable.$inferSelect;
export type PushSubscription = typeof pushSubscriptionsTable.$inferSelect;
