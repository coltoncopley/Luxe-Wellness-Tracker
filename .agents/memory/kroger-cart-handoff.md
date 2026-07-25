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
- **Token endpoint uses HTTP Basic (client_id:secret) + form body**, not JSON. Access tokens ~30 min; refresh with 60s early margin; a failed refresh should DELETE the token row so status.connected flips false and the UI shows "Connect" again instead of erroring forever.
- **Retailer coverage context (2026-07):** Instacart paused new partner signups; Walmart has no public third-party add-to-cart (search links only); Kroger Public API has open free registration — that's why the shop dialog has three tiers (Walmart links / Kroger cart / dormant Instacart).
