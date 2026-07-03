---
name: Expo dev testing quirks
description: Metro stale route manifest 404s, e2e runTest timeouts, Alert.alert no-op on Expo web, expo-contacts phone formatting and permission quirks
---

- **Alert.alert is a NO-OP on react-native-web:** multi-button dialogs (choosers, delete confirms) silently do nothing in the web preview users see in the Replit mobile app. Never import `Alert` from `react-native` in luxe-mobile screens — use the shim `@/lib/alert` (same API; native delegates to RN Alert, web renders a themed DOM overlay dialog).
  - **How to apply:** any "button does nothing" report on the mobile web preview → check for a raw RN Alert first; any new dialog/confirm must import Alert from `@/lib/alert`.

- **Stale route manifest → 404s:** after adding new expo-router route files (new screens/dirs under `app/`), direct navigation can return the expo-router "404 Page Not Found" page even though the file is correct. Restart the expo workflow so Metro rescans routes, then verify the route resolves before blaming the code.
  - **How to apply:** any e2e 404 on a route whose file exists with a valid default export → restart the expo workflow first.
- **runTest against Expo web is slow:** full e2e plans (sign-in + DB comp + multi-screen sweep) regularly exceed the 600s notebook limit and return nothing. Keep Expo test plans very short (one flow, ≤ ~10 steps), run separate small tests instead of one big sweep, and tell the agent to navigate only by tapping (typed URLs trigger full reloads that hit dev-bundler flakiness).
- Test users (`mtest…@example.com`) get FK'd rows (reward_events etc.); clean up with a DO block that deletes from all FK tables referencing `users` before deleting the user rows.

- **expo-contacts phone numbers are display-formatted:** `contact.phoneNumbers[].number` comes back like "(740) 555-1234"; spaces/parens make `sms:` URLs invalid and `Linking.openURL` rejects on iOS. Strip with `.replace(/[^+\d]/g, "")` before building the URL (body separator: `&body=` on iOS, `?body=` on Android).
- **iOS contact picker needs no permission:** `Contacts.presentContactPickerAsync()` uses the system picker and works without contacts permission on iOS — don't gate it behind `requestPermissionsAsync` there (it blocks users who tapped "Don't Allow" from a flow that would work). Only request permission on Android. expo-contacts is unsupported on web — fall back to Share/clipboard.
