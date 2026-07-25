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
- Trap: `ApiError.response` is the raw fetch `Response`, so axios-style `err.response.status` half-works but `err.response.data` is ALWAYS undefined (body already consumed). Any body-code check silently never matches.
  **Why:** the error's parsed body lives at top-level `err.data`, not on the Response; this shipped a broken error branch once and only code review caught it.
  **How to apply:** always read `err.status` and `err.data?.error` at the top level when branching on API error codes, on both web and Expo clients.
- Adding an (even fully optional) `requestBody` to a POST changes the generated mutation's variable shape from `void` to `{ data?: BodyType<...> }`. Existing `.mutate(undefined)` callers still typecheck (data is optional) but silently send no body — you must switch them to `.mutate({ data: input })`, and to send nothing pass `.mutate({})` or `.mutate({ data: undefined })`.
  **Why:** Orval regenerates the mutation signature the moment a requestBody exists; the positional-undefined call is a stale no-body pattern that compiles but drops your payload.
  **How to apply:** after adding a requestBody to any operation, grep every call site of that mutation and convert to the `{ data: ... }` form; don't trust typecheck to flag the old callers.
