---
name: OpenAPI optional vs nullable (food nutrients)
description: Why forwarding a curated menu item straight into a food-log create 400s, and the general optional-vs-nullable client rule.
---

Numeric "extra" fields in this app's OpenAPI/Zod contract are modeled as `.optional()` (may be omitted) — NOT `.nullable()`. Sending an explicit `null` from the client fails server validation with a 400.

**Why:** curated `menu_items` rows have NULL nutrient columns (satFatG/fiberG/sugarG/sodiumMg/cholesterolMg and often proteinG/carbsG/fatG). Any client path that forwards a menu item object directly into a `POST /food-logs` body (e.g. web "Quick Add from Restaurants" `handleQuickAdd`) will pass those nulls through — the generated client JSON.stringifies nulls, and the server `zod.number().min(0).optional()` rejects `null`. The bug is silent if the mutation has no `onError` (no toast).

**How to apply:**
- When forwarding DB/API objects into a create/update body, coerce nullable numerics with `?? undefined` (or use conditional spreads) so they are omitted, not sent as null.
- Always give food-log (and similar) mutations an `onError` toast so a validation 400 is visible.
- The manual food form is safe because its `scale()`/`scaleInt()` helpers return `undefined` for empty inputs; the AI scan path is safe because `MealPhotoAnalysis` requires all nutrients (never null).
- NutritionFactsLabel `values` prop DOES accept `null` (renders "—") — that's a display type, different from the create-body input type. Don't confuse the two.
