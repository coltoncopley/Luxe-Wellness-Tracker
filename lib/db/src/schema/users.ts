import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email"),
  firstName: text("first_name"),
  role: text("role").notNull().default("patient"),
  referralCode: text("referral_code").unique(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  compUntil: timestamp("comp_until", { withTimezone: true }),
  compLifetime: boolean("comp_lifetime").notNull().default(false),
  privacyAckAt: timestamp("privacy_ack_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect;

export const appSettingsTable = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
