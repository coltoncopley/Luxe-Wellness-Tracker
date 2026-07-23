import { pgTable, text, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const challengesTable = pgTable(
  "challenges",
  {
    id: serial("id").primaryKey(),
    month: text("month").notNull(),
    key: text("key").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    metric: text("metric").notNull(),
    target: integer("target").notNull(),
    points: integer("points").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("challenges_month_key_unique").on(t.month, t.key)],
);

export type Challenge = typeof challengesTable.$inferSelect;

export const challengeParticipantsTable = pgTable(
  "challenge_participants",
  {
    id: serial("id").primaryKey(),
    challengeId: integer("challenge_id")
      .notNull()
      .references(() => challengesTable.id),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [unique("challenge_participants_pair_unique").on(t.challengeId, t.userId)],
);

export type ChallengeParticipant = typeof challengeParticipantsTable.$inferSelect;
