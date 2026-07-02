import { pgTable, serial, integer, real, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const glowCheckinsTable = pgTable("glow_checkins", {
  id: serial("id").primaryKey(),
  date: date("date", { mode: "string" }).notNull().unique(),
  waterCups: integer("water_cups").notNull().default(0),
  sleepHours: real("sleep_hours").notNull().default(0),
  stressLevel: integer("stress_level").notNull().default(3),
  activityMinutes: integer("activity_minutes").notNull().default(0),
  proteinGrams: integer("protein_grams").notNull().default(0),
  skincareDone: boolean("skincare_done").notNull().default(false),
});

export const insertGlowCheckinSchema = createInsertSchema(glowCheckinsTable).omit({
  id: true,
});

export type GlowCheckin = typeof glowCheckinsTable.$inferSelect;
export type InsertGlowCheckin = z.infer<typeof insertGlowCheckinSchema>;
