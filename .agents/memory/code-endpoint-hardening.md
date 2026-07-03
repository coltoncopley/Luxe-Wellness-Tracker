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

**Push subscription registration rule:** A push-subscribe endpoint that upserts by endpoint must NOT transfer an endpoint owned by a different user (review blocks it as ownership takeover). Return 409 on foreign endpoint; the client handles 409 by unsubscribing the browser subscription and creating a fresh one (new endpoint) for the shared-device case. Also make send-dedupe ledgers unique on `(user_id, dedupe_key)`, not `dedupe_key` alone.

**Grant-provenance rule for revocable access:** When a code/grant can be revoked and the underlying access lives on shared user columns (e.g. comp fields), record provenance (a `comp_source`-style marker: "manual" vs `code:<id>`) at grant time and only undo access whose provenance matches the thing being revoked — otherwise revoke clobbers unrelated manual grants and review blocks it. Also lock BOTH the code row and the user row `FOR UPDATE` in the redemption transaction and re-check eligibility inside it (pre-transaction checks alone allow two concurrent redemptions by the same user), and write the full access state per branch, never partial fields.

**Presigned-upload registration rule:** Any endpoint that accepts a client-supplied storage object path (registering an upload into a DB row + setting its ACL) must bind ownership server-side, or review will block it as an ownership-takeover vector. Pattern used here: issue presigned upload paths as `uploads/<userId>/<uuid>`, then on registration reject any path not matching `/objects/uploads/<currentUserId>/<strict-uuid>`. Never trust a raw objectPath from the client when setting ACL owner.
