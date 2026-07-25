---
name: DELETE /me manual FK-cleanup chain
description: This app has no DB-level ON DELETE CASCADE for user data — account deletion deletes each user-scoped table by hand, so any new per-user table must be added to the chain.
---

Account deletion (`DELETE /me` in `artifacts/api-server/src/routes/me.ts`) removes each user-scoped table explicitly; the FKs to `users` do NOT have `ON DELETE CASCADE`.

**Rule:** every time you add a new per-user table (anything with a `user_id` FK to `users`), add a matching delete to the `DELETE /me` chain — otherwise rows orphan on account deletion and the Apple 5.1.1(v) "delete account" flow is silently incomplete.

**Why:** `weekly_reports` and `challenge_participants` were both missed when first added and only caught in a later review; the meal-plan overhaul had to add `meal_plan_preferences` + `meal_plan_grocery_checks` to the chain too. This is a recurring trap because nothing in the schema forces it.

**How to apply:** when introducing a user-scoped table, grep `routes/me.ts` for the delete chain and add the new table; order deletes so child rows go before parents where FKs chain.
