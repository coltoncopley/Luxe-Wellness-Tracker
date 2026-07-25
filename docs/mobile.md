# Mobile app reference (`artifacts/luxe-mobile`)

Expo + expo-router patient-only native app reusing api-server. The always-loaded summary lives in `replit.md`.

## Structure & parity

- 5 tabs (Home/Track/Chat/Rewards/Book) + settings modal. Full web-feature parity (2026-07).
- Home has a 13-tile "Explore" grid → stack screens under `app/explore/` (Skin Scan, Product Scan, Progress Photos, My Journey, Weekly Report, Meal Plan, Workouts, Skincare Routine, Beauty Passport, Dining Out Guide, Friends, Community, Hormone Health/BHRT). Home also shows the "Today at LUXE" daily-loop card (checklist from onboarding-chosen daily actions, complete-loop claim), the wellness-score qualifier copy, and the Wellness Streak card (milestone progress); Community screen includes the monthly challenges section (join + private progress bar).
- Friends has an "Invite friends" card (expo-contacts picker → prefilled SMS with sanitized phone + `?ref=CODE` referral link, Share/clipboard fallback on web; contacts permission prompt skipped on iOS since the system picker doesn't need it; invite link lives only in the outgoing message — no in-app purchase CTA, Apple 3.1.1-safe).
- Track tab has 5 segments (Weight/Glow/Food/Mind/Move — Mind keeps the 988 disclaimer; Food includes the AI meal-photo scanner with camera/library chooser and the barcode scanner card; Move is `components/track/MoveTab.tsx`).
- Settings modal includes notification prefs (push is web-only, email via Resend) + birthday.

## UI conventions

- Theme tokens in `constants/colors.ts` via `useColors()` — no hardcoded hex in screens (auth screens' fixed dark palette is the historical exception); success/warning/info/overlayForeground/switchThumb tokens exist.
- All list screens have loading/error/empty states (`ErrorView` with retry).
- Dialogs/confirms must import `Alert` from `@/lib/alert` (cross-platform shim — RN Alert.alert is a no-op on web preview; shim renders a DOM dialog on web, native Alert on device).
- Camera/photo flows use `pickImageAsset` in `lib/luxe.ts`; expo-image-picker plugin in app.json carries the iOS/Android permission strings for native builds (web auto-grants, camera opens via file-input capture). expo-camera plugin (barcode scanning) has `microphonePermission: false, recordAudioAndroid: false`; because config plugins apply in order, the LAST plugin writing NSCameraUsageDescription (expo-image-picker) must mention all camera uses.

## Auth & networking

- Clerk Expo Core v3 (password + Google SSO); mobile uses Bearer tokens via `setAuthTokenGetter(getToken)` (web stays cookie-based).
- In dev, Clerk talks to its dev-instance frontend API directly (NO proxy — the api-server Clerk proxy is a prod-only no-op); prod build injects `EXPO_PUBLIC_CLERK_PROXY_URL`.
- `setBaseUrl` gets domain only — generated Orval paths already include `/api`.
- Chat = SSE via expo/fetch with manual Bearer header.

## App Store constraints

- **Apple 3.1.1 Netflix model:** no IAP, no purchase links; MembershipGate says membership is managed on the website + access-code redemption only.
- Gate order: privacy ack → onboarding wizard (patients with `onboarded=false`) → membership (staff/admin/comp exempt). Onboarding must stay BEFORE the membership gate (it's auth-only, not premium).
- App Store submission kit in exports/app-store/, screenshots in screenshots/appstore/. App Store Connect ID 6788731422.
- **Native modules need a fresh native build, never OTA:** `react-native-webview` (exercise "Watch how-to" player, `components/HowToVideoPlayer.native.tsx`) is a native module — it must ship in a full EAS build. Do NOT push an OTA/EAS Update containing its JS to an already-installed binary that lacks it (the player would crash with "module not found"). Expo Go and Expo web are unaffected (web uses the DOM-iframe variant `HowToVideoPlayer.tsx`).
