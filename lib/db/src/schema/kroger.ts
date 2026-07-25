import { pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Kroger OAuth tokens, one row per member, for the one-tap "send shopping
 * list to Kroger cart" handoff. Access tokens live ~30 minutes and are
 * refreshed on demand; a 401 after refresh clears the row so the client
 * falls back to the "Connect Kroger" state.
 */
export const krogerTokensTable = pgTable(
  "kroger_tokens",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique("kroger_tokens_user_unique").on(t.userId)],
);

export type KrogerTokenRow = typeof krogerTokensTable.$inferSelect;
