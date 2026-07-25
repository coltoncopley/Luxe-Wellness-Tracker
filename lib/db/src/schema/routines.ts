import {
  pgTable,
  serial,
  integer,
  boolean,
  date,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { ingredientScansTable } from "./ingredients";

// Skincare Routine Builder (patient-private). One AM + one PM routine per user,
// stored as ordered items. Products can be linked to a saved Product Scan or
// entered as free text.
export const routineItemsTable = pgTable("routine_items", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id),
  // "am" | "pm"
  period: text("period").notNull(),
  position: integer("position").notNull().default(0),
  productName: text("product_name").notNull(),
  ingredientScanId: integer("ingredient_scan_id").references(() => ingredientScansTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Daily routine check-off (patient-private). No points of its own — completing
// a routine mirrors glow_checkins.skincare_done for the same date.
export const routineCheckinsTable = pgTable(
  "routine_checkins",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id),
    date: date("date", { mode: "string" }).notNull(),
    amDone: boolean("am_done").notNull().default(false),
    pmDone: boolean("pm_done").notNull().default(false),
    sunscreenUsed: boolean("sunscreen_used").notNull().default(false),
  },
  (t) => [unique("routine_checkins_user_date_unique").on(t.userId, t.date)],
);

export type RoutineItem = typeof routineItemsTable.$inferSelect;
export type RoutineCheckin = typeof routineCheckinsTable.$inferSelect;
