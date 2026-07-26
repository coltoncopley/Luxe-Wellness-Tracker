---
name: Kroger cart handoff
description: Kroger Public API quirks — write-only cart, public OAuth callback with HMAC state, per-environment redirect URIs.
---

# Kroger cart handoff

- **Cart API is write-only.** `PUT /v1/cart/add` {items:[{upc, quantity}]} can only add; there is no read/remove/replace. UX must send qty 1 per line and tell members to adjust on kroger.com/cart. Don't promise cart contents or dedupe against what's already there.
  **Why:** confirmed in Kroger Public API docs during the 2026-07 build; designing a "sync" UX around it is impossible.
- **OAuth callback must be mounted publicly with identity in a signed state.** The redirect lands in a bare browser (mobile: system browser with no app session), so the callback can't rely on auth middleware. Pattern: HMAC(SESSION_SECRET) over base64url(JSON{userId, platform, exp~10min}), verify with timingSafeEqual, then branch web→app redirect with a query flag vs mobile→tiny "return to app" HTML.
  **How to apply:** any future retailer/service OAuth for mobile members should reuse this state pattern; register the callback route BEFORE the authed layers in the routes index.
- **Redirect URIs are per-environment and registered in the Kroger developer portal.** Dev defaults to `https://$REPLIT_DEV_DOMAIN/api/kroger/callback`; production requires `KROGER_REDIRECT_URI` in deployment secrets AND that exact URL added in the portal, or token exchange fails with no user-visible cause.
- **Token endpoint uses HTTP Basic (client_id:secret) + form body**, not JSON. Access tokens ~30 min; refresh with 60s early margin. Only a "denied" grant (HTTP 400/401 from the token endpoint) means tokens are dead → delete the row so the UI flips back to "Connect"; network errors/timeouts/5xx/429 are transient → 503 and NEVER touch stored tokens.
- **Refresh/delete must be race-safe (review must-fix).** Serialize refreshes per user (in-flight promise map) AND compare-and-swap every token UPDATE/DELETE against the exact refresh/access token the request started from; on a lost race, re-read the row and use the winner's token. Unconditional delete-by-user_id lets a losing refresh destroy tokens a parallel request just rotated (refresh tokens rotate) → needless reconnect loops.
- **401/403 must drive reconnect from EVERY upstream call, not just cart add (review must-fix).** A product-search 401 collapsed to "not found" returns 200 with everything "missed" and never flips the client to Connect. Pattern: lookups return `{upc}|"auth"|"down"`; any "auth" → CAS-delete token + 409 reconnect; any "down" → 503, never misreport as missed items.
- One-time-use state nonce (jti + in-memory seen-set) on the OAuth callback is cheap defense-in-depth on top of HMAC+expiry (fine on a single-VM deploy).
- **Retailer coverage context (2026-07):** Instacart paused new partner signups; Walmart has no public third-party add-to-cart (search links only); Kroger Public API has open free registration — that's why the shop dialog has three tiers (Walmart links / Kroger cart / dormant Instacart).
