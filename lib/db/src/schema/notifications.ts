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
    pushEnabled: boolean("push_enabled").notNull().default(true),
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

/** Native (Expo) push tokens — one row per device, alongside web-push subscriptions. */
export const expoPushTokensTable = pgTable(
  "expo_push_tokens",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id),
    token: text("token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("expo_push_tokens_token_unique").on(t.token)],
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
export type ExpoPushToken = typeof expoPushTokensTable.$inferSelect;
