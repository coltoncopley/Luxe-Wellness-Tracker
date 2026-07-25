---
name: Expo native-only modules on web + OTA safety
description: How to consume a native-only RN module (no web build) so Expo web still bundles, and why adding one forces a fresh native build before any OTA.
---

# Native-only RN modules (e.g. react-native-webview)

Some RN libraries have **no web implementation** (react-native-webview is the canonical case). Importing one unconditionally breaks the Expo **web** bundle.

## Pattern: platform-file split (not a runtime `Platform.OS` check)
Split the component into two sibling files and import the bare specifier:
- `Foo.native.tsx` — uses the native module (Metro picks this on iOS/Android).
- `Foo.tsx` — a web-safe alternative (e.g. a DOM `<iframe>`); this is what Metro uses on **web** AND what TypeScript resolves.
- Callers `import Foo from "./Foo"` — Metro resolves the platform variant automatically; the native module never enters the web bundle.

**Why not a runtime branch:** a single file that `import { WebView } from "react-native-webview"` still forces Metro to resolve/bundle that module on web, which fails. The `.native.*` suffix is excluded from the web build entirely.

**How to verify web is clean (deterministic, no flaky e2e):** fetch the Expo web entry bundle (grab the `src="/_expo/.../entry.bundle?platform=web..."` URL from the route HTML, curl it), then grep the downloaded bundle:
- web alternative present (e.g. `youtube-nocookie` / the `.tsx` verbose name),
- **no executable native component modules** (e.g. `RNCWebViewNativeComponent`, `codegenNativeComponent(...RNCWebView`) — a stray path string in a module map is harmless; an actual `__d(...)` module def is not.

## OTA vs native-build rule (deploy caveat)
Adding a native module means the JS references a native module **absent from any already-shipped store binary**. The next mobile release must be a full **native EAS build** — do NOT push an OTA/EAS Update carrying that JS to an old binary, or the feature crashes with "module not found" when opened. Expo Go bundles many native modules already, and Expo web uses the web variant, so both are unaffected — only real installed store builds are at risk.
