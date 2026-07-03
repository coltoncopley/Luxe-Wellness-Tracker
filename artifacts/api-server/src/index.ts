import { runMigrations } from "stripe-replit-sync";
import app from "./app";
import { logger } from "./lib/logger";
import { getStripeSync } from "./lib/stripeClient";

async function initStripe(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for Stripe integration");
  }

  logger.info("Initializing Stripe schema...");
  await runMigrations({ databaseUrl });

  const stripeSync = await getStripeSync();

  const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
  const webhookResult = await stripeSync.findOrCreateManagedWebhook(
    `${webhookBaseUrl}/api/stripe/webhook`,
  );
  logger.info({ webhook: webhookResult?.url ?? "configured" }, "Stripe webhook configured");

  stripeSync
    .syncBackfill()
    .then(() => logger.info("Stripe data synced"))
    .catch((err: unknown) => logger.error({ err }, "Error syncing Stripe data"));
}

try {
  await initStripe();
} catch (err) {
  // Billing endpoints fail explicitly if Stripe is unavailable; don't take the whole app down.
  logger.error({ err }, "Failed to initialize Stripe");
}

if (process.env.NODE_ENV === "production") {
  // Bootstrap a fresh production environment: core catalog data (services,
  // staff, restaurants, rewards, access code) and the Stripe membership
  // product. Both are idempotent; failures are logged but non-fatal.
  import("@workspace/db")
    .then(({ seedCoreData }) => seedCoreData((msg) => logger.info(msg)))
    .then(() => logger.info("Core data seed check complete"))
    .catch((err: unknown) => logger.error({ err }, "Failed to seed core data"));

  import("./lib/billing")
    .then(({ ensureMembershipProduct }) => ensureMembershipProduct())
    .then(() => logger.info("Membership product ensured in Stripe"))
    .catch((err: unknown) => logger.error({ err }, "Failed to ensure membership product"));
}

import("./lib/notificationScheduler")
  .then(({ startNotificationScheduler }) => startNotificationScheduler())
  .catch((err: unknown) => logger.error({ err }, "Failed to start notification scheduler"));

import("./lib/engagementScheduler")
  .then(({ startEngagementScheduler }) => startEngagementScheduler())
  .catch((err: unknown) => logger.error({ err }, "Failed to start engagement scheduler"));

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
