---
name: Expo iOS build + Clerk native pod
description: Why the App Store iOS build failed at pod install and how to debug/fix native pod issues from Linux
---

# Clerk native pod requires its config plugin

`@clerk/expo` v3 ships a native iOS pod (ClerkExpo) that needs iOS 17.0. Its podspec registers a Swift Package (clerk-ios) during evaluation even when the pod itself is skipped for a too-low deployment target — RN's SPM post-install hook then crashes with `undefined method 'package_product_dependencies' for nil`.

**Rule:** `"@clerk/expo"` must stay in the `plugins` array of `artifacts/luxe-mobile/app.json`. Its config plugin raises ios.deploymentTarget to 17.0 before pod install so the pod actually installs.

**Why:** App Store cloud build failed at the Podfile post-install hook (2026-07); reproduced deterministically on Linux, fixed by adding the plugin. Consequence: app minimum is iOS 17+, and the plugin auto-adds the Sign in with Apple entitlement.

**How to apply:** Never remove the plugin. If a future cloud build fails at Xcode link stage with unresolved ClerkKit/ClerkKitUI symbols, the knob is `expo-build-properties` → `ios.useFrameworks: "dynamic"` (do NOT set preemptively — static is Clerk's shipped default).

# Debugging pod install failures from Linux (repro recipe)

CocoaPods runs fine on this Linux workspace up to and including the post-install hook — good enough to reproduce Podfile/post-install errors without a Mac:
1. `CI=1 npx expo prebuild --platform ios --no-install` in the mobile artifact (generates ios/).
2. Install ruby (nix system dep) + `gem install cocoapods --user-install` + rsync; stub `xcodebuild`/`command`/`curl` in a fakebin dir on PATH; run `pod install` with the nix curl lib on LD_LIBRARY_PATH for ethon.
3. Afterward ALWAYS clean up: delete the generated `ios/` dir (a committed ios/ flips Expo Launch to bare workflow — it is gitignored, keep it that way) and revert prebuild's package.json edits (adds android/ios scripts + duplicate expo/react/react-native deps).

# Follow-up flagged at review

App offers "Continue with Google" but no Sign in with Apple — Apple guideline 4.8 likely requires it for approval. Entitlement is already auto-added by the Clerk plugin; only the UI is missing.
