---
name: Instacart shopping-list handoff
description: Meal-plan → Instacart link creation — env keys, dev vs prod servers, unit vocabulary, caching, and no-key degradation
---
- `POST {base}/idp/v1/products/products_link`, `Authorization: Bearer INSTACART_API_KEY`; response field is `products_link_url`.
- Base URL: `INSTACART_API_URL` override, else `https://connect.dev.instacart.tools` outside production / `https://connect.instacart.com` in production.
- **Why:** dev and prod are separate Instacart universes with separate keys — a dev key against the prod URL fails, and dev-created links only resolve while Instacart's dev environment serves them. Going live needs an approved production key AND `INSTACART_API_URL` set in deployment secrets.
- Unit vocabulary is closed: g→gram, oz→ounce, lb→pound, ml→milliliter; cup/tbsp/tsp/can/bunch pass through; anything else (clove, slice, item, "to taste") → quantity 1 unit "each" with the original measure carried in `display_text`.
- **How to apply:** feature must degrade gracefully with no key — server returns `instacartEnabled:false`, clients hide the button, copy/share fallback remains. Keep per-user daily rate limit + payload-hash URL cache in memory (single-instance deploy).
- Web popup pattern for async link creation: pre-open `window.open("", "_blank")` inside the click gesture, set `popup.opener = null`, navigate it on mutate success — dodges popup blockers.
