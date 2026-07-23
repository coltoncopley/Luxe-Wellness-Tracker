import {
  pgTable,
  text,
  serial,
  date,
  jsonb,
  timestamp,
  integer,
  unique,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export interface MealPlanMeal {
  name: string;
  description: string;
  calories: number;
}

export interface MealPlanDay {
  date: string;
  breakfast: MealPlanMeal;
  lunch: MealPlanMeal;
  dinner: MealPlanMeal;
  snack: MealPlanMeal;
}

export interface MealPlanGroceryCategory {
  category: string;
  items: string[];
}

export interface MealPlanContent {
  days: MealPlanDay[];
  grocery: MealPlanGroceryCategory[];
  notes: string | null;
}

export const mealPlansTable = pgTable(
  "meal_plans",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id),
    weekStart: date("week_start", { mode: "string" }).notNull(),
    content: jsonb("content").$type<MealPlanContent>().notNull(),
    generations: integer("generations").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("meal_plans_user_week_unique").on(t.userId, t.weekStart)],
);

export type MealPlanRow = typeof mealPlansTable.$inferSelect;
