import { pgTable, serial, date, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const progressPhotosTable = pgTable("progress_photos", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id),
  takenOn: date("taken_on", { mode: "string" }).notNull(),
  category: text("category").notNull(),
  note: text("note"),
  objectPath: text("object_path").notNull(),
  sharedWithFriends: boolean("shared_with_friends").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ProgressPhoto = typeof progressPhotosTable.$inferSelect;
