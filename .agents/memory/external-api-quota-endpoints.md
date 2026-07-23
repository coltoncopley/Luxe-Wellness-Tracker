---
name: External quota-limited API endpoints (this app)
description: Non-obvious lessons for wiring a third-party, quota/budget-limited API (e.g. Spoonacular chain menus) into the food features.
---

Durable lessons from adding chain-restaurant menu search backed by a paid, quota-limited external API:

- **Rate-limit the DETAIL/`:id` fetch too, not just the search route.** Any endpoint that triggers a real upstream call consumes the shared daily budget, so a subscriber scripting `/…/1..N` on the detail route can drain the whole app's quota (feature-wide DoS) even when search is limited. Put both routes behind ONE combined per-user hourly bucket, on top of the module-level global daily budget + response cache.
  **Why:** architect flagged exactly this gap — search had a limiter, `:id` did not. **How to apply:** whenever you add a second route that hits the same external budget, share the limiter Map.

- **Node `fetch` + `AbortController` timeouts do NOT reliably pass `e instanceof Error`.** An aborted fetch throws a `DOMException`, so `e.name === "AbortError"` behind an `instanceof Error` guard silently misclassifies timeouts as generic upstream errors. Detect timeouts via `controller.signal.aborted` in the catch block instead.

- **Spoonacular's menu API is a two-call shape:** the search endpoint returns items WITHOUT nutrition (id/name/restaurant/image only); you must fetch the item `:id` to get calories+macros. Frontend logs an item only after the detail fetch. Don't try to show macros on search results — they aren't there.

- **Cost/abuse defense is layered, not single-point:** (1) explicit-submit-only on the client (no keystroke search) to conserve quota, (2) per-user hourly rate limit across all routes, (3) module global daily budget that throws a typed "unavailable" BEFORE the upstream can bill/429, (4) 1h in-memory cache on both search and item keyed by normalized query/id. Coarse `503` on budget/timeout/upstream, `404` on not-found. Key read from env per call, never logged.
