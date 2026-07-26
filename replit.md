# LUXE Wellness & Aesthetics Patient App

Patient companion app for LUXE Wellness and Aesthetics (physician-owned med spa in South Point, OH, run by Dr. Copley — he/him, male pronouns in all copy and AI prompts). Daily-engagement wellness platform: service browsing with external booking, weight tracking, food/restaurant tracking, AI chat, habit scores, rewards, and social features — all behind a $4.99/mo membership.

## Non-negotiable rules

- **Privacy (owner's hard constraint):** patient health/tracking data must NEVER be visible to staff/admin or "pushed to the med spa" — the owner explicitly wants to stay out of HIPAA territory. Staff may only see reward/redemption info (codes, reward titles, points) and name/email on redemptions + comp grants + access codes. Weight, food, glow, mind, photos, scans, chats, briefings, referrals, social data are patient-private. No provider dashboards over patient health data. Staff/admin MAY use the self-tracking features on their OWN data (owner-approved 2026-07): all tracking routes are strictly user_id-scoped, so `requirePatient` now guards only the social surfaces (`/follows`, `/friends`, `/social`, `/cheers`, `/community` in routes/index.ts patientOnlyPaths) where patient-shared data could leak to staff. Admin Insights returns aggregates only.
- **Medical safety language:** Luxe AI, Skin Scan, Product Scan (skincare label evaluator), and the BHRT page use conditional, educational-only language — no diagnosis, at most one soft-sell treatment suggestion, doctor-deferral on pregnancy notes (`enforceSafetyLanguage` in ingredients route is deterministic server-side — keep it). Mind page disclaimer keeps the 988 crisis line ("self-care, not mental health care"). All architect-reviewed; keep this framing when editing.
- **Privacy copy accuracy:** Privacy page/dialog say the office cannot see app data — never overclaim. Staff DO see name/email on redemptions and comps; community `user_id` IS stored (copy says "never shown", not "never stored").
- **Security patterns to keep** (architect-required; details in `.agents/memory/code-endpoint-hardening.md`): rate limits + coarse errors on all code-accepting endpoints; ownership binding on presigned upload registration (`/objects/uploads/<currentUserId>/<uuid>` check in POST /api/photos); push subscribe returns 409 on foreign endpoint (never transfers ownership); dedupe/advisory-lock idempotency on anything awarding points.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server
- `pnpm run typecheck` — full typecheck; `pnpm run build` — typecheck + build
- `pnpm --filter @workspace/api-spec run codegen` — regenerate hooks/Zod from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema (dev only)
- `pnpm --filter @workspace/scripts run seed` — seed services/staff/restaurants/rewards/access code (idempotent)
- `pnpm --filter @workspace/scripts run seed-membership` — seed Stripe product/price (idempotent)
- Env: `DATABASE_URL`; Stripe keys via Replit Stripe connector (dev = test; live keys in Publish pane); Resend via connector; optional `NOTIFICATION_FROM_EMAIL`; `SPOONACULAR_API_KEY` for chain search; optional `INSTACART_API_KEY` for shopping-list handoff (dev key works against Instacart's dev server; production also needs `INSTACART_API_URL=https://connect.instacart.com` + an approved production key); optional `KROGER_CLIENT_ID` + `KROGER_CLIENT_SECRET` for send-to-Kroger-cart (free at developer.kroger.com; must be PRODUCTION-environment keys — certification keys are auto-detected via a live probe and the feature stays hidden; register BOTH redirect URIs on the production app — dev `https://<dev-domain>/api/kroger/callback` and prod `https://<prod-domain>/api/kroger/callback` — and set `KROGER_REDIRECT_URI` to the prod one in deployment secrets)
- Production: deploy target `vm` (schedulers need always-on); API server self-seeds on startup (see `docs/architecture.md` → Production bootstrap)

## Stack & layout

- pnpm workspaces, Node 24, TS 5.9. API: Express 5. DB: Postgres + Drizzle. Zod (`zod/v4`). Orval codegen from `lib/api-spec/openapi.yaml` (source of truth). Frontend: React + Vite (artifacts/luxe-wellness), wouter, TanStack Query, shadcn/ui, recharts. Mobile: Expo (artifacts/luxe-mobile). AI: Replit AI Integrations — Grok 4.5 via OpenRouter proxy (`x-ai/grok-4.5`, `lib/integrations-openrouter-ai`) for ALL AI features (chat, briefing, reports, meal plans, photo/skin/product scans, admin tip drafts); EXCEPTION: web-search-grounded calls (restaurant menu/discovery `responses.create` in routes/food.ts, enrich-menus + gen-menus scripts) stay on the OpenAI proxy (gpt-5.4, `lib/integrations-openai-ai-server`) — OpenRouter AI Integrations supports chat completions only, no responses API/web_search.
- Schemas in `lib/db/src/schema/`, routes in `artifacts/api-server/src/routes/`, seed in `scripts/src/seed.ts`, logo at `attached_assets/brand/luxe_logo.jpeg`. File names map 1:1 to features — grep is reliable.

## Architecture (summary — full detail in `docs/architecture.md`)

- **Booking is external:** deep-links to Aesthetic Record; appointments tracked manually in-app.
- **Auth:** Replit-managed Clerk — cookie-based on web (never add Bearer getters there), Bearer tokens on mobile. `requireAuth` upserts the user row; all patient data user_id-scoped. One-email-one-account guard (403 `email_already_registered`).
- **Roles:** patient | staff | admin. Staff activation via shared code or one-time `LWS-` codes (single-use, FOR UPDATE locking); admin bootstrap by email. `requireStaff` / `requirePatient` / `requireAdmin`; Staff Portal at /staff.
- **Monetization (Stripe):** $4.99/mo membership, 30-day first-time trial, `requireActiveSubscription` (402) gates premium routers; staff/admin/comp exempt. 7-day past-due grace after a failed renewal (`pastDueGraceUntil`, `graceUntil` in billing status, amber banner on web). Billing mutations query Stripe live; mirror tables read-only. Comps with provenance (`comp_source`) + one-time `LW-` membership access codes.
- **Rewards:** append-only `reward_events` ledger; all awards idempotent (dedupe keys + advisory locks); `LUXE-` redemption codes atomic + rate-limited.
- **Luxe AI:** per-request prompt from live data; user data in `<patient_data>` marked data-not-instructions; never persisted, never shown to staff. SSE over POST via raw fetch (Orval can't type SSE).
- **Notifications:** strict opt-in (both channels default OFF), `notification_sends` at-most-once ledger, node-cron ET schedulers, generic-nudge content only.
- **Conventions:** dates are YYYY-MM-DD strings; mealType breakfast/lunch/dinner/snack; measurement areas waist/hips/arms/thighs/chest/neck; goal is a singleton auto-created on first GET.

## Product (summary — full detail in `docs/features.md`, mobile in `docs/mobile.md`)

- **Web pages:** Home (Wellness Score + "consistency score" qualifier, "Today at LUXE" daily-loop card, AI briefing, offers, doctor tips, streak card) • Book • Weight • Food (meal logs, AI meal-photo scanner, quick-add search, Spoonacular chain search, Open Food Facts barcode scanner) • Restaurants/Dining Out Guide (18 curated menus + patient-added AI-grounded menus, DoorDash deep-links) • Glow • Mind (988 disclaimer) • Activity & Sleep (Oura sync, phone steps) • Workouts (Fitbod-style: set/rep/weight logging, 99-exercise library + patient-added private custom lifts (nullable `exercises.ownerUserId`; `visibleExercises()`-scoped so they work in workouts/sets/suggestions like library exercises but never leak across users; auto-found how-to video; owner-only delete, 409 if in-use), 72h muscle recovery, progressive-overload suggestions, AI workout generation 3/day with a pre-gen questionnaire — body-area focus/duration/energy/work-arounds, all transient per-generation — per-exercise "Watch how-to" built-in embedded video player (curated YouTube demo per exercise via `exercises.how_to_video_id`, always with a YouTube-search fallback link), 25 pts once/day on completion, counts toward streak, completing auto-mirrors a "strength" entry into Activity & Sleep — idempotent, no extra points, removed on workout delete) • Luxe AI chat • Rewards (missions, tiers, referrals) • Progress Photos • Skin Scan • Product Scan • Skincare Routine `/routine` (AM/PM product lists, daily check-off, mirrors glow skincare habit — no extra points) • Beauty Passport • Friends (opt-in sharing) • Community (anonymous wins + monthly challenges) • My Journey • Weekly Report (AI recap of last week) • Meal Plan (AI 7-day plan, 2 generations/week) • Notification settings + birthday • BHRT • Staff Portal `/staff` • Legal `/privacy` `/terms` `/support`. Privacy acknowledgment dialog forced on first sign-in (Me schema requires `privacyAcknowledged`).
- **Retention features (2026-07):** streaks (live-computed, once-ever milestone points `streak:<days>`), My Journey recap, weekly AI report (`weekly_reports`, lazy + cached per week), monthly community challenges (`challenges`/`challenge_participants`, own-logs progress only, award dedupe `challenge:<key>:<month>`), AI meal plan (`meal_plans`, max 2/week, in-flight dedupe; tap-a-meal cached recipes + legacy-plan ingredient backfill). All patient-private; detail in `docs/features.md` → Retention features.
- **Onboarding + daily loop (2026-07):** 2-min onboarding wizard (goal + daily actions → `users.primary_goal`/`daily_actions`/`onboarded_at`; POST /me/onboarding auth-only NOT premium, +50 pts `welcome:once`; web full-screen takeover, mobile gate slot) and "Today at LUXE" daily loop (GET /today checklist computed live from chosen actions, POST /today/complete server-verified +20 pts/day dedupe `daily_loop:<date>`). Detail in `docs/features.md` → Onboarding, Today at LUXE & Skincare Routine.
- **Mobile app** (`artifacts/luxe-mobile`, Expo): patient-only, full web parity — 5 tabs + Explore grid. Key rules: Apple 3.1.1 Netflix model (no IAP or purchase links); `Alert` from `@/lib/alert` (RN Alert is a no-op on web); theme tokens via `useColors()` (no hardcoded hex); gate order privacy ack → onboarding wizard → membership.

## Gotchas

- **Mobile fix delivery:** the owner's phone runs the installed TestFlight/App Store build with NO expo-updates/OTA — code changes to `luxe-mobile` do NOT reach the device until a new EAS build is submitted. Server-side changes need a production republish too. Never tell the owner a mobile fix is live until both have shipped; "still broken" reports minutes after a fix usually mean the old build, not a failed fix.
- Facebook page can't be fetched programmatically (scraper-blocked); Aesthetic Record services page is JS-rendered — service list hand-curated in seed.
- V2 roadmap phases 1-4 (Home+Briefing, data-aware AI, missions/photos, skin scan) all DONE (2026-07). Wearables deferred (need native app). Original vision doc in attached_assets/.

## Pointers

- `docs/architecture.md` — auth, roles, monetization, rewards, AI, notifications detail
- `docs/features.md` — per-page web feature detail • `docs/mobile.md` — mobile app detail
- `pnpm-workspace` skill — workspace structure, TS setup, codegen details
- `.agents/memory/` — durable security/review lessons (endpoint hardening, Stripe mirror quirks, Orval/Clerk quirks)
