---
name: YouTube embed error 153 in RN WebView
description: Embedded YouTube players fail with "Error 153 — video player configuration error" when the request carries no HTTP Referer; how to fix in react-native-webview.
---

# YouTube embed error 153 (missing Referer)

**Rule:** Never load a YouTube embed URL directly via `<WebView source={{ uri }}>`. Wrap it in a minimal HTML page with an `<iframe>` and load it with `source={{ html, baseUrl: "https://<app-public-domain>" }}` (plus `originWhitelist={["*"]}`).

**Why:** YouTube rejects embedded-player requests that arrive without an HTTP Referer, showing "Error 153 — Video player configuration error". A bare `uri` load in react-native-webview sends no referer. Setting `baseUrl` on an HTML source gives the wrapper document an origin, so the inner iframe request carries a proper Referer and YouTube serves the player. Custom `headers: { Referer }` on a `uri` source is unreliable on iOS (dropped on redirects).

**How to apply:** Any native in-app YouTube playback (e.g. workout how-to videos). Web/Expo-web iframes are unaffected — the page itself provides the referer. Escape any user/DB-derived strings interpolated into the wrapper HTML.
