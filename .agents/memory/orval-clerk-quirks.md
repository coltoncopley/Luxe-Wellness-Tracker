---
name: Orval + Clerk web quirks
description: Non-obvious typing/wiring gotchas when using generated Orval hooks with Clerk web auth in this repo
---

- Passing `{ query: { enabled } }` to a generated Orval hook fails typecheck (TS2741): the generated `UseQueryOptions` requires `queryKey`. Always include it, e.g. `useGetMe({ query: { queryKey: getGetMeQueryKey(), enabled } })`.
  **Why:** Orval's generated types make `queryKey` required when any query options are passed.
  **How to apply:** whenever conditionally enabling a generated hook, pair `enabled` with the matching `get*QueryKey()`.
- Web Clerk auth here is cookie-based: do NOT call `setAuthTokenGetter` or add Bearer headers on the web client — requests authenticate via Clerk session cookies through the shared proxy.
- Never name an OpenAPI component schema `<OperationId>Body` (e.g. component `AdminGrantCompBody` for operation `adminGrantComp`): Orval's zod output auto-generates a const with exactly that name from the request body, causing a duplicate-export TS2308 in the zod barrel.
  **Why:** Orval derives request-body zod const names as `<OperationId>Body`, colliding with a same-named component type export.
  **How to apply:** name request-body components with the `*Input` suffix (matches existing `ClaimReferralInput` convention).
- Generated client fetchers return the response body directly (`Promise<Xxx200>`), NOT a `{ status, data }` wrapper. Non-2xx responses throw `ApiError` (has `.status`, `.data`).
  **Why:** the repo's `customFetch` resolves parsed JSON on success and throws on error.
  **How to apply:** read `data?.field` directly in hooks; handle specific HTTP errors (e.g. 429) in `onError` via `err.status`, never in `onSuccess`.
