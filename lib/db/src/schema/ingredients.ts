import { pgTable, serial, date, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const ingredientScansTable = pgTable("ingredient_scans", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id),
  scannedOn: date("scanned_on", { mode: "string" }).notNull(),
  productName: text("product_name").notNull(),
  verdict: text("verdict").notNull(),
  summary: text("summary").notNull(),
  goodIngredients: text("good_ingredients").array().notNull(),
  concerns: text("concerns").array().notNull(),
  pregnancySafety: text("pregnancy_safety").notNull(),
  pregnancyNote: text("pregnancy_note").notNull(),
  suggestion: text("suggestion"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type IngredientScan = typeof ingredientScansTable.$inferSelect;
