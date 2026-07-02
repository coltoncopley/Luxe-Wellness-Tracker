import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { getUncachableStripeClient } from "./stripeClient";

export const MEMBERSHIP_PRICE_CENTS = 499;
export const MEMBERSHIP_PRODUCT_NAME = "LUXE Membership";
export const TRIAL_DAYS = 7;

const ACTIVE_STATUSES = new Set(["trialing", "active"]);

export interface SubscriptionInfo {
  id: string;
  status: string;
  trialEnd: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

function toDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value * 1000);
  if (typeof value === "string") {
    const asNumber = Number(value);
    if (!Number.isNaN(asNumber) && asNumber > 1_000_000_000 && asNumber < 10_000_000_000) {
      return new Date(asNumber * 1000);
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function rowToInfo(row: Record<string, unknown>): SubscriptionInfo {
  return {
    id: String(row["id"]),
    status: String(row["status"] ?? "canceled"),
    trialEnd: toDate(row["trial_end"]),
    currentPeriodEnd: toDate(row["current_period_end"]),
    cancelAtPeriodEnd: row["cancel_at_period_end"] === true,
  };
}

/**
 * Returns the most relevant subscription for a Stripe customer from the synced
 * stripe.subscriptions table: an active/trialing one if present, otherwise the
 * most recently created one. Returns null if the customer has none.
 */
export async function getSubscriptionForCustomer(
  customerId: string,
): Promise<SubscriptionInfo | null> {
  const result = await db.execute(
    sql`SELECT * FROM stripe.subscriptions WHERE customer = ${customerId} ORDER BY created DESC NULLS LAST LIMIT 20`,
  );
  const rows = result.rows as Array<Record<string, unknown>>;
  if (rows.length === 0) return null;
  const active = rows.find((r) => ACTIVE_STATUSES.has(String(r["status"])));
  return rowToInfo(active ?? rows[0]!);
}

export function isSubscriptionActive(sub: SubscriptionInfo | null): boolean {
  return sub !== null && ACTIVE_STATUSES.has(sub.status);
}

let cachedPriceId: string | null = null;

/**
 * Resolves the Stripe price ID for the LUXE Membership monthly plan.
 * Cached in memory after first lookup (price IDs are stable).
 */
export async function getMembershipPriceId(): Promise<string> {
  if (cachedPriceId) return cachedPriceId;
  const stripe = await getUncachableStripeClient();
  const products = await stripe.products.search({
    query: `name:'${MEMBERSHIP_PRODUCT_NAME}' AND active:'true'`,
  });
  const product = products.data[0];
  if (!product) {
    throw new Error(
      `${MEMBERSHIP_PRODUCT_NAME} product not found in Stripe. Run the seed-membership script.`,
    );
  }
  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
  const monthly = prices.data.find(
    (p) =>
      p.recurring?.interval === "month" &&
      p.unit_amount === MEMBERSHIP_PRICE_CENTS &&
      p.currency === "usd",
  );
  if (!monthly) {
    throw new Error(
      `${MEMBERSHIP_PRODUCT_NAME} monthly price not found in Stripe. Run the seed-membership script.`,
    );
  }
  cachedPriceId = monthly.id;
  return cachedPriceId;
}
