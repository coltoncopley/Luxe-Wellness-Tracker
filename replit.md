# LUXE Wellness & Aesthetics Patient App

A patient companion app for LUXE Wellness and Aesthetics (physician-owned med spa in South Point, OH, run by Dr. Copley): service browsing with external booking deep-links, GLP-1 weight tracking with body measurements, and a restaurant food tracker with healthy ordering suggestions.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed` — seed services, staff, restaurants, menu items, tips (idempotent)
- `pnpm --filter @workspace/scripts run seed-membership` — seed the LUXE Membership product + $4.99/mo price in Stripe (idempotent)
- Required env: `DATABASE_URL` — Postgres connection string; Stripe keys come from the Replit Stripe connector (dev = test keys; live keys entered in the Publish pane for production)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Frontend: React + Vite (artifacts/luxe-wellness), wouter, TanStack Query, shadcn/ui, recharts
- AI: Replit AI Integrations OpenAI proxy (`lib/integrations-openai-ai-server`, gpt-5.4) — env vars AI_INTEGRATIONS_OPENAI_BASE_URL/API_KEY auto-provisioned, billed to Replit credits

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for the API contract
- `lib/db/src/schema/` — Drizzle tables: services.ts (services, staff), appointments.ts, tracking.ts (weight_entries, measurements, goals), food.ts (restaurants, menu_items, food_logs, tips), conversations.ts + messages.ts (Luxe AI chat), glow.ts (glow_checkins), rewards.ts (reward_events points ledger)
- `artifacts/api-server/src/routes/` — catalog.ts, appointments.ts, tracking.ts, food.ts (incl. POST /food/analyze-photo AI meal scanner), wellness.ts (tips, dashboard summary), openai.ts (Luxe AI chat: conversation CRUD + SSE streaming), glow.ts (Glow Score summary + check-in upsert), briefing.ts (GET /briefing morning briefing), rewards.ts (summary + redeem)
- `artifacts/api-server/src/lib/rewards.ts` — reward catalog, point values, award/redeem helpers
- `scripts/src/seed.ts` — seed data
- `artifacts/luxe-wellness/` — patient-facing web app (pages: /, /book, /weight, /food, /restaurants, /glow, /bhrt, /rewards, /luxe-ai, /staff)
- `attached_assets/brand/luxe_logo.jpeg` — brand logo
- Billing: `artifacts/api-server/src/lib/billing.ts` (price lookup, subscription reads from synced `stripe.subscriptions`), `src/middlewares/subscription.ts` (requireActiveSubscription), `src/routes/billing.ts` (/billing/status, /billing/checkout, /billing/portal), `artifacts/luxe-wellness/src/components/SubscriptionGate.tsx` (paywall)

## Architecture decisions

- Booking is external: bookingUrl fields deep-link to https://hklqy.myaestheticrecord.com/online-booking (Aesthetic Record); appointments are tracked manually in-app.
- Auth: Replit-managed Clerk (cookie-based on web — no Bearer token getter). Server: `@clerk/express` clerkMiddleware + proxy route mounted before body parsers in app.ts; `requireAuth` middleware upserts the user row from Clerk claims and sets `res.locals.userId`; `requireStaff` checks `users.role === 'staff'`. All patient data (appointments, tracking, food logs, glow, conversations, rewards) is user-scoped by `user_id`.
- Roles: everyone signs up as `patient`. Staff role self-activated via POST /api/me/staff-access with the access code stored in `app_settings` (key `staff_access_code`, seeded value `52K33Z`; rate-limited 5/min/IP). Staff see a "Staff Portal" nav item (/staff): tabs for code verification, service CRUD, restaurant/menu-item CRUD, reward item CRUD (toggle active = hide from patients), and a redemptions table with patient info. Redemption lookup/mark-used endpoints now require staff.
- Restaurant admin: POST/DELETE /api/admin/restaurants(/{id}) + POST /api/admin/restaurants/{id}/menu-items + DELETE /api/admin/menu-items/{id} (staff-gated via adminRouter; restaurant delete removes its menu items in a transaction). Staff Portal "Restaurants" tab: add/delete restaurants, expand a card to add/delete menu items (macros, healthy-pick toggle, ordering tip).
- Reward catalog moved from static code to `reward_items` table (admin-editable); seed script bootstraps the four original perks + the staff access code idempotently (runs even when other tables are already seeded).
- Frontend: ClerkProvider in App.tsx (publishableKeyFromHost + proxyUrl, wouter base-path-aware routerPush/routerReplace, branded appearance + shadcn theme, cssLayerName "clerk" with `@layer` order line at top of index.css, tailwindcss({ optimize: false }) in vite.config). Signed-out users on "/" get a public landing page (src/pages/landing.tsx); all app routes are wrapped in a Protected component that redirects signed-out users to "/"; privacy/terms/support stay public. Query cache is cleared on Clerk user change.
- Calendar dates stored as YYYY-MM-DD strings (`date(..., { mode: "string" })`).
- mealType values: breakfast/lunch/dinner/snack; measurement areas: waist/hips/arms/thighs/chest/neck.
- Goal is a singleton row, auto-created on first GET /api/goal.
- Luxe AI system prompt is built per-request from live services/staff DB rows; safety rules: no diagnosis, soft-sell only (max one treatment suggestion per reply), directs booking to the Aesthetic Record URL.
- Luxe AI is data-aware: buildUserContext(userId) in routes/openai.ts appends the requesting user's own data (weight trend, goal, 7-day food/glow summaries, next appointment) to the system prompt inside a `<patient_data>` block explicitly marked as data-not-instructions (prompt-injection hardening). Strictly user-scoped queries; context is never persisted to messages and never surfaced to staff.
- Chat streaming is SSE over POST; Orval can't type SSE, so the client uses raw fetch + ReadableStream (generated hooks for everything else).
- Glow Score computed server-side (0-100): water 15 + sleep 20 (7-9h full) + stress 15 (lower better) + activity 15 (30min full) + protein 20 (100g full) + skincare 15. One check-in per day (unique date, upsert); streak counts consecutive days back from today (or yesterday if today not yet logged).
- Meal scanner: client downscales photo to ≤1280px JPEG data URL; POST /api/food/analyze-photo uses gpt-5.4 vision (json_object), zod-parses estimate, 422 if not food. express.json limit is 15mb for this.
- Rewards: points ledger in reward_events (never mutated, balance = sum). Earning: glow check-in +20/day, weigh-in +10/day, food log +5 (cap 3/day), +50 per 7-day streak milestone, referral +100 (referrer) / +50 (new friend). Once-per-day and milestone awards are idempotent via unique dedupe_key (`type:date`, `glow_streak:N`); capped awards and redemptions use transactions with pg advisory locks to prevent races. Catalog is static in code.
- Referrals: `users.referral_code` (6-char unambiguous code, lazily generated on GET /api/referrals/summary with unique-retry) + `referrals` table (referred_user_id unique = one claim per user). Share link is app root + `?ref=CODE`; App.tsx captures the param to localStorage pre-auth, and ReferralClaimer (signed-in only) POSTs /api/referrals/claim once — server validates (not own code, account < 30 days old, not already referred), inserts referral + two reward_events (dedupe keys `referral:<referredUserId>` / `referral_welcome`) in a transaction with an advisory lock. Rewards page "Invite friends" card: native share sheet (clipboard fallback), copy link, QR dialog (qrcode.react). Referral data is patient-private (no staff endpoints).
- Friends (social): follows table (unique follower/followee pair, status pending|accepted), share_settings (shareGlow/shareWeightProgress/shareStreak, default true), cheers tables in lib/db/src/schema/social.ts. Routes in routes/social.ts, mounted requireAuth + requirePatient (staff are 403-blocked from ALL social endpoints — privacy constraint). Follow by friend's referral/invite code (no user directory); followee must accept; either party can remove. GET /friends/journeys returns only aggregates per accepted followee, gated by their share settings: streak, glow score today, check-ins last 7 days, weight progress % toward goal (never pounds), last check-in date. Cheers require an accepted follow; rate limits: follow requests 5/min (per IP+user), cheers 10/min + 5/day per sender→recipient. FollowRequestResult deliberately omits the friend's name (anti-enumeration). Frontend /friends page: requests approval, journey cards + cheer dialog (emoji + optional note), follow-by-code form, sharing toggles, connections lists.
- Monetization (Stripe): $4.99/mo "LUXE Membership" subscription, 7-day free trial with card upfront via Stripe Checkout (trial only for first-time subscribers; returning members resubscribe without trial, 409 if already active). `stripe-replit-sync` mirrors Stripe data into the `stripe` Postgres schema (webhook at /api/stripe/webhook mounted before body parsers; initStripe in index.ts is non-fatal on failure). `requireActiveSubscription` middleware (staff exempt, 402 code `membership_required`, 60s/5s in-memory cache) gates all premium routers (appointments, tracking, food, openai, glow, briefing, rewards, referrals, social) + wellness GET /dashboard/summary; /api/me and /api/billing/* stay ungated. Frontend SubscriptionGate wraps all signed-in routes: paywall with trial CTA → Checkout redirect; ?billing=success polls status up to 60s while webhook syncs; past_due → portal "Update payment method"; "Manage membership" (Stripe portal) in sidebar. Product/price seeded by scripts/src/seed-membership.ts (matched by name "LUXE Membership" + $4.99 USD monthly).
- Redemption codes: LUXE-XXXX-XXXX (8 chars, crypto-random, unambiguous alphabet, retry on unique collision), stored in `redemptions` table alongside the ledger row (same transaction). Staff verification page at /staff looks codes up (input normalized: case/dashes/prefix optional) and marks them used atomically (`UPDATE ... WHERE used_at IS NULL`; 409 if already used). Lookup/use endpoints are rate-limited in-memory (15/min/IP). No auth gate yet — pending the app-wide login decision.

## Product

- Home (V2): "Good morning, {name}" + Wellness Score (0-100: glow habits 40, meals logged 10, within calorie target 10, weigh-in 15, glow-streak consistency 25) + AI morning briefing (gpt-5.4, cached in-memory per user/day with in-flight dedup, null on failure) + today's to-do checklist + yesterday recap + stat cards + daily tip. GET /api/briefing, patient-private, privacy disclaimer in UI.
- V2 roadmap (user picked phased build, 2026-07): Phase 1 Home+Briefing DONE → Phase 2 data-aware Luxe AI DONE → next: missions/streaks/reward tiers → weekly AI skin scan. Wearables/community deferred (need native app / bigger lift).
- Book: browse services and team, deep-link out to Aesthetic Record, track appointments manually
- Weight: daily weigh-ins, body-area measurements, goal setting, progress chart
- Food: meal logging with macros, daily summary, restaurant menu search
- Restaurants: 18 local chains with calorie/macro data and healthy pick ordering tips; staff can add/remove restaurants and menu items from the Staff Portal. Seed is idempotent per-restaurant (by name), so re-running only adds missing ones.
- BHRT (/bhrt): static educational page on bioidentical hormone therapy following the Worldlink Medical / Neal Rouzier MD "Normal isn't optimal" philosophy — symptoms (women/men), hormones (estradiol, progesterone, testosterone, thyroid, DHEA), potential benefits, 4-step process, FAQ, booking CTA to Aesthetic Record. Content deliberately uses conditional, educational-only language (architect-reviewed for medical overclaiming — keep it that way when editing) with disclaimers under the hero and in the footer.
- Luxe AI: 24/7 streaming chat assistant grounded in LUXE's service catalog and team; GLP-1 coaching, skincare/treatment Q&A, gentle treatment suggestions
- Glow Score: daily habit check-in (water, sleep, stress, activity, protein, skincare) → one 0-100 score, streak tracking, 14-day trend chart
- Meal Scanner: photograph a meal on /food → AI estimates calories/macros → one-tap log
- Rewards: earn points for healthy habits, redeem for LUXE treatment perks on /rewards
- Friends (/friends): opt-in follow-by-invite-code with approval; see friends' journey highlights (streak, glow, % to goal) per their sharing toggles; send emoji cheers with optional notes
- Staff Verify (/staff): front desk enters a patient's LUXE code, sees the reward + status, marks it used (one-time use)
- Legal/support pages: /privacy, /terms, /support (linked from sidebar + mobile menu footer); App Store submission kit in exports/app-store/, marketing screenshots in screenshots/appstore/ (captured with temporary demo data, since removed)
- Accounts: patient sign-up/sign-in via Clerk (email + Google); staff unlock the Staff Portal with access code 52K33Z on /staff

## User preferences

- Patient health/tracking data must NEVER be visible to staff or "pushed to the med spa" — the owner explicitly wants to stay out of HIPAA territory. Staff may only see reward/redemption info (codes, reward titles, points). Wellness scores, briefings, weight, food, glow data are patient-private only. No provider dashboards over patient health data.

## Gotchas

- Facebook page (LUXE's social) cannot be fetched programmatically — blocked by scrapers.
- The Aesthetic Record services page is JS-rendered; service list was hand-curated in seed data.
- User attached a large vision doc (attached_assets/Pasted-Knowing-what-I-know-about-Luxe-Wellness-...txt) proposing a daily-engagement platform (Luxe AI chat, skin analysis, glow score, rewards). Discussed as future phases.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
