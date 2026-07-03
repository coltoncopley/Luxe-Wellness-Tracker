# LUXE Wellness & Aesthetics Patient App

Patient companion app for LUXE Wellness and Aesthetics (physician-owned med spa in South Point, OH, run by Dr. Copley). Daily-engagement wellness platform: service browsing with external booking, GLP-1 weight tracking, food/restaurant tracking, AI chat, habit scores, rewards, and social features — all behind a $4.99/mo membership.

## Non-negotiable rules

- **Privacy (owner's hard constraint):** patient health/tracking data must NEVER be visible to staff/admin or "pushed to the med spa" — the owner explicitly wants to stay out of HIPAA territory. Staff may only see reward/redemption info (codes, reward titles, points) and name/email on redemptions + comp grants. Weight, food, glow, mind, photos, scans, chats, briefings, referrals, social data are patient-private. No provider dashboards over patient health data. Patient-data routes use `requirePatient` (staff/admin get 403), and Admin Insights returns aggregates only.
- **Medical safety language:** Luxe AI, Skin Scan, Ingredient Scanner, and the BHRT page use conditional, educational-only language — no diagnosis, at most one soft-sell treatment suggestion, doctor-deferral on pregnancy notes (`enforceSafetyLanguage` in ingredients route is deterministic server-side — keep it). Mind page disclaimer keeps the 988 crisis line ("self-care, not mental health care"). All architect-reviewed; keep this framing when editing.
- **Privacy copy accuracy:** Privacy page/dialog say the office cannot see app data — never overclaim. Staff DO see name/email on redemptions and comps; community `user_id` IS stored (copy says "never shown", not "never stored").
- **Security patterns to keep** (architect-required; details in `.agents/memory/code-endpoint-hardening.md`): rate limits + coarse errors on all code-accepting endpoints; ownership binding on presigned upload registration (`/objects/uploads/<currentUserId>/<uuid>` check in POST /api/photos); push subscribe returns 409 on foreign endpoint (never transfers ownership); dedupe/advisory-lock idempotency on anything awarding points.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server
- `pnpm run typecheck` — full typecheck; `pnpm run build` — typecheck + build
- `pnpm --filter @workspace/api-spec run codegen` — regenerate hooks/Zod from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema (dev only)
- `pnpm --filter @workspace/scripts run seed` — seed services/staff/restaurants/rewards/access code (idempotent)
- `pnpm --filter @workspace/scripts run seed-membership` — seed Stripe product/price (idempotent)
- Env: `DATABASE_URL`; Stripe keys via Replit Stripe connector (dev = test; live keys in Publish pane); Resend via connector; optional `NOTIFICATION_FROM_EMAIL`

## Stack & layout

- pnpm workspaces, Node 24, TS 5.9. API: Express 5. DB: Postgres + Drizzle. Zod (`zod/v4`). Orval codegen from `lib/api-spec/openapi.yaml` (source of truth). Frontend: React + Vite (artifacts/luxe-wellness), wouter, TanStack Query, shadcn/ui, recharts. AI: Replit AI Integrations OpenAI proxy (gpt-5.4, `lib/integrations-openai-ai-server`).
- Schemas in `lib/db/src/schema/`, routes in `artifacts/api-server/src/routes/`, seed in `scripts/src/seed.ts`, logo at `attached_assets/brand/luxe_logo.jpeg`. File names map 1:1 to features — grep is reliable.

## Architecture decisions

- **Booking is external:** deep-links to https://hklqy.myaestheticrecord.com/online-booking (Aesthetic Record); appointments tracked manually in-app.
- **Auth:** Replit-managed Clerk, cookie-based on web (no Bearer token getter). `@clerk/express` middleware + proxy route mounted before body parsers. `requireAuth` upserts user row and sets `res.locals.userId`; all patient data user-scoped by `user_id`. Frontend: ClerkProvider with publishableKeyFromHost + proxyUrl, cssLayerName "clerk"; public landing for signed-out users; app routes wrapped in Protected; query cache cleared on user change.
- **Roles:** patient | staff | admin. Staff self-activate via access code (app_settings `staff_access_code`, seeded `LW45680`, rate-limited); admin bootstrap via `admin_bootstrap_email` (seeded coltoncopley@gmail.com) — matching email entering the code becomes admin. `requireStaff` = staff||admin; `requirePatient` blocks both; `requireAdmin` for admin-only (staff mgmt, access-code change, metrics). Last-admin demotion + self-role-change blocked. Staff Portal (/staff): redemption verify, service/restaurant/menu/reward CRUD, announcements, comps, community moderation; Admin tab + Insights for admins.
- **Monetization (Stripe):** $4.99/mo "LUXE Membership", 30-day trial (first-time only, card upfront, Checkout). `stripe-replit-sync` mirrors into `stripe` schema (webhook before body parsers; init non-fatal). `requireActiveSubscription` (402 `membership_required`, staff/admin/comp exempt, short cache) gates all premium routers; /api/me, /api/billing/*, announcements, notifications stay ungated. SubscriptionGate paywall on frontend; billing mutations query Stripe live, mirror tables are read-only. Comps: `users.comp_until`/`comp_lifetime`, granted by email in Staff Portal. Promo codes via Stripe dashboard (Checkout has allow_promotion_codes).
- **Rewards:** append-only `reward_events` ledger (balance = sum). All awards idempotent via unique `(user_id, dedupe_key)` patterns + advisory-lock transactions for caps/redemptions. Catalog in admin-editable `reward_items` table. Redemption codes LUXE-XXXX-XXXX, atomic mark-used, rate-limited lookup.
- **Luxe AI:** system prompt built per-request from live services/staff rows + user's own data in a `<patient_data>` block marked data-not-instructions (prompt-injection hardening); context never persisted, never shown to staff. SSE over POST — client uses raw fetch + ReadableStream (Orval can't type SSE); generated hooks everywhere else.
- **Conventions:** calendar dates are YYYY-MM-DD strings (`date(..., { mode: "string" })`); mealType breakfast/lunch/dinner/snack; measurement areas waist/hips/arms/thighs/chest/neck; goal is a singleton row auto-created on first GET.
- **Notifications (strict opt-in):** web push (VAPID keys lazily generated → app_settings) + email via Resend connector (from `NOTIFICATION_FROM_EMAIL` or onboarding@resend.dev — Resend only delivers to the account owner's email until a domain is verified). `notification_prefs` defaults both channels OFF. `notification_sends` = at-most-once ledger. Scheduler (node-cron, ET): habit reminder 10:00, passport touch-up reminders 11:00 (3-day catch-up window, dedupe `passport_reminder:<entryId>:<date>`), streak alert 19:00, weekly summary Sun 17:00. Content is generic nudges only — no health details (touch-up reminder includes the patient's own treatment title, sent only to that patient via their opted-in channels). Routes requireAuth but NOT premium-gated.

## Product (pages)

- **Home** `/`: greeting, Wellness Score, AI morning briefing (cached per user/day), to-do checklist, recap, announcements card
- **Book** `/book`: services + team, deep-link out, manual appointment tracking
- **Weight** `/weight`: weigh-ins, measurements, goal, chart • **Food** `/food`: meal logs + macros, AI meal-photo scanner • **Restaurants**: 18 local chains with healthy-pick tips (staff-editable)
- **Glow** `/glow`: daily habit check-in → 0-100 score, streak, trend • **Mind** `/mind`: daily mood check-in → Calm Score, journal/gratitude (never fed to Luxe AI, staff 403-blocked), breathing exercise
- **Luxe AI** `/luxe-ai`: streaming chat, GLP-1 coaching, treatment Q&A
- **Rewards** `/rewards`: points for habits, redeem for treatment perks; weekly missions (auto-award, Monday weeks) + lifetime tiers (Bronze/Silver/Gold/Platinum); referral invite card (share link `?ref=CODE`, QR)
- **Progress Photos** `/photos`: private before/after journal via App Storage presigned uploads • **Skin Scan** `/skin`: weekly AI selfie scan, 5 cosmetic scores • **Ingredient Scanner** `/ingredients`: label photo → verdict + concerns
- **Beauty Passport** `/passport`: self-entered lifetime treatment record (deliberately NO points — ungameable); optional touch-up reminders per entry (suggested intervals by type, editable, bell toggle); printable one-page summary (window.print + `.print-only` CSS, self-reported disclaimer); passport profile + last 10 entries feed Luxe AI context (sanitized free text)
- **Friends** `/friends`: follow-by-invite-code with approval; aggregates only per share settings (% to goal, never pounds); emoji cheers • **Community** `/community`: anonymous wins wall (no author identity anywhere, 3 posts/day cap, staff moderate content only)
- **Notifications** `/settings`: push/email opt-in, topic toggles, test send
- **BHRT** `/bhrt`: static educational page (Worldlink/Rouzier "Normal isn't optimal" framing, disclaimers)
- **Staff Portal** `/staff` • Legal: /privacy, /terms, /support • Privacy acknowledgment dialog forced on first sign-in (`users.privacy_ack_at`; Me schema requires `privacyAcknowledged` — any Me-shaped response must include it)
- App Store submission kit in exports/app-store/, screenshots in screenshots/appstore/

## Gotchas

- Facebook page can't be fetched programmatically (scraper-blocked); Aesthetic Record services page is JS-rendered — service list hand-curated in seed.
- V2 roadmap phases 1-4 (Home+Briefing, data-aware AI, missions/photos, skin scan) all DONE (2026-07). Wearables deferred (need native app). Original vision doc in attached_assets/.

## Pointers

- `pnpm-workspace` skill — workspace structure, TS setup, codegen details
- `.agents/memory/` — durable security/review lessons (endpoint hardening, Stripe mirror quirks, Orval/Clerk quirks)
