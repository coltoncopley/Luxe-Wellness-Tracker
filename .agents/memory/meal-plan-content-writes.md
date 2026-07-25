---
name: meal_plans.content concurrent writers
description: Rules for writing to the meal-plan jsonb content column and for displaying partially-backfilled plans.
---

**Rule 1:** Any detached/slow writer to `meal_plans.content` (anything with an AI call or other long wait between read and write) must NOT read-modify-write the whole column. Use a single atomic `UPDATE ... SET content = jsonb_set(...)` scoped to the slot's leaf keys, guarded in `WHERE` on day date at index + dish name (+ `NOT jsonb_exists(slot, '<key>')` for write-once keys like `recipe`/`ingredients`). Concurrent swap/regenerate then makes the write a 0-row no-op instead of clobbering newer content. Inline the array index and meal-type enum via `sql.raw` (server-computed/zod-bounded — parameterizing the `->` index causes operator-ambiguity issues); keep all values parameterized. When a writer sets a secondary key it didn't originate (e.g. recipe path also filling `ingredients`), wrap it in `CASE WHEN jsonb_exists(slot,'key') THEN slot->'key' ELSE $new END` so a concurrent writer's value is preserved, not overwritten from a stale read.

**Rule 2:** The scaled shopping list is only derived when EVERY meal has `ingredients` (`planNeedsIngredients` gate in buildPlanResponse AND the email route). A partially-backfilled plan shows the legacy names-only `grocery` — a scaled list covering only some meals reads as complete and is worse than none.

**Why:** recipe-on-demand and legacy-ingredient backfill (2026-07) added two AI-slow writers racing swaps/regeneration; architect review flagged whole-content writes as lost-update risks, and a one-slot backfill briefly made the "full" list show one meal's items.

**How to apply:** any future field cached into plan content (per-meal notes, photos, nutrition detail) follows Rule 1; any new list/aggregate derived from possibly-missing per-meal data follows Rule 2. The quick-apply flow (pendingSuggestions → apply) may keep plain read-modify-write: no slow work between its read and write.
