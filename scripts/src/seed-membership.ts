import { getUncachableStripeClient } from "./stripeClient";

/**
 * Creates the LUXE Membership product and $4.99/month price in Stripe.
 * Idempotent: safe to run multiple times.
 *
 * Run with: pnpm --filter @workspace/scripts exec tsx src/seed-membership.ts
 */
async function seedMembership(): Promise<void> {
  const stripe = await getUncachableStripeClient();

  console.log("Checking for existing LUXE Membership product...");
  const existing = await stripe.products.search({
    query: "name:'LUXE Membership' AND active:'true'",
  });

  let productId: string;
  if (existing.data.length > 0) {
    productId = existing.data[0]!.id;
    console.log(`LUXE Membership product already exists: ${productId}`);
  } else {
    const product = await stripe.products.create({
      name: "LUXE Membership",
      description:
        "Full access to the LUXE Wellness patient app: Luxe AI coach, weight & glow tracking, meal scanner, rewards, and friends. 7-day free trial, then $4.99/month.",
      metadata: { app: "luxe-wellness", tier: "membership" },
    });
    productId = product.id;
    console.log(`Created product: ${product.name} (${productId})`);
  }

  const prices = await stripe.prices.list({ product: productId, active: true, limit: 10 });
  const monthly = prices.data.find(
    (p) => p.recurring?.interval === "month" && p.unit_amount === 499 && p.currency === "usd",
  );

  if (monthly) {
    console.log(`Monthly price already exists: ${monthly.id}`);
  } else {
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: 499,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { app: "luxe-wellness" },
    });
    console.log(`Created monthly price: $4.99/month (${price.id})`);
  }

  console.log("Done. Webhooks/backfill will sync this data to the database.");
}

seedMembership().catch((err) => {
  console.error("Error seeding membership:", err instanceof Error ? err.message : err);
  process.exit(1);
});
