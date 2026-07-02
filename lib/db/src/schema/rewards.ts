import { pgTable, serial, integer, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rewardEventsTable = pgTable("reward_events", {
  id: serial("id").primaryKey(),
  date: date("date", { mode: "string" }).notNull(),
  type: text("type").notNull(),
  points: integer("points").notNull(),
  description: text("description").notNull(),
  dedupeKey: text("dedupe_key").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRewardEventSchema = createInsertSchema(rewardEventsTable).omit({
  id: true,
  createdAt: true,
});

export type RewardEvent = typeof rewardEventsTable.$inferSelect;
export type InsertRewardEvent = z.infer<typeof insertRewardEventSchema>;
