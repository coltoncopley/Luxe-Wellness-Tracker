import { pgTable, serial, date, text, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const mindCheckinsTable = pgTable(
  "mind_checkins",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id),
    date: date("date", { mode: "string" }).notNull(),
    mood: integer("mood").notNull(),
    energy: integer("energy").notNull(),
    stress: integer("stress").notNull(),
    anxiety: integer("anxiety").notNull(),
    gratitude: text("gratitude"),
    journal: text("journal"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("mind_checkins_user_date_unique").on(t.userId, t.date)],
);

export type MindCheckin = typeof mindCheckinsTable.$inferSelect;
