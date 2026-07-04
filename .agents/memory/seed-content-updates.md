---
name: Editing already-seeded reference content
description: Why changing seed text (tips, etc.) does not update existing dev/prod DB rows, and what to do.
---

# Editing already-seeded reference content

Seed functions for reference tables use an insert-once guard (e.g. `seedTips`: `if (existingTips.length > 0) return;`). So editing the strings in `lib/db/src/seed-data.ts` updates **fresh installs only** — it does NOT change rows that were already seeded.

**Why:** seeding is idempotent by skipping when data exists, not by upserting content. This applies to any reference table seeded this way (tips, and likely other core seed data).

**How to apply:** when a task changes the *content* (not just adds new rows) of already-seeded reference data:
1. Edit `seed-data.ts` (source of truth for future/fresh installs).
2. Run a targeted SQL `UPDATE` on the existing **dev** DB rows so the change is visible now (match by a stable column like `title`).
3. If the app is already published, the **production** DB was also seeded once — the code edit + publish will NOT refresh prod rows. Run the same `UPDATE` against prod (or flag it to the user) as a one-time step.
