---
name: Stripe sync mirror quirks
description: Gotchas with stripe-replit-sync (mirror lag, migrations) and the live-vs-mirror rule for billing decisions
---

## Billing mutations must use live Stripe, not the mirror

The `stripe` Postgres schema populated by `stripe-replit-sync` is eventually consistent (webhook-driven, lags seconds behind Stripe).

**Rule:** use the mirror only for fast reads (status display, access gating middleware). Any decision that creates or changes billing state — "already subscribed?" checks before checkout, trial eligibility, duplicate prevention — must query the Stripe API directly (`stripe.subscriptions.list`).

**Why:** architect review failed the first version for exactly this — in the lag window a user could open a second checkout and end up with duplicate subscriptions or a repeated free trial. Pair the live check with a per-user in-flight lock on checkout creation.

## runMigrations can silently produce zero tables

`runMigrations({ databaseUrl })` completed without error during server startup yet left the `stripe` schema empty (schema existed, 0 tables), which made `findOrCreateManagedWebhook` fail with `relation "stripe.accounts" does not exist`.

**How to apply:** after first Stripe setup, verify with `SELECT count(*) FROM information_schema.tables WHERE table_schema='stripe'` (expect ~29). If empty, run migrations once manually via a small node script (`require('stripe-replit-sync').runMigrations(...)`) — that worked immediately — then restart the server.
