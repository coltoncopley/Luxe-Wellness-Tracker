---
name: Orval + Clerk web quirks
description: Non-obvious typing/wiring gotchas when using generated Orval hooks with Clerk web auth in this repo
---

- Passing `{ query: { enabled } }` to a generated Orval hook fails typecheck (TS2741): the generated `UseQueryOptions` requires `queryKey`. Always include it, e.g. `useGetMe({ query: { queryKey: getGetMeQueryKey(), enabled } })`.
  **Why:** Orval's generated types make `queryKey` required when any query options are passed.
  **How to apply:** whenever conditionally enabling a generated hook, pair `enabled` with the matching `get*QueryKey()`.
- Web Clerk auth here is cookie-based: do NOT call `setAuthTokenGetter` or add Bearer headers on the web client — requests authenticate via Clerk session cookies through the shared proxy.
