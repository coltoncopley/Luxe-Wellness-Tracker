---
name: Multi-source health data aggregation & native-module isolation
description: How to add on-device wearable/health sources (Apple Health, phone steps, Oura) without double-counting, and why the native HealthKit module must never be imported at screen scope.
---

# Multi-source health-data ingestion (luxe-mobile + api-server)

Several sources can report the SAME day's steps or the SAME night's sleep:
phone Pedometer (`source='phone'`, externalId `phone:<date>`), Apple Health
(`source='apple_health'`, `apple:steps:<date>` / `apple:sleep:<date>`), and Oura
(`device_connections`). Each lands as a distinct activity/sleep row, so naive
`sum` aggregations double-count.

**Rule — steps are MAX-per-date across sources, never summed.**
- Apply everywhere steps are aggregated: the `/activity/summary` day buckets AND
  the morning-briefing `yesterdaySteps`. Sum minutes (workouts genuinely add up),
  but take `Math.max` for steps.
- **Why:** one calendar day has a single true step count; whichever source
  measured the most is the best estimate. Summing phone+Apple ~doubles it.
- **How to apply:** any NEW step source (Google Fit, etc.) must feed the same
  max logic — don't add a new `+=`. Mirror the existing sleep-max pattern in the
  summary route.

**Rule — sleep is MAX-per-date at the summary, and the on-device wrapper must
merge overlapping intervals before it ever produces a single night's duration.**
- The summary already does `Math.max` per date across sleep rows, so cross-source
  nights are fine there.
- But within ONE Apple import, iPhone + Watch write overlapping asleep samples for
  the same night. Summing raw sample durations inflates that one `apple:sleep:<date>`
  row. `lib/healthkit.ts` sorts the night's intervals and unions overlaps, then sums
  merged spans — never raw sample durations.
- **Why:** overlapping intervals from two devices are the same sleep, counted twice.

# Native HealthKit module isolation (hard rule)

`@kingstinct/react-native-healthkit` (+ `react-native-nitro-modules`) initializes
Nitro HybridObjects at import time. Importing it throws in Expo Go and is absent on
web/Android.

- **Never** import it at module top-level in any screen/component. It lives ONLY in
  `lib/healthkit.ts`, reached via a guarded `await import()` that runs only after a
  `Platform.OS === "ios"` check, wrapped in try/catch that returns an
  "unavailable-build" state. A type-only `typeof import(...)` is fine (erased).
- **Why:** a single eager import crashes the whole Expo Go dev app and the web
  bundle for everyone, not just iOS users.
- **How to verify:** after touching this, reboot the Expo Go workflow and confirm it
  bundles with no Nitro crash; the feature is real-device-build only, so runtime
  HealthKit reads can't be verified in Replit — typecheck + honest degradation is the
  bar. Apple privacy nutrition label must declare Health-data usage before submission.
