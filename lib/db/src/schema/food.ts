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
