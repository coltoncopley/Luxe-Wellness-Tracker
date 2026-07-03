import {
  pgTable,
  text,
  serial,
  date,
  real,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const activitiesTable = pgTable(
  "activities",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id),
    date: date("date", { mode: "string" }).notNull(),
    type: text("type").notNull(),
    durationMin: integer("duration_min").notNull(),
    steps: integer("steps"),
    calories: integer("calories"),
    distanceMi: real("distance_mi"),
    notes: text("notes"),
    source: text("source").notNull().default("manual"),
    externalId: text("external_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("activities_user_source_external_unique")
      .on(t.userId, t.source, t.externalId)
      .where(sql`${t.externalId} IS NOT NULL`),
  ],
);

export const insertActivitySchema = createInsertSchema(activitiesTable).omit({
  id: true,
  userId: true,
  createdAt: true,
});
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activitiesTable.$inferSelect;

export const sleepEntriesTable = pgTable(
  "sleep_entries",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id),
    date: date("date", { mode: "string" }).notNull(),
    durationMin: integer("duration_min").notNull(),
    bedtime: text("bedtime"),
    wakeTime: text("wake_time"),
    quality: integer("quality"),
    score: integer("score"),
    source: text("source").notNull().default("manual"),
    externalId: text("external_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sleep_entries_user_source_external_unique")
      .on(t.userId, t.source, t.externalId)
      .where(sql`${t.externalId} IS NOT NULL`),
  ],
);

export const insertSleepEntrySchema = createInsertSchema(sleepEntriesTable).omit({
  id: true,
  userId: true,
  createdAt: true,
});
export type InsertSleepEntry = z.infer<typeof insertSleepEntrySchema>;
export type SleepEntry = typeof sleepEntriesTable.$inferSelect;

export const deviceConnectionsTable = pgTable(
  "device_connections",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id),
    provider: text("provider").notNull(),
    accessToken: text("access_token").notNull(),
    importActivity: boolean("import_activity").notNull().default(true),
    importSleep: boolean("import_sleep").notNull().default(true),
    lastSyncedAt: timestamp("last_synced_at"),
    lastSyncStatus: text("last_sync_status"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("device_connections_user_provider_unique").on(t.userId, t.provider)],
);

export type DeviceConnection = typeof deviceConnectionsTable.$inferSelect;
