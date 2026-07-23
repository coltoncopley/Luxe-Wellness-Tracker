import { pgTable, text, serial, date, jsonb, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export interface WeeklyReportContent {
  summary: string;
  highlights: string[];
  focus: string;
  stats: {
    mealsLogged: number;
    avgCalories: number | null;
    weighIns: number;
    weightChangeLbs: number | null;
    glowCheckins: number;
    avgGlowScore: number | null;
    activeMinutes: number;
    steps: number;
  };
}

export const weeklyReportsTable = pgTable(
  "weekly_reports",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id),
    weekStart: date("week_start", { mode: "string" }).notNull(),
    content: jsonb("content").$type<WeeklyReportContent>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("weekly_reports_user_week_unique").on(t.userId, t.weekStart)],
);

export type WeeklyReport = typeof weeklyReportsTable.$inferSelect;
