import { pgTable, serial, date, text, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const passportEntriesTable = pgTable("passport_entries", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id),
  entryType: text("entry_type").notNull(),
  performedOn: date("performed_on", { mode: "string" }).notNull(),
  title: text("title").notNull(),
  product: text("product"),
  amount: text("amount"),
  area: text("area"),
  provider: text("provider"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const passportProfilesTable = pgTable(
  "passport_profiles",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id),
    allergies: text("allergies").notNull().default(""),
    skinType: text("skin_type").notNull().default(""),
    skincareRoutine: text("skincare_routine").notNull().default(""),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique("passport_profiles_user_unique").on(t.userId)],
);

export type PassportEntry = typeof passportEntriesTable.$inferSelect;
export type PassportProfile = typeof passportProfilesTable.$inferSelect;
