import { pgTable, serial, integer, date, text, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const skinScansTable = pgTable(
  "skin_scans",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id),
    weekStart: date("week_start", { mode: "string" }).notNull(),
    scannedOn: date("scanned_on", { mode: "string" }).notNull(),
    overall: integer("overall").notNull(),
    hydration: integer("hydration").notNull(),
    smoothness: integer("smoothness").notNull(),
    evenness: integer("evenness").notNull(),
    clarity: integer("clarity").notNull(),
    radiance: integer("radiance").notNull(),
    summary: text("summary").notNull(),
    tips: text("tips").array().notNull(),
    suggestion: text("suggestion"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("skin_scans_user_week_unique").on(t.userId, t.weekStart)],
);

export type SkinScan = typeof skinScansTable.$inferSelect;
