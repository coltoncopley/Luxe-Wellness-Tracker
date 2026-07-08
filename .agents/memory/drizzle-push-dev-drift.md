---
name: Drizzle push blocked by dev-only index drift
description: Why drizzle-kit push can hang on a TTY prompt in this repo and how to resolve schema drift between dev and prod
---

**Rule:** If `pnpm --filter @workspace/db run push` hangs or asks an interactive question, do NOT pipe blind "yes" answers. Diagnose the drift first, fix it with targeted SQL, then re-run push.

**Why:** drizzle-kit push prompts interactively (TTY) when the live DB disagrees with the schema in a way it can't auto-resolve — e.g. dev had `reward_events` uniqueness as a plain UNIQUE INDEX while prod (and the Drizzle schema) had a real UNIQUE CONSTRAINT. Answering the prompt blindly can drop/recreate objects. The drift was fixed with `ALTER TABLE ... ADD CONSTRAINT ... UNIQUE USING INDEX ...`, which converts the index in place with no table rewrite.

**How to apply:** When push misbehaves: (1) compare `pg_constraint`/`pg_indexes` between dev and prod for the table it complains about; (2) prefer `ADD CONSTRAINT ... USING INDEX` to promote an index to a constraint; (3) for a brand-new table that push won't apply cleanly, creating it with manual SQL matching the Drizzle schema is acceptable in dev — prod schema is applied by Replit's Publish flow.
