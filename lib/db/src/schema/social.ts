import { pgTable, text, serial, timestamp, boolean, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const followsTable = pgTable(
  "follows",
  {
    id: serial("id").primaryKey(),
    followerUserId: text("follower_user_id")
      .notNull()
      .references(() => usersTable.id),
    followeeUserId: text("followee_user_id")
      .notNull()
      .references(() => usersTable.id),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (t) => [unique("follows_pair_unique").on(t.followerUserId, t.followeeUserId)],
);

export type Follow = typeof followsTable.$inferSelect;

export const shareSettingsTable = pgTable("share_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => usersTable.id),
  shareGlow: boolean("share_glow").notNull().default(true),
  shareWeightProgress: boolean("share_weight_progress").notNull().default(true),
  shareStreak: boolean("share_streak").notNull().default(true),
  sharePoints: boolean("share_points").notNull().default(false),
  shareNumbers: boolean("share_numbers").notNull().default(false),
  sharePhotos: boolean("share_photos").notNull().default(false),
});

export type ShareSettings = typeof shareSettingsTable.$inferSelect;

export const cheersTable = pgTable("cheers", {
  id: serial("id").primaryKey(),
  fromUserId: text("from_user_id")
    .notNull()
    .references(() => usersTable.id),
  toUserId: text("to_user_id")
    .notNull()
    .references(() => usersTable.id),
  emoji: text("emoji").notNull(),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Cheer = typeof cheersTable.$inferSelect;
