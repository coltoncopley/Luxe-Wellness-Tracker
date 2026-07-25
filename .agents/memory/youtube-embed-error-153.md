---
name: YouTube embed error 153 in RN WebView
description: Embedded YouTube players fail with "Error 153 — video player configuration error" when the request carries no HTTP Referer; the reliable fix is a hosted embed page, not WebView tricks.
---

# YouTube embed error 153 (missing Referer)

**Rule:** For native in-app YouTube playback, point the WebView at a real hosted HTML page on our own domain (public API route serving an iframe wrapper), not at the YouTube embed URL directly and not at inline HTML.

**Why:** YouTube rejects embedded-player requests without an HTTP Referer ("Error 153"). A bare `source={{ uri }}` sends no referer. In-app workarounds are risky on iOS: custom `headers: { Referer }` get dropped on redirects, and `source={{ html, baseUrl }}` (loadHTMLString) referer behavior is untested/possibly unreliable in WKWebView (attempt 1 used it but never reached a device, so it was never verified). A genuine HTTPS document is the only variant where the inner iframe is guaranteed to carry a proper Referer.

**How to apply:** The API server serves `GET /api/embed/exercise-video/:videoId` (public, validates the 11-char YouTube ID, cached HTML). The native player loads it via `apiUrl()`. Web/Expo-web iframes are unaffected — the site page itself provides the referer.

**Delivery caveat:** (also recorded in replit.md Gotchas) mobile JS fixes are invisible on the owner's installed TestFlight/App Store build until a new EAS build ships — no expo-updates/OTA. Server-side pieces must also be republished to production before that build is tested. If a curated video still fails after both ship with a "Video unavailable" error, that specific video has embedding disabled by its owner — swap the curated ID, don't debug the player.
