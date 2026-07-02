---
name: Code-based endpoint hardening
description: Required protections for endpoints that accept guessable codes, and the staff-exclusion rule for patient data in this app.
---

**Rule:** Any endpoint that accepts a short guessable code (invite/referral codes, claim codes, redemption codes, access codes) must ship with:
1. In-memory rate limiting keyed by both IP and user (existing pattern: small Map + window, 5–15/min, 429 beyond, clear map above a size cap).
2. Minimal response disclosure — never return the code owner's name/identity on a guess; keep failure reasons coarse.
3. Idempotency/race safety for anything that awards points (unique dedupe keys, transactions + advisory locks, conditional UPDATE ... WHERE col IS NULL with read-back for lazy-generated unique values).

**Why:** Architect review blocked the referral feature (code brute force) and the friends feature (staff access to patient aggregates + name leakage on code guess + cheer spam) until these were added. The app's hard constraint: staff must NEVER see patient health data — even derived aggregates — so patient-data routes get `requirePatient` (403 for staff), not just `requireAuth`.

**How to apply:** When adding any new code-accepting or patient-data endpoint, add the rate limiter and staff exclusion up front, before requesting review.
