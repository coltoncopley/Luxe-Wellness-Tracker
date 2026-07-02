import { pgTable, text, serial, date, real, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const weightEntriesTable = pgTable("weight_entries", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id),
  date: date("date", { mode: "string" }).notNull(),
  weightLbs: real("weight_lbs").notNull(),
  note: text("note"),
});

export const insertWeightEntrySchema = createInsertSchema(weightEntriesTable).omit({
  id: true,
  userId: true,
});
export type InsertWeightEntry = z.infer<typeof insertWeightEntrySchema>;
export type WeightEntry = typeof weightEntriesTable.$inferSelect;

export const measurementsTable = pgTable("measurements", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id),
  date: date("date", { mode: "string" }).notNull(),
  area: text("area").notNull(),
  valueInches: real("value_inches").notNull(),
});

export const insertMeasurementSchema = createInsertSchema(measurementsTable).omit({
  id: true,
  userId: true,
});
export type InsertMeasurement = z.infer<typeof insertMeasurementSchema>;
export type Measurement = typeof measurementsTable.$inferSelect;

export const goalsTable = pgTable(
  "goals",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id),
    startWeightLbs: real("start_weight_lbs"),
    goalWeightLbs: real("goal_weight_lbs"),
    targetDate: date("target_date", { mode: "string" }),
    dailyCalorieTarget: integer("daily_calorie_target"),
  },
  (t) => [unique("goals_user_unique").on(t.userId)],
);

export const insertGoalSchema = createInsertSchema(goalsTable).omit({ id: true, userId: true });
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type Goal = typeof goalsTable.$inferSelect;
