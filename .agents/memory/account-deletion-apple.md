---
name: Account deletion & Apple 5.1.1(v) reachability
description: Why in-app account deletion must live on the paywall/gate, and the sign-out-before-cache-clear ordering that avoids resurrecting the deleted user row.
---

# Account deletion (Apple 5.1.1(v))

## Deletion must be reachable by signed-in NON-members
Apple reviewers test account deletion with accounts that have no active subscription. Both paywalls here (web `SubscriptionGate`, mobile `MembershipGate`) FULLY REPLACE all app content for non-members — so a delete button that lives only on the Settings page (which sits behind the gate) is unreachable and fails review.

**Rule:** the delete affordance (and a sign-out escape hatch) must be rendered ON the gate/paywall itself, in its unconditional section, not just inside gated Settings. Verify it survives every non-member paywall state (never-subscribed, canceled/incomplete, past_due). Transient states (loading spinner, activation polling, billing-fetch error+Retry) are acceptable to skip.

**Why:** a paywall that replaces content leaves lapsed/never-subscribed users with no path to delete (or even sign out) → guaranteed 5.1.1(v) rejection.

## Sign out BEFORE clearing the query cache
In the delete flow, call `signOut()` FIRST, then `queryClient.clear()`.

**Why:** `queryClient.clear()` triggers immediate refetches of still-mounted observers (billing status, `/me`, notification prefs). Clerk session JWTs stay verifiable for ~60s after the user is deleted, so those refetches re-run `requireAuth → ensureUserRow` and RESURRECT the just-deleted user row (a bare orphan ID — Clerk getUser fails so no PII, but it contradicts "permanently deleted"). Signing out first invalidates the cookie/token → refetches 401 → no upsert.

**How to apply:** keep this ordering in every DeleteAccountButton (web `handleDelete`, mobile mutation `onSuccess`). A shared `DeleteAccountButton` component per platform is reused by both Settings and the gate so the logic lives in one place.

## Every new user-scoped table must join the DELETE /me chain
`DELETE /api/me` deletes user data by hand, in FK-safe order, inside one transaction — it does NOT rely on `ON DELETE CASCADE`. Any table with a NO-cascade FK to `users` (or one reachable only through such a table) that you forget to add will FK-500 the whole deletion for any user who has a row there, silently breaking account deletion (Apple 5.1.1(v)) until someone hits it.

**Why:** the workout suite shipped without touching me.ts — `workouts.user_id`, `workout_preferences.user_id`, and `exercises.owner_user_id` (patient-private custom lifts) are all no-cascade FKs, so any user with a workout or a custom lift could not delete their account.

**How to apply:** whenever you add a table (or a nullable owner column like `exercises.owner_user_id`) that references `users` without cascade, add a matching delete to the me.ts transaction, children before parents. Owner-scoped reference rows (custom lifts) must be deleted AFTER the user's own child rows that point at them (their `workout_exercises`), never before. Delete-order safety holds only because cross-user writes are `visibleExercises(userId)`-scoped, so no other user's rows can reference your custom lifts.
