# LUXE Wellness & Aesthetics — Patient App Overview

**How to use this document:** Copy everything below into any AI (ChatGPT, Claude, Grok, etc.) and ask something like: *"Here is a description of my med spa's patient app. What do you think of it as a whole? What's missing? What would you improve or add to keep patients engaged and grow memberships?"*

---

## What the app is

A patient companion app for LUXE Wellness & Aesthetics, a physician-owned med spa in South Point, Ohio, run by Dr. Copley. It is NOT a booking system — it's a daily-engagement wellness platform that keeps patients connected to the practice between visits.

- **Who uses it:** med spa patients (weight loss, aesthetics, hormone therapy, skincare clients)
- **Business model:** $4.99/month membership with a 30-day free trial for first-time members. Staff can also gift free memberships.
- **Platforms:** website app (works on any phone or computer) plus a native iPhone app
- **Live at:** luxewellnessapp.com

## Core idea

Patients open the app daily to track their wellness, earn reward points they can redeem for real discounts at the med spa, and get personalized AI guidance. The app drives loyalty, repeat visits, and word-of-mouth referrals.

## Features (as built today)

**Home dashboard**
- Wellness Score summarizing the patient's overall consistency
- A daily AI-written personal briefing (greets them, reviews their progress, suggests a focus for the day)
- Current med spa offers and tips written by the doctor
- Streak card showing consecutive days of tracking, with milestone bonus points (7, 14, 30, 60, 100 days)

**Tracking tools**
- Weight tracking with trend charts, goal setting, and body measurements
- Food diary: log meals by searching foods, snapping a photo (AI identifies the meal and estimates nutrition), scanning a barcode, or picking from restaurant menus
- Dining Out Guide: curated healthy-pick menus for 18 local restaurant chains, plus patients can add their own restaurants (AI searches the web for the real menu) and discover restaurants near any location
- Glow: skincare routine check-ins
- Mind: mood and mindfulness check-ins (with a clear "self-care, not mental health care" disclaimer and the 988 crisis line)
- Activity & Sleep: syncs with Oura ring and phone step counting

**AI features** (all educational-only, never diagnostic)
- Luxe AI: a chat assistant that knows the patient's own tracking data and answers wellness questions
- Skin Scan: upload a selfie, get educational skin observations and at most one soft treatment suggestion
- Product Scan: photograph a skincare product label, get an ingredient-by-ingredient evaluation
- Weekly Report: an AI recap of last week's progress with wins and a focus area
- AI Meal Plan: a personalized 7-day meal plan with grocery list (limit 2 per week)

**Rewards & loyalty**
- Points for daily tracking activity (with daily caps so it can't be gamed)
- Missions and tiers (bronze/silver/gold style progression)
- Referral program: patients invite friends, both earn points
- Redemption: points convert to reward codes staff verify in person at the med spa
- Beauty Passport: stamps for trying different services

**Social & community**
- Friends: opt-in progress sharing with cheering
- Community: anonymous wins feed and monthly challenges (e.g., "log 20 days this month") with bonus points
- My Journey: a personal recap timeline of milestones and progress

**Booking**
- Service browsing with descriptions and prices; booking links out to the practice's existing scheduling system (Aesthetic Record)

**Other**
- Progress photos (private)
- BHRT (hormone therapy) education page
- Push and email reminders, strictly opt-in, generic nudges only
- Staff Portal: staff verify reward redemptions, manage offers/tips, grant comp memberships — but can NEVER see any patient health data

## Non-negotiable design principles (do not suggest changing these)

1. **Privacy wall:** patient health data (weight, food, photos, chats, moods) is never visible to staff or the practice. Staff only see reward redemptions and names/emails on those. This is intentional to stay out of HIPAA territory. Please don't suggest provider dashboards over patient health data.
2. **Medical safety:** all AI output is educational, conditional language — no diagnoses, no medication advice, defers to the doctor, at most one gentle treatment suggestion.
3. **Booking stays external** — the practice already has a scheduling system.
4. **Apple rules:** the iPhone app cannot sell the membership inside the app (patients subscribe on the website).

## What we'd like input on

- Overall impressions: is this a compelling $4.99/month value?
- What features are missing that would make patients open the app every day?
- Ideas to increase referrals and word-of-mouth
- Ideas that help the med spa business (more bookings, more retail sales) WITHOUT violating the privacy wall
- Any red flags: features that feel gimmicky, confusing, or overwhelming
- Onboarding: what would make a brand-new patient "get it" in the first 2 minutes?
