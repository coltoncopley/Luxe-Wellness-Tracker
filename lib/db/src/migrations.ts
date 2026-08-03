import { sql } from "drizzle-orm";
import { db } from "./db";

/**
 * Idempotent schema migrations for tables that cannot be applied via
 * `drizzle-kit push` non-interactively (e.g. when push is blocked waiting for
 * a TTY prompt).  Every statement uses IF NOT EXISTS / IF EXISTS so re-running
 * on a fully-migrated database is safe.
 *
 * Add a new block here whenever a schema change can't go through drizzle push.
 */
export async function runSchemaMigrations(): Promise<void> {
  // expo_push_tokens — native Expo push tokens for iOS/Android reminders.
  // Stores one row per device; paired with push_subscriptions (web push).
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS expo_push_tokens (
      id         serial       PRIMARY KEY,
      user_id    text         NOT NULL REFERENCES users(id),
      token      text         NOT NULL,
      created_at timestamptz  NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS expo_push_tokens_token_unique
      ON expo_push_tokens (token)
  `);
}
