import { pgTable, text, serial, date, real, integer, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const restaurantsTable = pgTable(
  "restaurants",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    cuisine: text("cuisine").notNull(),
    description: text("description"),
    // Domain of the website the menu was sourced from (patient-added restaurants only).
    menuSource: text("menu_source"),
    // NULL = curated/global (staff-managed). Set = patient-private custom restaurant,
    // visible only to that patient — staff must never see or touch these rows.
    ownerUserId: text("owner_user_id").references(() => usersTable.id),
  },
  (t) => [
    uniqueIndex("restaurants_owner_lower_name_unique")
      .on(t.ownerUserId, sql`lower(${t.name})`)
      .where(sql`${t.ownerUserId} IS NOT NULL`),
  ],
);

export const insertRestaurantSchema = createInsertSchema(restaurantsTable).omit({ id: true });
export type InsertRestaurant = z.infer<typeof insertRestaurantSchema>;
export type Restaurant = typeof restaurantsTable.$inferSelect;

export const menuItemsTable = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id")
    .notNull()
    .references(() => restaurantsTable.id),
  name: text("name").notNull(),
  calories: integer("calories").notNull(),
  proteinG: real("protein_g"),
  carbsG: real("carbs_g"),
  fatG: real("fat_g"),
  // Extended "Nutrition Facts" nutrients (all nullable — curated seed rows and
  // pre-existing rows have nulls; the label renders "—" for missing values).
  satFatG: real("sat_fat_g"),
  fiberG: real("fiber_g"),
  sugarG: real("sugar_g"),
  sodiumMg: real("sodium_mg"),
  cholesterolMg: real("cholesterol_mg"),
  isHealthyPick: boolean("is_healthy_pick").notNull().default(false),
  orderingTip: text("ordering_tip"),
});

export const insertMenuItemSchema = createInsertSchema(menuItemsTable).omit({ id: true });
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type MenuItem = typeof menuItemsTable.$inferSelect;

export const foodLogsTable = pgTable("food_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id),
  date: date("date", { mode: "string" }).notNull(),
  mealType: text("meal_type").notNull(),
  foodName: text("food_name").notNull(),
  restaurantName: text("restaurant_name"),
  calories: integer("calories").notNull(),
  proteinG: real("protein_g"),
  carbsG: real("carbs_g"),
  fatG: real("fat_g"),
  // Extended "Nutrition Facts" nutrients (all nullable). Stored as TOTALS as
  // consumed — servings below is display metadata only, never a multiplier the
  // aggregation applies (daily-summary just sums these columns).
  satFatG: real("sat_fat_g"),
  fiberG: real("fiber_g"),
  sugarG: real("sugar_g"),
  sodiumMg: real("sodium_mg"),
  cholesterolMg: real("cholesterol_mg"),
  // Quantity metadata (e.g. servings = 1.5, servingSize = "1 cup"). The stored
  // nutrient columns already reflect the full amount consumed.
  servings: real("servings").notNull().default(1),
  servingSize: text("serving_size"),
});

export const insertFoodLogSchema = createInsertSchema(foodLogsTable).omit({
  id: true,
  userId: true,
});
export type InsertFoodLog = z.infer<typeof insertFoodLogSchema>;
export type FoodLog = typeof foodLogsTable.$inferSelect;

export const tipsTable = pgTable("tips", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
});

export const insertTipSchema = createInsertSchema(tipsTable).omit({ id: true });
export type InsertTip = z.infer<typeof insertTipSchema>;
export type Tip = typeof tipsTable.$inferSelect;
