import {
  pgTable,
  text,
  serial,
  date,
  jsonb,
  timestamp,
  integer,
  boolean,
  unique,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/** Bounded units so aggregation never has to convert or reconcile free text. */
export const MEAL_PLAN_UNITS = [
  "g",
  "oz",
  "lb",
  "ml",
  "cup",
  "tbsp",
  "tsp",
  "clove",
  "slice",
  "can",
  "bunch",
  "item",
] as const;
export type MealPlanUnit = (typeof MEAL_PLAN_UNITS)[number];

/** Bounded grocery categories, matched to how a store is walked. */
export const MEAL_PLAN_CATEGORIES = [
  "Produce",
  "Protein",
  "Dairy",
  "Grains",
  "Pantry",
  "Frozen",
  "Other",
] as const;
export type MealPlanCategory = (typeof MEAL_PLAN_CATEGORIES)[number];

/**
 * A single ingredient for ONE person's serving of a meal. The weekly shopping
 * list is a deterministic aggregation of every meal's ingredients (grouped by
 * name + unit, summed, then multiplied by the plan's people count), so changing
 * the number of people or swapping a dish never needs another AI call. A null
 * quantity means "to taste" / uncountable and is listed once without an amount.
 */
export interface MealPlanIngredient {
  name: string;
  quantity: number | null;
  unit: MealPlanUnit | null;
  category: MealPlanCategory;
}

/**
 * Step-by-step cooking guide for one meal. Steps intentionally carry no
 * ingredient amounts — quantities live in `ingredients` (per person) and are
 * scaled by the plan's people count at display time. Written by AI on first
 * request and cached here; swapping or regenerating the meal drops it.
 */
export interface MealPlanRecipe {
  steps: string[];
  prepMinutes: number | null;
  cookMinutes: number | null;
  tip: string | null;
}

export interface MealPlanMeal {
  name: string;
  description: string;
  calories: number;
  /** Optional: plans generated before the shopping-list overhaul lack this. */
  ingredients?: MealPlanIngredient[];
  /** Optional: generated lazily the first time the member opens the meal. */
  recipe?: MealPlanRecipe;
}

export interface MealPlanDay {
  date: string;
  breakfast: MealPlanMeal;
  lunch: MealPlanMeal;
  dinner: MealPlanMeal;
  snack: MealPlanMeal;
}

/** Legacy names-only grocery list, kept for back-compat with shipped mobile apps. */
export interface MealPlanGroceryCategory {
  category: string;
  items: string[];
}

export interface MealPlanContent {
  days: MealPlanDay[];
  grocery: MealPlanGroceryCategory[];
  notes: string | null;
}

/** Slot key `${date}:${mealType}` -> the 3 pending swap options awaiting a pick. */
export type MealPlanPendingSuggestions = Record<string, MealPlanMeal[]>;

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
    /** Number of people the grocery amounts are scaled for (per-plan override). */
    people: integer("people").notNull().default(1),
    /** Server-held swap options so an applied choice always has valid ingredients. */
    pendingSuggestions: jsonb("pending_suggestions").$type<MealPlanPendingSuggestions>(),
    /** Daily swap-suggestion counter (resets when suggestDate rolls over, ET). */
    suggestCount: integer("suggest_count").notNull().default(0),
    suggestDate: date("suggest_date", { mode: "string" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("meal_plans_user_week_unique").on(t.userId, t.weekStart)],
);

export type MealPlanRow = typeof mealPlansTable.$inferSelect;

/**
 * Per-user meal-plan preferences. `allergies`/`dislikes`/`dietStyle` are set by
 * the member; `avoidDishes` is learned from dishes they remove (capped, most
 * recent kept). All of it is patient-private health data and is only ever fed
 * to the model inside a data-not-instructions block — never shown to staff.
 */
export const mealPlanPreferencesTable = pgTable("meal_plan_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => usersTable.id),
  allergies: text("allergies").array().notNull().default([]),
  dislikes: text("dislikes").array().notNull().default([]),
  dietStyle: text("diet_style"),
  householdSize: integer("household_size").notNull().default(1),
  avoidDishes: text("avoid_dishes").array().notNull().default([]),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type MealPlanPreferencesRow = typeof mealPlanPreferencesTable.$inferSelect;

/** Persisted check-off state for the weekly shopping list, keyed by item. */
export const mealPlanGroceryChecksTable = pgTable(
  "meal_plan_grocery_checks",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id),
    weekStart: date("week_start", { mode: "string" }).notNull(),
    /** Stable aggregation key: normalized name + "|" + (unit ?? ""). */
    itemKey: text("item_key").notNull(),
    checked: boolean("checked").notNull().default(true),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique("meal_plan_grocery_checks_unique").on(t.userId, t.weekStart, t.itemKey)],
);

export type MealPlanGroceryCheckRow = typeof mealPlanGroceryChecksTable.$inferSelect;

/**
 * Meals the member opted OUT of shopping for this week. Row present =
 * excluded: that meal's ingredients are left out of the derived shopping
 * list (and email/Instacart handoff). Display-only filter — plan content
 * is never touched, so this can't race the jsonb content writers.
 */
export const mealPlanMealExcludesTable = pgTable(
  "meal_plan_meal_excludes",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id),
    weekStart: date("week_start", { mode: "string" }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    mealType: text("meal_type").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("meal_plan_meal_excludes_unique").on(t.userId, t.weekStart, t.date, t.mealType),
  ],
);

export type MealPlanMealExcludeRow = typeof mealPlanMealExcludesTable.$inferSelect;
