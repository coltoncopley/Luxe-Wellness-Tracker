import { pgTable, serial, integer, real, boolean, date, text, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const glowCheckinsTable = pgTable(
  "glow_checkins",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id),
    date: date("date", { mode: "string" }).notNull(),
    waterCups: integer("water_cups").notNull().default(0),
    sleepHours: real("sleep_hours").notNull().default(0),
    stressLevel: integer("stress_level").notNull().default(3),
    activityMinutes: integer("activity_minutes").notNull().default(0),
    proteinGrams: integer("protein_grams").notNull().default(0),
    skincareDone: boolean("skincare_done").notNull().default(false),
  },
  (t) => [unique("glow_checkins_user_date_unique").on(t.userId, t.date)],
);

export const insertGlowCheckinSchema = createInsertSchema(glowCheckinsTable).omit({
  id: true,
  userId: true,
});

export type GlowCheckin = typeof glowCheckinsTable.$inferSelect;
export type InsertGlowCheckin = z.infer<typeof insertGlowCheckinSchema>;
