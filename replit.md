# LUXE Wellness & Aesthetics Patient App

A patient companion app for LUXE Wellness and Aesthetics (physician-owned med spa in South Point, OH, run by Dr. Copley): service browsing with external booking deep-links, GLP-1 weight tracking with body measurements, and a restaurant food tracker with healthy ordering suggestions.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed` — seed services, staff, restaurants, menu items, tips (idempotent)
- Required env: `DATABASE_URL` — Postgres connection string

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
- `artifacts/api-server/src/routes/` — catalog.ts, appointments.ts, tracking.ts, food.ts (incl. POST /food/analyze-photo AI meal scanner), wellness.ts (tips, dashboard summary), openai.ts (Luxe AI chat: conversation CRUD + SSE streaming), glow.ts (Glow Score summary + check-in upsert), rewards.ts (summary + redeem)
- `artifacts/api-server/src/lib/rewards.ts` — reward catalog, point values, award/redeem helpers
- `scripts/src/seed.ts` — seed data
- `artifacts/luxe-wellness/` — patient-facing web app (pages: /, /book, /weight, /food, /restaurants, /glow, /rewards, /luxe-ai)
- `attached_assets/brand/luxe_logo.jpeg` — brand logo

## Architecture decisions

- Booking is external: bookingUrl fields deep-link to https://hklqy.myaestheticrecord.com/online-booking (Aesthetic Record); appointments are tracked manually in-app.
- Single-user app, no auth (first build).
- Calendar dates stored as YYYY-MM-DD strings (`date(..., { mode: "string" })`).
- mealType values: breakfast/lunch/dinner/snack; measurement areas: waist/hips/arms/thighs/chest/neck.
- Goal is a singleton row, auto-created on first GET /api/goal.
- Luxe AI system prompt is built per-request from live services/staff DB rows; safety rules: no diagnosis, soft-sell only (max one treatment suggestion per reply), directs booking to the Aesthetic Record URL.
- Chat streaming is SSE over POST; Orval can't type SSE, so the client uses raw fetch + ReadableStream (generated hooks for everything else).
- Glow Score computed server-side (0-100): water 15 + sleep 20 (7-9h full) + stress 15 (lower better) + activity 15 (30min full) + protein 20 (100g full) + skincare 15. One check-in per day (unique date, upsert); streak counts consecutive days back from today (or yesterday if today not yet logged).
- Meal scanner: client downscales photo to ≤1280px JPEG data URL; POST /api/food/analyze-photo uses gpt-5.4 vision (json_object), zod-parses estimate, 422 if not food. express.json limit is 15mb for this.
- Rewards: points ledger in reward_events (never mutated, balance = sum). Earning: glow check-in +20/day, weigh-in +10/day, food log +5 (cap 3/day), +50 per 7-day streak milestone. Once-per-day and milestone awards are idempotent via unique dedupe_key (`type:date`, `glow_streak:N`); capped awards and redemptions use transactions with pg advisory locks to prevent races. Catalog is static in code; redeem returns a LUXE-XXXX code to mention at the front desk.

## Product

- Dashboard: weight snapshot, calories today vs target, logging streak, next appointment, daily tip
- Book: browse services and team, deep-link out to Aesthetic Record, track appointments manually
- Weight: daily weigh-ins, body-area measurements, goal setting, progress chart
- Food: meal logging with macros, daily summary, restaurant menu search
- Restaurants: local chains with calorie/macro data and healthy pick ordering tips
- Luxe AI: 24/7 streaming chat assistant grounded in LUXE's service catalog and team; GLP-1 coaching, skincare/treatment Q&A, gentle treatment suggestions
- Glow Score: daily habit check-in (water, sleep, stress, activity, protein, skincare) → one 0-100 score, streak tracking, 14-day trend chart
- Meal Scanner: photograph a meal on /food → AI estimates calories/macros → one-tap log
- Rewards: earn points for healthy habits, redeem for LUXE treatment perks on /rewards

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Facebook page (LUXE's social) cannot be fetched programmatically — blocked by scrapers.
- The Aesthetic Record services page is JS-rendered; service list was hand-curated in seed data.
- User attached a large vision doc (attached_assets/Pasted-Knowing-what-I-know-about-Luxe-Wellness-...txt) proposing a daily-engagement platform (Luxe AI chat, skin analysis, glow score, rewards). Discussed as future phases.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
