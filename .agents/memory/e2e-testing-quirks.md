---
name: E2E testing quirks (this app)
description: Recurring false-failure causes when running the Playwright testing subagent against the LUXE app.
---

Rules to avoid false e2e failures:

- **Match users by `lower(email)`.** Clerk normalizes emails to lowercase on sign-up; a `[DB]` step with a mixed-case email in `WHERE email = ...` silently updates 0 rows (e.g. comp grants never land, paywall persists).
  **How to apply:** always write `WHERE lower(email) = lower('...')` and verify row count in the test plan.
- **The test harness may restart the API server mid-test.** The dev workflow rebuilds (~45s), so clicks during that window fail with no visible toast and lists render empty. If a test fails on a step that worked moments earlier, check whether the api-server log shows a fresh startup timestamp before blaming the code.
- **Sonner toaster is not in the DOM until a toast fires** (`[data-sonner-toaster]` absent ≠ broken toasts), and toasts auto-dismiss in ~4s. For actions that hit external APIs server-side (e.g. Oura token validation, up to 8s), tell the tester to wait for the network response, then poll for the toast — checking "immediately" or "after waiting" both miss it.
- **`data ?? []` empty states mask fetch errors.** A failed list query renders "Nothing logged yet" instead of an error. Lists should branch on `isError` with a retry button (activity page does this now); check for the same trap when adding new list UIs.

**Why:** all four caused failed test runs on the Activity & Sleep feature (2026-07) even though the feature worked; each cost a full re-run to diagnose.
