import {
  pgTable,
  text,
  serial,
  date,
  real,
  integer,
  timestamp,
  unique,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const MUSCLE_GROUPS = [
  "chest",
  "lats",
  "upper_back",
  "lower_back",
  "traps",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "core",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT_TYPES = [
  "bodyweight",
  "dumbbell",
  "barbell",
  "machine",
  "cable",
  "band",
  "kettlebell",
] as const;
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

export const exercisesTable = pgTable(
  "exercises",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    primaryMuscle: text("primary_muscle").notNull(),
    secondaryMuscles: text("secondary_muscles").array().notNull(),
    equipment: text("equipment").notNull(),
    category: text("category").notNull(),
    difficulty: text("difficulty").notNull().default("beginner"),
    instructions: text("instructions").notNull(),
    howToVideoId: text("how_to_video_id"),
    // NULL = shared/global library (staff-managed). Set = patient-private custom
    // lift, visible only to that patient — staff must never see or touch these rows.
    ownerUserId: text("owner_user_id").references(() => usersTable.id),
  },
  (t) => [
    // Library names stay globally unique; custom-lift names are unique per owner
    // (case-insensitive). Two partial indexes so a patient's custom name can never
    // collide with — or leak the existence of — another patient's custom lift.
    uniqueIndex("exercises_library_name_unique")
      .on(t.name)
      .where(sql`${t.ownerUserId} IS NULL`),
    uniqueIndex("exercises_owner_lower_name_unique")
      .on(t.ownerUserId, sql`lower(${t.name})`)
      .where(sql`${t.ownerUserId} IS NOT NULL`),
  ],
);

export type Exercise = typeof exercisesTable.$inferSelect;

export const workoutPreferencesTable = pgTable(
  "workout_preferences",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id),
    goal: text("goal").notNull().default("build_muscle"),
    experienceLevel: text("experience_level").notNull().default("beginner"),
    equipment: text("equipment").array().notNull().default([]),
    targetDurationMins: integer("target_duration_mins").notNull().default(45),
    daysPerWeek: integer("days_per_week").notNull().default(3),
    limitations: text("limitations"),
  },
  (t) => [unique("workout_preferences_user_unique").on(t.userId)],
);

export const insertWorkoutPreferencesSchema = createInsertSchema(workoutPreferencesTable).omit({
  id: true,
  userId: true,
});
export type InsertWorkoutPreferences = z.infer<typeof insertWorkoutPreferencesSchema>;
export type WorkoutPreferences = typeof workoutPreferencesTable.$inferSelect;

export const workoutsTable = pgTable(
  "workouts",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id),
    date: date("date", { mode: "string" }).notNull(),
    title: text("title").notNull(),
    source: text("source").notNull().default("manual"),
    status: text("status").notNull().default("planned"),
    notes: text("notes"),
    aiRationale: text("ai_rationale"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("workouts_user_date_idx").on(t.userId, t.date)],
);

export const insertWorkoutSchema = createInsertSchema(workoutsTable).omit({
  id: true,
  userId: true,
  completedAt: true,
  createdAt: true,
});
export type InsertWorkout = z.infer<typeof insertWorkoutSchema>;
export type Workout = typeof workoutsTable.$inferSelect;

export const workoutExercisesTable = pgTable(
  "workout_exercises",
  {
    id: serial("id").primaryKey(),
    workoutId: integer("workout_id")
      .notNull()
      .references(() => workoutsTable.id, { onDelete: "cascade" }),
    exerciseId: integer("exercise_id")
      .notNull()
      .references(() => exercisesTable.id),
    sortOrder: integer("sort_order").notNull().default(0),
    targetSets: integer("target_sets"),
    targetReps: integer("target_reps"),
    targetWeightLbs: real("target_weight_lbs"),
  },
  (t) => [
    index("workout_exercises_workout_idx").on(t.workoutId),
    index("workout_exercises_exercise_idx").on(t.exerciseId),
  ],
);

export const insertWorkoutExerciseSchema = createInsertSchema(workoutExercisesTable).omit({
  id: true,
});
export type InsertWorkoutExercise = z.infer<typeof insertWorkoutExerciseSchema>;
export type WorkoutExercise = typeof workoutExercisesTable.$inferSelect;

export const workoutSetsTable = pgTable(
  "workout_sets",
  {
    id: serial("id").primaryKey(),
    workoutExerciseId: integer("workout_exercise_id")
      .notNull()
      .references(() => workoutExercisesTable.id, { onDelete: "cascade" }),
    setNumber: integer("set_number").notNull(),
    reps: integer("reps").notNull(),
    weightLbs: real("weight_lbs"),
  },
  (t) => [index("workout_sets_workout_exercise_idx").on(t.workoutExerciseId)],
);

export const insertWorkoutSetSchema = createInsertSchema(workoutSetsTable).omit({ id: true });
export type InsertWorkoutSet = z.infer<typeof insertWorkoutSetSchema>;
export type WorkoutSet = typeof workoutSetsTable.$inferSelect;
