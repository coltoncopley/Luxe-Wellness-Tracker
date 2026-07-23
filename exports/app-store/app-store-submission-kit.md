# LUXE Wellness & Aesthetics — App Store Submission Kit

Everything needed to submit the LUXE **mobile app** (`artifacts/luxe-mobile`, Expo / React Native) to the Apple App Store, plus the exact steps you still need to run.

**Current status (updated 2026-07-23):**
- ✅ App version bumped to **1.1.0** in the project (required so Apple accepts a new build)
- ✅ New since the last kit update: **chain-restaurant nutrition search** (search national chains like McDonald's or Olive Garden, see their real published nutrition, log in one tap) — see the "What's New" text in §1b
- ✅ Native iOS app exists (Expo/React Native, reuses the deployed backend)
- ✅ Backend deployed & healthy at `https://luxewellnessapp.com`
- ✅ Patient accounts + per-patient private data (Clerk auth)
- ✅ In-app **Delete Account** (Settings → Account) — satisfies Apple 5.1.1(v)
- ✅ **Sign in with Apple** added alongside Google — satisfies Apple 4.8
- ✅ Apple Health privacy purpose strings fixed (this caused the first upload rejection — resolved)
- ✅ Apple Developer account + App Store Connect app created (LUXE Wellness, ID 6788731422)
- ✅ Builds run from Replit's **Publish pane** (App Store tab) — no command line needed
- ⏳ Remaining: finish the App Store Connect listing (§1–§6), retake screenshots from the real app (§5), test via TestFlight, submit for review (§7)

---

## 1. App Store listing copy (paste into App Store Connect)

**App Name** (30 char max)
> LUXE Wellness & Aesthetics

**Subtitle** (30 char max)
> Your daily glow companion

**Promotional Text** (170 char max)
> Track your GLP-1 journey, earn rewards for healthy habits, and chat with Luxe AI — your 24/7 wellness companion from LUXE Wellness & Aesthetics.

**Description** (4000 char max)

> Your wellness journey, all in one place — from LUXE Wellness & Aesthetics, the physician-owned med spa in South Point, Ohio.
>
> TRACK YOUR PROGRESS
> • Daily weigh-ins with a beautiful progress chart
> • Body measurements for waist, hips, arms, thighs, chest, and neck
> • Set a goal weight and watch yourself get closer every week
> • Built with GLP-1 patients in mind
>
> EAT SMARTER
> • Log meals in seconds with calories, protein, carbs, and fat
> • Snap a photo of your plate — AI estimates the nutrition for you
> • Search national chain restaurants for real published nutrition and log items in one tap
> • Browse local restaurant menus with healthy picks and ordering tips
> • Daily calorie summary so you always know where you stand
>
> YOUR DAILY GLOW SCORE
> • One simple 0–100 score for your whole day: water, sleep, stress, movement, protein, and skincare
> • Build streaks and watch your trend over time
>
> EARN REAL REWARDS
> • Get points for weigh-ins, meal logs, and daily check-ins
> • Redeem points for treatment perks at LUXE — show your code at the front desk
>
> MEET LUXE AI
> • A 24/7 wellness assistant that knows our services and team
> • Ask about treatments, skincare, or GLP-1 lifestyle tips anytime
>
> PRIVATE BY DESIGN
> • Your health and tracking data is yours alone — the LUXE office cannot see it
>
> BOOK IN SECONDS
> • Browse our full service menu and meet our team
> • Book online through our secure scheduling portal
>
> LUXE Wellness and Aesthetics is a physician-owned med spa led by Dr. Copley in South Point, OH.
>
> Full access to premium features is part of the LUXE Membership ($4.99/month), managed on our website. This app is a wellness companion, not a medical device. It does not provide medical advice, diagnosis, or treatment. Always consult your healthcare provider about medical questions.

### 1b. "What's New in This Version" (paste for version 1.1.0)

> • NEW: Chain restaurant search — look up real published nutrition for national & regional chains and log menu items to your food diary in one tap
> • Performance improvements and bug fixes

(If this is your FIRST submission and 1.0 was never approved, skip this — the "What's New" field only appears for updates.)

**Keywords** (100 char max)
> med spa,wellness,GLP-1,weight tracker,glow,skincare,botox,aesthetics,food log,rewards,South Point

**Category**
> Primary: Health & Fitness · Secondary: Lifestyle

**Age Rating**
> 17+ (wellness content; booking links open our external scheduling site). Answer "None" to all objectionable-content questions.

---

## 2. Required URLs (live now)

The backend is deployed, so these are already public:

| Requirement | URL |
|---|---|
| Privacy Policy URL (required) | `https://luxewellnessapp.com/privacy` |
| Support URL (required) | `https://luxewellnessapp.com/support` |
| Terms of Use / EULA (optional) | `https://luxewellnessapp.com/terms` |
| Marketing URL (optional) | `https://luxewellnessapp.com/` |

Confirm each opens correctly, then paste into App Store Connect.

---

## 3. Apple Privacy "Nutrition Label" answers

The app **has accounts**, so most data is *linked to the user*. In App Store Connect → App Privacy, declare:

**Data collected and linked to the user** (all "App Functionality", none for tracking):
- Contact Info → Email address (sign-in / account)
- Identifiers → User ID
- Health & Fitness → Fitness & health data (weight, measurements, activity, sleep, habit/mood check-ins)
- User Content → Photos (progress photos are stored; meal/skin/ingredient photos are processed for AI analysis)
- User Content → Other User Content (AI chat messages, journal/gratitude notes)
- Purchases → Purchase history (LUXE Membership subscription; payment itself is handled on the website via Stripe)

**Data used for tracking:** None. No advertising, no third-party analytics, no data sold or shared for marketing.

**Data used to track you across apps/websites:** No.

**Permission strings** (already set in `app.json` — no action needed, listed here for reference):
> Camera: "LUXE uses your camera to take progress photos, skin scan selfies, and photos of product labels."
> Photo library: "LUXE uses your photo library so you can add progress photos and scan product labels."
> Contacts: "LUXE uses your contacts so you can invite friends to join the app."
> Motion (phone steps): "LUXE reads your step counts from the phone's motion sensor, only when you tap Import, so you can add them to your activity log."
> Apple Health (read): "LUXE reads your steps, workouts, and sleep from Apple Health, only when you tap Sync, to add them to your private activity log."
> Apple Health (write — required by Apple even though the app never writes): "LUXE does not save or change anything in Apple Health. It only reads the data you choose to sync."

---

## 4. Account deletion (Apple 5.1.1(v)) — satisfied

Apple requires any app with account creation to offer in-app account deletion.

- **Where:** Settings → Account → "Delete account" (mobile and web).
- **What it does:** permanently deletes the Clerk login and **all** of the patient's data (weigh-ins, measurements, food logs, photos and their stored image files, glow/mind check-ins, activity/sleep, rewards, passport, friends/social, community posts, etc.), and cancels any active LUXE Membership in Stripe. It cannot be undone.
- **For review notes:** "Account deletion is available in-app at Settings → Delete account. It fully removes the account and all associated data and cancels any active subscription."

---

## 5. Screenshots

Captured drafts live in `screenshots/appstore/`:

| File | Shows |
|---|---|
| 01-dashboard.jpg | Home: weight goal, calories, streak, morning briefing |
| 02-weight.jpg | Weight & measurements with goal progress |
| 03-glow.jpg | Daily Glow Score with streak and trend |
| 04-food.jpg | Daily food log with macros and meal scanner |
| 05-rewards.jpg | LUXE Rewards points and earning guide |
| 06-book.jpg | Booking & appointments |

**Required sizes:** 1290 × 2796 px for the 6.7" iPhone (required). If you support iPad, also 2048 × 2732 px. Apple rejects screenshots that don't come from the actual app UI and off-spec dimensions — **retake these from the native build** (run the app on an iPhone 15 Pro Max simulator and capture) before submitting.

---

## 6. App Review notes (paste into "Notes for Review")

> This is a wellness companion app for patients of LUXE Wellness and Aesthetics, a physician-owned medical spa in South Point, Ohio. It is for self-tracking of lifestyle habits (weight, meals, hydration, sleep, mood) and does not provide medical advice, diagnosis, or treatment — disclaimers appear in-app and in our Terms of Use. AI features (meal-photo nutrition estimates, skin/ingredient scans, and a wellness chat assistant) state that outputs are estimates and not medical advice.
>
> Accounts: sign-in is required; a patient's health/tracking data is private to them and is never visible to spa staff. Account deletion is available in-app at Settings → Delete account (removes the account and all data and cancels any active subscription).
>
> Membership: premium features are part of the LUXE Membership ($4.99/month) which is purchased and managed on our website (luxewellnessapp.com). No purchases occur inside the app and no external purchase links are shown in the app; members can unlock access in-app by redeeming a membership access code. Appointment booking links out to our existing scheduling provider (Aesthetic Record).
>
> A demo account is provided below for review.

**Provide a demo account:** create a test patient with an active membership (or a comp/access code redeemed) so reviewers can see premium features, and paste its email + password into the review notes.

---

## 7. What you still need to do — step by step

### If the app is ALREADY live on the App Store (shipping the 1.1.0 update)
1. Run a new build from Replit: **Publish** (top right) → **App Store / iOS** tab → build & upload (~20–40 min). The project is already set to version 1.1.0.
2. In appstoreconnect.apple.com → **My Apps → LUXE Wellness**, click the **"+"** next to "iOS App" and create version **1.1.0**.
3. Paste the "What's New" text from §1b, select the new build once it finishes processing (10–30 min after upload), and click **Submit for Review**. Everything else (screenshots, privacy answers, URLs) carries over from the live version — no need to redo it.
4. Apple typically approves updates in 1–3 days; existing users get the update automatically.

### If the app is NOT yet on the App Store, follow A–C below:

### A. Build & upload the iOS app — done from Replit, no command line
1. Open the project on **replit.com** in a browser.
2. Click **Publish** (top right) → the **App Store / iOS** tab.
3. Run the build. It builds in the cloud and uploads straight to App Store Connect (takes ~20–40 min).
4. After upload, the build appears in App Store Connect → TestFlight (processing can take another 10–30 min). Answer the one-time encryption question ("standard encryption") when prompted.

### B. Test via TestFlight (recommended before submitting)
1. Install the **TestFlight** app on your iPhone.
2. In App Store Connect → your app → TestFlight tab → Internal Testing, add yourself as a tester by email.
3. Tap the invite link on your phone → Install. Verify sign-in (Apple + Google), membership unlock, and the main features.

### C. Complete the App Store Connect listing
1. At appstoreconnect.apple.com → **My Apps → LUXE Wellness**.
2. Paste the listing copy from §1, the URLs from §2, and complete App Privacy from §3.
3. Upload screenshots (§5) and select the uploaded build.
4. Paste the App Review notes from §6 and the demo account.
5. **Submit for Review.** Apple typically responds in 1–3 days.

---

## 8. Heads-up: the membership model & Apple guideline 3.1.1

The app deliberately uses the "reader / Netflix" model: the $4.99/month membership is **not** sold through in-app purchase, no purchase links appear in the app, and access is unlocked either by subscribing on the website or by redeeming an access code. This is designed to comply with Apple's rules.

There is still some review risk: Apple sometimes asks apps that gate features behind an external paid subscription to either add In-App Purchase (Apple takes 15–30%) or qualify as a "reader" app. If the reviewer pushes back on 3.1.1, the two paths are (a) add Apple In-App Purchase for the membership, or (b) argue the reader-app exemption. No action needed now — just be aware this is the most likely reason for a first-submission rejection, and it's resolvable.
