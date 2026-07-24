# Architecture reference

Detailed architecture decisions for the LUXE patient app. The always-loaded summary lives in `replit.md`; this file holds the full detail. Keep both in sync when changing any of these systems.

## Booking (external)

Deep-links to https://hklqy.myaestheticrecord.com/online-booking (Aesthetic Record); appointments tracked manually in-app. The Aesthetic Record services page is JS-rendered, so the service list is hand-curated in seed.

## Auth (Replit-managed Clerk)

- Cookie-based on web (no Bearer token getter). `@clerk/express` middleware + proxy route mounted before body parsers.
- `requireAuth` upserts the user row and sets `res.locals.userId`; all patient data is user-scoped by `user_id`.
- **One-email-one-account guard:** a brand-new Clerk identity whose email (case-insensitive) already belongs to an existing users row is rejected with 403 `email_already_registered` (no row created); existing rows are never blocked. Web (SubscriptionGate) and mobile (tabs Gate) show a "sign in the way you originally signed up" screen with Sign out.
- Frontend: ClerkProvider with publishableKeyFromHost + proxyUrl, cssLayerName "clerk"; public landing for signed-out users; app routes wrapped in Protected; query cache cleared on user change.

## Roles: patient | staff | admin

- Staff activation (POST /me/staff-access, rate-limited, single input, coarse 403 on all failures) accepts EITHER the shared access code (app_settings `staff_access_code`, seeded `LW45680`, admin-rotatable — kept as the admin-bootstrap/recovery path) OR a one-time per-person staff code (`staff_codes` table, `LWS-XXXX-XXXX`, admin-generated in Staff Portal → Admin → "One-time staff codes"; strictly single-use: code row + user row locked FOR UPDATE, re-checked in-tx; grants staff only; unredeemed codes cancellable; redeemed codes 409 — demote via role mgmt instead).
- Already-staff users short-circuit BEFORE any code lookup so codes are never consumed needlessly; `clearSubscriptionCache` after every role grant.
- Admin bootstrap via `admin_bootstrap_email` (seeded coltoncopley@gmail.com) — matching email entering either code kind becomes admin.
- `requireStaff` = staff||admin; `requirePatient` blocks both; `requireAdmin` for admin-only (staff mgmt, access-code change, metrics). Last-admin demotion + self-role-change blocked.
- Staff Portal (/staff): redemption verify, service/restaurant/menu/reward CRUD, announcements, comps, community moderation; Admin tab + Insights for admins.

## Monetization (Stripe)

- $4.99/mo "LUXE Membership", 30-day trial (first-time only, card upfront, Checkout). `stripe-replit-sync` mirrors into `stripe` schema (webhook before body parsers; init non-fatal).
- `requireActiveSubscription` (402 `membership_required`, staff/admin/comp exempt, short cache) gates all premium routers; /api/me, /api/billing/*, announcements, notifications stay ungated.
- **Past-due grace (owner-chosen, 2026-07):** a failed renewal keeps access for `PAST_DUE_GRACE_DAYS` (7) after the unpaid period starts (`pastDueGraceUntil` in lib/billing.ts uses mirror `current_period_start`; no timestamp → no grace). Billing status exposes nullable `graceUntil`; web gate shows an amber "update payment" banner during grace, mobile gate just allows access. Access ends when grace lapses or Stripe cancels after final retry. Resubscribing/fixing the card restores everything — all data, points, streaks live on the user row, never deleted on lapse.
- SubscriptionGate paywall on frontend; billing mutations query Stripe live, mirror tables are read-only.
- Comps: `users.comp_until`/`comp_lifetime`, granted by email in Staff Portal; `users.comp_source` records provenance ("manual" vs `code:<id>`) so code revocation never clobbers a manual grant. Promo codes via Stripe dashboard (Checkout has allow_promotion_codes).
- **Membership access codes** (`membership_codes` table, Staff Portal "Codes" tab, paywall "Have an access code?"): one-time codes `LW-XXXX-XXXX`; staff generate 6-month codes, admin also unlimited (lifetime); strictly single-use (code row + user row locked FOR UPDATE, eligibility re-checked in-transaction, full comp state written per kind); redemption rate-limited with coarse errors, staff/admin and users with active comp blocked; admin-only revoke clears the redeemer's comp only when compSource matches that exact code; tracks creator/redeemer name+email (allowed under privacy rules).

## Rewards

Append-only `reward_events` ledger (balance = sum). All awards idempotent via unique `(user_id, dedupe_key)` patterns + advisory-lock transactions for caps/redemptions. Catalog in admin-editable `reward_items` table. Redemption codes LUXE-XXXX-XXXX, atomic mark-used, rate-limited lookup.

## Luxe AI

System prompt built per-request from live services/staff rows + user's own data in a `<patient_data>` block marked data-not-instructions (prompt-injection hardening); context never persisted, never shown to staff. SSE over POST — client uses raw fetch + ReadableStream (Orval can't type SSE); generated hooks everywhere else.

## Notifications (strict opt-in)

- Web push (VAPID keys lazily generated → app_settings) + email via Resend connector (from `NOTIFICATION_FROM_EMAIL` or onboarding@resend.dev — Resend only delivers to the account owner's email until a domain is verified).
- `notification_prefs` defaults both channels OFF. `notification_sends` = at-most-once ledger.
- Scheduler (node-cron, ET): habit reminder 10:00, passport touch-up reminders 11:00 (3-day catch-up window, dedupe `passport_reminder:<entryId>:<date>`), streak alert 19:00, weekly summary Sun 17:00.
- Content is generic nudges only — no health details (touch-up reminder includes the patient's own treatment title, sent only to that patient via their opted-in channels). Routes requireAuth but NOT premium-gated.

## Conventions

- Calendar dates are YYYY-MM-DD strings (`date(..., { mode: "string" })`).
- mealType: breakfast/lunch/dinner/snack. Measurement areas: waist/hips/arms/thighs/chest/neck.
- Goal is a singleton row auto-created on first GET.

## Production bootstrap

Deployment target is `vm` (node-cron schedulers need always-on). On startup with NODE_ENV=production, the API server runs `seedCoreData` (from `@workspace/db`, advisory-lock + single-transaction, component-wise idempotent) and `ensureMembershipProduct` (creates LUXE Membership product/price in live Stripe, advisory-lock + Stripe idempotency keys) — both non-fatal. Prod DB schema is applied by Replit's Publish flow automatically.
