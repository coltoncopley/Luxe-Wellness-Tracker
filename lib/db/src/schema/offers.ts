import { pgTable, serial, text, timestamp, boolean, integer, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Limited-time offers created by staff. Patients claim an active offer once,
 * receiving a one-time claim code they show at the front desk. Staff verify
 * and redeem claim codes in the Staff Portal (name/email on claims is allowed
 * under the privacy rules, same as reward redemptions).
 */
export const offersTable = pgTable("offers", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  active: boolean("active").notNull().default(true),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Offer = typeof offersTable.$inferSelect;

export const offerClaimsTable = pgTable(
  "offer_claims",
  {
    id: serial("id").primaryKey(),
    offerId: integer("offer_id").notNull(),
    userId: text("user_id").notNull(),
    code: text("code").notNull().unique(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull().defaultNow(),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
    redeemedBy: text("redeemed_by"),
  },
  (table) => [uniqueIndex("offer_claims_offer_user_unique").on(table.offerId, table.userId)],
);

export type OfferClaim = typeof offerClaimsTable.$inferSelect;
