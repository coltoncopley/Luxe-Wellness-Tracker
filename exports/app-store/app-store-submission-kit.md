# LUXE Wellness & Aesthetics — App Store Submission Kit

Everything prepared for an Apple App Store listing, plus a checklist of what's still needed.

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
> • Browse local restaurant menus with healthy picks and ordering tips
> • Daily calorie summary so you always know where you stand
>
> YOUR DAILY GLOW SCORE
> • One simple 0–100 score for your whole day: water, sleep, stress, movement, protein, and skincare
> • Build streaks and watch your 14-day trend
>
> EARN REAL REWARDS
> • Get points for weigh-ins, meal logs, and daily check-ins
> • Redeem points for treatment perks at LUXE — show your code at the front desk
>
> MEET LUXE AI
> • A 24/7 wellness assistant that knows our services and team
> • Ask about treatments, skincare, or GLP-1 lifestyle tips anytime
>
> BOOK IN SECONDS
> • Browse our full service menu and meet our team
> • Book online through our secure scheduling portal
>
> LUXE Wellness and Aesthetics is a physician-owned med spa led by Dr. Copley in South Point, OH.
>
> This app is a wellness companion, not a medical device. It does not provide medical advice, diagnosis, or treatment. Always consult your healthcare provider about medical questions.

**Keywords** (100 char max)
> med spa,wellness,GLP-1,weight tracker,glow,skincare,botox,aesthetics,food log,rewards,South Point

**Category**
> Primary: Health & Fitness · Secondary: Lifestyle

**Age Rating**
> 17+ (unrestricted web access via booking links; wellness content). Answer "None" for all objectionable-content questions; answer YES to "Unrestricted Web Access" only if the in-app booking link opens inside the app rather than Safari.

---

## 2. Required URLs

These pages are now live inside the app and will be public once the app is published:

| Requirement | URL (after publishing) |
|---|---|
| Privacy Policy URL (required) | `https://<your-published-domain>/privacy` |
| Support URL (required) | `https://<your-published-domain>/support` |
| Terms of Use / EULA (optional) | `https://<your-published-domain>/terms` |
| Marketing URL (optional) | `https://<your-published-domain>/` |

**Action needed:** publish the app so these URLs are live on a real domain, then paste the final URLs into App Store Connect.

---

## 3. Apple Privacy "Nutrition Label" answers

In App Store Connect → App Privacy, declare:

**Data collected and linked to the user:** None (the app has no accounts/login).

**Data collected but NOT linked to identity:**
- Health & Fitness → Fitness (weight, measurements, habit check-ins) — App Functionality
- Health & Fitness → Nutrition-adjacent (food logs) — declare under "Other Usage Data" or Fitness — App Functionality
- User Content → Photos (meal photos, processed for analysis, not stored) — App Functionality
- User Content → Other User Content (AI chat messages) — App Functionality

**Data used for tracking:** None. No advertising, no third-party analytics, no data sold or shared for marketing.

**Photo permission string (Info.plist / Expo config):**
> NSCameraUsageDescription: "LUXE uses your camera to photograph meals so AI can estimate nutrition."
> NSPhotoLibraryUsageDescription: "LUXE lets you pick a meal photo so AI can estimate nutrition."

---

## 4. Screenshots (captured, in `screenshots/appstore/`)

| File | Shows |
|---|---|
| 01-dashboard.jpg | Welcome dashboard: weight goal, calories, streak, next appointment |
| 02-weight.jpg | Weight & measurements with goal progress |
| 03-glow.jpg | Daily Glow Score 87 with 9-day streak and trend chart |
| 04-food.jpg | Daily food log with macros and meal scanner button |
| 05-rewards.jpg | LUXE Rewards points and earning guide |
| 06-book.jpg | Booking & appointments |

**Important:** Apple requires exact pixel sizes — 1290 × 2796 px for the 6.7" iPhone (required) and 2048 × 2732 px for 12.9" iPad (if iPad is supported). These captures (430 × 932 css-px) are the right aspect ratio for iPhone but must be re-exported at full resolution from the final native app, or upscaled/framed with a tool like AppLaunchpad, Screenshots.pro, or Figma device frames. Apple also rejects screenshots that don't come from the actual app UI, so retake them from the native build before submitting.

---

## 5. App Review notes (paste into "Notes for Review")

> This is a wellness companion app for patients of LUXE Wellness and Aesthetics, a physician-owned medical spa in South Point, Ohio. The app is for self-tracking of lifestyle habits (weight, meals, hydration, sleep) and does not provide medical advice, diagnosis, or treatment — disclaimers appear in-app and in our Terms of Use. AI features (meal photo nutrition estimates and a wellness chat assistant) include disclaimers that outputs are estimates and not medical advice. Appointment booking links out to our existing scheduling provider (Aesthetic Record); no purchases occur in the app, so no in-app purchase entitlement is used. The rewards program redeems points for in-office perks only (no cash value). No account is required to use the app.

---

## 6. Remaining checklist — what you still need

1. **A native iOS build — the big one.** The App Store only accepts native apps, and the current app is a web app. Apple's guideline 4.2 rejects apps that are "just a website in a wrapper." The good news: this app's feature set (camera meal scanner, daily check-ins, rewards) justifies a native version. I can build an iOS/Android version (Expo/React Native) that reuses the same backend — just ask.
   - *Alternative with zero Apple involvement:* publish as a **web app** and patients "Add to Home Screen" — it looks and feels like an app, no App Store review, live today.
2. **Apple Developer account** — $99/year, enroll at developer.apple.com (as the business, which requires a D-U-N-S number, or as an individual).
3. **Publish this app** so the Privacy/Support/Terms URLs are live (I can start that anytime).
4. **App icon** — 1024 × 1024 px, no transparency, no rounded corners. The LUXE logo can be adapted; I can generate this.
5. **Retake screenshots at full resolution** from the native build (see section 4).
6. **Add patient logins before distributing to multiple patients — effectively required.** Right now the app has no accounts, so everyone using the same installation sees the same data. That's fine for a single-user pilot, but an App Store app used by many patients needs login + per-patient data separation before launch (the privacy policy now states this plainly). Once accounts exist, Apple also requires an in-app "Delete Account" option. This connects to the login decision we discussed earlier — say the word and I'll build it.
7. **Optional but wise for a health app:** run the listing past your attorney, since LUXE is a medical practice — the disclaimers in Privacy/Terms are a solid start but aren't legal advice.
