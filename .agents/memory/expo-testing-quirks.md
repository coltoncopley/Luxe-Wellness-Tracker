---
name: Expo dev testing quirks
description: Metro stale route manifest 404s and e2e runTest timeouts against the Expo web app
---

- **Stale route manifest → 404s:** after adding new expo-router route files (new screens/dirs under `app/`), direct navigation can return the expo-router "404 Page Not Found" page even though the file is correct. Restart the expo workflow so Metro rescans routes, then verify the route resolves before blaming the code.
  - **How to apply:** any e2e 404 on a route whose file exists with a valid default export → restart the expo workflow first.
- **runTest against Expo web is slow:** full e2e plans (sign-in + DB comp + multi-screen sweep) regularly exceed the 600s notebook limit and return nothing. Keep Expo test plans very short (one flow, ≤ ~10 steps), run separate small tests instead of one big sweep, and tell the agent to navigate only by tapping (typed URLs trigger full reloads that hit dev-bundler flakiness).
- Test users (`mtest…@example.com`) get FK'd rows (reward_events etc.); clean up with a DO block that deletes from all FK tables referencing `users` before deleting the user rows.
