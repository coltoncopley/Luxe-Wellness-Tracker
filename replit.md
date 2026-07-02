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

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for the API contract
- `lib/db/src/schema/` — Drizzle tables: services.ts (services, staff), appointments.ts, tracking.ts (weight_entries, measurements, goals), food.ts (restaurants, menu_items, food_logs, tips)
- `artifacts/api-server/src/routes/` — catalog.ts, appointments.ts, tracking.ts, food.ts, wellness.ts (tips, dashboard summary)
- `scripts/src/seed.ts` — seed data
- `artifacts/luxe-wellness/` — patient-facing web app (pages: /, /book, /weight, /food, /restaurants)
- `attached_assets/brand/luxe_logo.jpeg` — brand logo

## Architecture decisions

- Booking is external: bookingUrl fields deep-link to https://hklqy.myaestheticrecord.com/online-booking (Aesthetic Record); appointments are tracked manually in-app.
- Single-user app, no auth (first build).
- Calendar dates stored as YYYY-MM-DD strings (`date(..., { mode: "string" })`).
- mealType values: breakfast/lunch/dinner/snack; measurement areas: waist/hips/arms/thighs/chest/neck.
- Goal is a singleton row, auto-created on first GET /api/goal.

## Product

- Dashboard: weight snapshot, calories today vs target, logging streak, next appointment, daily tip
- Book: browse services and team, deep-link out to Aesthetic Record, track appointments manually
- Weight: daily weigh-ins, body-area measurements, goal setting, progress chart
- Food: meal logging with macros, daily summary, restaurant menu search
- Restaurants: local chains with calorie/macro data and healthy pick ordering tips

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Facebook page (LUXE's social) cannot be fetched programmatically — blocked by scrapers.
- The Aesthetic Record services page is JS-rendered; service list was hand-curated in seed data.
- User attached a large vision doc (attached_assets/Pasted-Knowing-what-I-know-about-Luxe-Wellness-...txt) proposing a daily-engagement platform (Luxe AI chat, skin analysis, glow score, rewards). Discussed as future phases.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
