import {
  pgTable,
  serial,
  integer,
  text,
  date,
  timestamp,
  boolean,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const rewardEventsTable = pgTable(
  "reward_events",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id),
    date: date("date", { mode: "string" }).notNull(),
    type: text("type").notNull(),
    points: integer("points").notNull(),
    description: text("description").notNull(),
    dedupeKey: text("dedupe_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("reward_events_user_dedupe_unique").on(t.userId, t.dedupeKey)],
);

export const redemptionsTable = pgTable("redemptions", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id),
  code: text("code").notNull().unique(),
  rewardId: text("reward_id").notNull(),
  title: text("title").notNull(),
  points: integer("points").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerUserId: text("referrer_user_id")
    .notNull()
    .references(() => usersTable.id),
  referredUserId: text("referred_user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id),
  code: text("code").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rewardItemsTable = pgTable("reward_items", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  points: integer("points").notNull(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  oneTime: boolean("one_time").notNull().default(false),
});

export const insertRewardEventSchema = createInsertSchema(rewardEventsTable).omit({
  id: true,
  createdAt: true,
});
export const insertRewardItemSchema = createInsertSchema(rewardItemsTable).omit({ id: true });

export type RewardEvent = typeof rewardEventsTable.$inferSelect;
export type InsertRewardEvent = z.infer<typeof insertRewardEventSchema>;
export type Redemption = typeof redemptionsTable.$inferSelect;
export type RewardItem = typeof rewardItemsTable.$inferSelect;
export type InsertRewardItem = z.infer<typeof insertRewardItemSchema>;
