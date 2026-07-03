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
- Expo mobile: `setBaseUrl` must be the bare domain (`https://<domain>`), NOT `https://<domain>/api` — generated Orval paths already include the `/api` prefix, so a `/api` base silently produces `/api/api/...` URLs.
  **Why:** custom-fetch prepends the base URL to relative generated paths that already carry `/api`.
  **How to apply:** any new client that calls `setBaseUrl` passes the domain only; raw-fetch helpers (e.g. `apiUrl`) add `/api` themselves exactly once.
- The api-server Clerk proxy (`/api/__clerk`) is a no-op outside production, so pointing a dev client's `proxyUrl` at it yields 401s and a blank screen stuck behind `ClerkLoaded`. In dev, omit the proxy URL entirely — dev-instance publishable keys talk to Clerk's dev frontend API directly from any origin.
  **Why:** Clerk proxying doesn't work for dev instances; the middleware deliberately skips itself when NODE_ENV !== production.
  **How to apply:** only inject `*_CLERK_PROXY_URL` in production builds; dev scripts must not set it.
- Generated client fetchers return the response body directly (`Promise<Xxx200>`), NOT a `{ status, data }` wrapper. Non-2xx responses throw `ApiError` (has `.status`, `.data`).
  **Why:** the repo's `customFetch` resolves parsed JSON on success and throws on error.
  **How to apply:** read `data?.field` directly in hooks; handle specific HTTP errors (e.g. 429) in `onError` via `err.status`, never in `onSuccess`.
