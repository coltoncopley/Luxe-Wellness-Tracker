import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, or, inArray } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import {
  db,
  usersTable,
  appSettingsTable,
  activitiesTable,
  sleepEntriesTable,
  deviceConnectionsTable,
  appointmentsTable,
  communityPostsTable,
  communityHeartsTable,
  conversations,
  restaurantsTable,
  menuItemsTable,
  foodLogsTable,
  glowCheckinsTable,
  ingredientScansTable,
  mindCheckinsTable,
  notificationPrefsTable,
  pushSubscriptionsTable,
  notificationSendsTable,
  passportEntriesTable,
  passportProfilesTable,
  progressPhotosTable,
  rewardEventsTable,
  redemptionsTable,
  referralsTable,
  skinScansTable,
  followsTable,
  shareSettingsTable,
  cheersTable,
  weightEntriesTable,
  measurementsTable,
  goalsTable,
  offerClaimsTable,
  membershipCodesTable,
  staffCodesTable,
  workoutsTable,
  workoutExercisesTable,
  workoutSetsTable,
  workoutPreferencesTable,
  exercisesTable,
  mealPlansTable,
  mealPlanPreferencesTable,
  mealPlanGroceryChecksTable,
  mealPlanMealExcludesTable,
  weeklyReportsTable,
  challengeParticipantsTable,
  routineItemsTable,
  routineCheckinsTable,
  rewardEventsTable as rewardEvents,
  type User,
} from "@workspace/db";
import {
  GetMeResponse,
  ActivateStaffAccessBody,
  ActivateStaffAccessResponse,
  AcknowledgePrivacyNoticeResponse,
  UpdateBirthdayBody,
  UpdateBirthdayResponse,
  CompleteOnboardingBody,
  CompleteOnboardingResponse,
} from "@workspace/api-zod";
import { userIdOf, forgetUser } from "../middlewares/auth";
import { getUncachableStripeClient } from "../lib/stripeClient";
import { clearSubscriptionCache } from "../middlewares/subscription";
import { ObjectStorageService } from "../lib/objectStorage";
import { POINTS } from "../lib/rewards";
import { todayET } from "../lib/dates";

const router: IRouter = Router();

const activationHits = new Map<string, { count: number; windowStart: number }>();
const ACTIVATION_LIMIT = 5;
const ACTIVATION_WINDOW_MS = 60_000;

function rateLimitActivation(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip ?? "unknown";
  const now = Date.now();
  const entry = activationHits.get(key);
  if (!entry || now - entry.windowStart > ACTIVATION_WINDOW_MS) {
    if (activationHits.size > 1000) activationHits.clear();
    activationHits.set(key, { count: 1, windowStart: now });
    next();
    return;
  }
  entry.count += 1;
  if (entry.count > ACTIVATION_LIMIT) {
    res.status(429).json({ error: "Too many attempts — try again in a minute" });
    return;
  }
  next();
}

/** Shared shape for every Me-schema response (GET /me, privacy-ack, staff-access, onboarding). */
function meShape(user: User): Record<string, unknown> {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    role: user.role,
    privacyAcknowledged: user.privacyAckAt !== null,
    onboarded: user.onboardedAt !== null,
    primaryGoal: user.primaryGoal,
    dailyActions: user.dailyActions ?? [],
    birthday: user.birthday,
  };
}

router.get("/me", async (_req, res): Promise<void> => {
  const userId = userIdOf(res);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  res.json(GetMeResponse.parse(meShape(user)));
});

/**
 * Finish the welcome wizard: store the member's "personal why" and chosen
 * daily actions, stamp onboarded_at, and (patients only) award the one-time
 * welcome points. Idempotent: re-running updates choices but the welcome
 * award's dedupe key ("welcome:once") guarantees at most one grant ever.
 */
router.post("/me/onboarding", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const body = CompleteOnboardingBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Pick a goal and at least one daily action" });
    return;
  }
  const dailyActions = [...new Set(body.data.dailyActions)];
  const [user] = await db
    .update(usersTable)
    .set({
      primaryGoal: body.data.primaryGoal,
      dailyActions,
      onboardedAt: new Date(),
    })
    .where(eq(usersTable.id, userId))
    .returning();
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  let welcomePoints = 0;
  if (user.role === "patient") {
    const inserted = await db
      .insert(rewardEvents)
      .values({
        userId,
        type: "welcome",
        date: todayET(),
        points: POINTS.welcome,
        description: "Welcome to LUXE — setup complete",
        dedupeKey: "welcome:once",
      })
      .onConflictDoNothing({ target: [rewardEvents.userId, rewardEvents.dedupeKey] })
      .returning({ id: rewardEvents.id });
    if (inserted.length > 0) welcomePoints = POINTS.welcome;
  }
  res.json(CompleteOnboardingResponse.parse({ user: meShape(user), welcomePoints }));
});

router.put("/me/birthday", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const body = UpdateBirthdayBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Birthday must be in MM-DD format" });
    return;
  }
  const [user] = await db
    .update(usersTable)
    .set({ birthday: body.data.birthday })
    .where(eq(usersTable.id, userId))
    .returning();
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  res.json(UpdateBirthdayResponse.parse({ birthday: user.birthday }));
});

router.post("/me/privacy-ack", async (_req, res): Promise<void> => {
  const userId = userIdOf(res);
  const [user] = await db
    .update(usersTable)
    .set({ privacyAckAt: new Date() })
    .where(eq(usersTable.id, userId))
    .returning();
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  res.json(AcknowledgePrivacyNoticeResponse.parse(meShape(user)));
});

/**
 * Activate staff access. The single input accepts either:
 *   1. the shared staff access code (app_settings.staff_access_code) — the
 *      legacy path and the admin-bootstrap path (admin_bootstrap_email), or
 *   2. a one-time per-person staff code (staff_codes, LWS-XXXX-XXXX) —
 *      admin-generated, strictly single-use, grants "staff" only.
 * All failures return the same coarse 403 so the response never reveals
 * whether a guessed code exists (endpoint-hardening house rule).
 */
router.post("/me/staff-access", rateLimitActivation, async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const body = ActivateStaffAccessBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [current] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!current) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  const respond = (user: typeof current): void => {
    res.json(ActivateStaffAccessResponse.parse(meShape(user)));
  };

  // Already staff/admin: nothing to activate. Short-circuit BEFORE any code
  // lookup so a one-time code is never consumed by an account that doesn't
  // need it.
  if (current.role === "staff" || current.role === "admin") {
    respond(current);
    return;
  }

  const submitted = body.data.code.trim().toUpperCase();
  const [bootstrap] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, "admin_bootstrap_email"));
  const isBootstrapAdmin =
    bootstrap !== undefined &&
    current.email !== null &&
    current.email.trim().toLowerCase() === bootstrap.value.trim().toLowerCase();

  // Path 1: the shared staff access code.
  const [setting] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, "staff_access_code"));
  if (setting && submitted === setting.value.toUpperCase()) {
    const [user] = await db
      .update(usersTable)
      .set({ role: isBootstrapAdmin ? "admin" : "staff" })
      .where(eq(usersTable.id, userId))
      .returning();
    clearSubscriptionCache(userId);
    req.log.info({ userId, role: user!.role }, "staff access activated via shared code");
    respond(user!);
    return;
  }

  // Path 2: a one-time per-person staff code. Mirrors the membership-code
  // redemption pattern: lock the code row AND the user row, re-check both
  // inside the transaction so concurrent redemptions cannot double-spend.
  const redeemed = await db.transaction(async (tx) => {
    const [code] = await tx
      .select()
      .from(staffCodesTable)
      .where(eq(staffCodesTable.code, submitted))
      .for("update");
    if (!code || code.revokedAt || code.redeemedBy) return null;
    const [lockedUser] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .for("update");
    if (!lockedUser || lockedUser.role === "staff" || lockedUser.role === "admin") return null;
    await tx
      .update(staffCodesTable)
      .set({ redeemedBy: userId, redeemedAt: new Date() })
      .where(eq(staffCodesTable.id, code.id));
    const [user] = await tx
      .update(usersTable)
      .set({ role: isBootstrapAdmin ? "admin" : "staff" })
      .where(eq(usersTable.id, userId))
      .returning();
    return user!;
  });
  if (redeemed) {
    clearSubscriptionCache(userId);
    req.log.info({ userId, role: redeemed.role }, "staff access activated via one-time code");
    respond(redeemed);
    return;
  }

  res.status(403).json({ error: "That access code is not valid" });
});

/**
 * Permanently delete the signed-in user's account and ALL associated data.
 * Available to every role (Apple App Store guideline 5.1.1(v) requires in-app
 * account deletion). Order of operations is deliberate:
 *   1. Guard against removing the last admin.
 *   2. Cancel the Stripe customer FIRST and fail hard if it errors — deleting
 *      the users row would otherwise orphan the billing link and bill forever.
 *   3. Delete every user-scoped row in FK-safe order inside one transaction.
 *   4. Best-effort external cleanup (storage objects, Clerk user) AFTER commit.
 */
router.delete("/me", async (req, res, next): Promise<void> => {
  try {
    const userId = userIdOf(res);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) {
      // Nothing to delete — succeed idempotently and clear the upsert cache.
      forgetUser(userId);
      res.status(204).end();
      return;
    }

    // Never strand the app with no admin.
    if (user.role === "admin") {
      const admins = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.role, "admin"));
      if (admins.length <= 1) {
        res.status(409).json({
          error: "You're the last admin. Make another account an admin before deleting yours.",
        });
        return;
      }
    }

    // Cancel any membership before touching the database. Deleting the Stripe
    // customer cancels all active subscriptions and erases Stripe-side PII;
    // invoices are retained as financial records.
    if (user.stripeCustomerId) {
      try {
        const stripe = await getUncachableStripeClient();
        await stripe.customers.del(user.stripeCustomerId);
      } catch (err) {
        // If a previous attempt already deleted the Stripe customer but the DB
        // transaction then failed, a retry hits "resource_missing" — treat that
        // as success so the user is never permanently stuck unable to delete.
        const code = (err as { code?: string } | null)?.code;
        if (code !== "resource_missing") {
          req.log.error(
            { err, userId },
            "Failed to cancel Stripe customer during account deletion",
          );
          res.status(502).json({
            error: "We couldn't cancel your membership just now. Please try again in a moment.",
          });
          return;
        }
      }
    }

    // Capture storage object paths before their rows disappear.
    const photos = await db
      .select({ objectPath: progressPhotosTable.objectPath })
      .from(progressPhotosTable)
      .where(eq(progressPhotosTable.userId, userId));

    await db.transaction(async (tx) => {
      // Children before parents: no FK uses ON DELETE CASCADE except
      // messages -> conversations, so every reference must be cleared by hand.
      const myRestaurants = tx
        .select({ id: restaurantsTable.id })
        .from(restaurantsTable)
        .where(eq(restaurantsTable.ownerUserId, userId));
      await tx.delete(menuItemsTable).where(inArray(menuItemsTable.restaurantId, myRestaurants));

      const myPosts = tx
        .select({ id: communityPostsTable.id })
        .from(communityPostsTable)
        .where(eq(communityPostsTable.userId, userId));
      // Hearts by me OR hearts by anyone on my posts (latter would orphan a FK).
      await tx
        .delete(communityHeartsTable)
        .where(
          or(
            eq(communityHeartsTable.userId, userId),
            inArray(communityHeartsTable.postId, myPosts),
          ),
        );
      await tx.delete(communityPostsTable).where(eq(communityPostsTable.userId, userId));

      await tx.delete(restaurantsTable).where(eq(restaurantsTable.ownerUserId, userId));
      // messages cascade from conversations.
      await tx.delete(conversations).where(eq(conversations.userId, userId));

      await tx.delete(activitiesTable).where(eq(activitiesTable.userId, userId));
      await tx.delete(sleepEntriesTable).where(eq(sleepEntriesTable.userId, userId));
      await tx.delete(deviceConnectionsTable).where(eq(deviceConnectionsTable.userId, userId));
      await tx.delete(appointmentsTable).where(eq(appointmentsTable.userId, userId));
      await tx.delete(foodLogsTable).where(eq(foodLogsTable.userId, userId));
      await tx.delete(glowCheckinsTable).where(eq(glowCheckinsTable.userId, userId));
      // Routine items FK-reference ingredient_scans, so they go first.
      await tx.delete(routineCheckinsTable).where(eq(routineCheckinsTable.userId, userId));
      await tx.delete(routineItemsTable).where(eq(routineItemsTable.userId, userId));
      await tx.delete(ingredientScansTable).where(eq(ingredientScansTable.userId, userId));
      await tx.delete(mindCheckinsTable).where(eq(mindCheckinsTable.userId, userId));
      await tx.delete(notificationPrefsTable).where(eq(notificationPrefsTable.userId, userId));
      await tx.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.userId, userId));
      await tx.delete(notificationSendsTable).where(eq(notificationSendsTable.userId, userId));
      await tx.delete(passportEntriesTable).where(eq(passportEntriesTable.userId, userId));
      await tx.delete(passportProfilesTable).where(eq(passportProfilesTable.userId, userId));
      await tx.delete(progressPhotosTable).where(eq(progressPhotosTable.userId, userId));
      await tx.delete(rewardEventsTable).where(eq(rewardEventsTable.userId, userId));
      await tx.delete(redemptionsTable).where(eq(redemptionsTable.userId, userId));
      await tx.delete(skinScansTable).where(eq(skinScansTable.userId, userId));
      await tx.delete(shareSettingsTable).where(eq(shareSettingsTable.userId, userId));
      await tx.delete(weightEntriesTable).where(eq(weightEntriesTable.userId, userId));
      await tx.delete(measurementsTable).where(eq(measurementsTable.userId, userId));
      await tx.delete(goalsTable).where(eq(goalsTable.userId, userId));

      // Meal plans, weekly reports, and challenge participation all FK to users
      // without cascade — a member with any of them would otherwise 500 the whole
      // deletion. (challenges rows are global reference data and stay put.)
      await tx
        .delete(mealPlanMealExcludesTable)
        .where(eq(mealPlanMealExcludesTable.userId, userId));
      await tx.delete(mealPlanGroceryChecksTable).where(eq(mealPlanGroceryChecksTable.userId, userId));
      await tx.delete(mealPlanPreferencesTable).where(eq(mealPlanPreferencesTable.userId, userId));
      await tx.delete(mealPlansTable).where(eq(mealPlansTable.userId, userId));
      await tx.delete(weeklyReportsTable).where(eq(weeklyReportsTable.userId, userId));
      await tx
        .delete(challengeParticipantsTable)
        .where(eq(challengeParticipantsTable.userId, userId));

      await tx
        .delete(referralsTable)
        .where(
          or(
            eq(referralsTable.referrerUserId, userId),
            eq(referralsTable.referredUserId, userId),
          ),
        );
      await tx
        .delete(followsTable)
        .where(
          or(eq(followsTable.followerUserId, userId), eq(followsTable.followeeUserId, userId)),
        );
      await tx
        .delete(cheersTable)
        .where(or(eq(cheersTable.fromUserId, userId), eq(cheersTable.toUserId, userId)));

      // No FK to users, but personal — scrub the caller's own rows.
      await tx.delete(offerClaimsTable).where(eq(offerClaimsTable.userId, userId));
      await tx.delete(membershipCodesTable).where(eq(membershipCodesTable.redeemedBy, userId));

      // Workout suite (children before parents): clear sets → workout-exercises →
      // workouts → preferences by hand, then the user's own private custom lifts
      // last. exercises.owner_user_id and workouts.user_id both FK to users without
      // cascade, so a user with any workout or custom lift would otherwise 500 the
      // whole deletion. Custom lifts are removed only after this user's
      // workout_exercises (the sole rows that can reference them) are gone.
      const myWorkouts = tx
        .select({ id: workoutsTable.id })
        .from(workoutsTable)
        .where(eq(workoutsTable.userId, userId));
      const myWorkoutExercises = tx
        .select({ id: workoutExercisesTable.id })
        .from(workoutExercisesTable)
        .where(inArray(workoutExercisesTable.workoutId, myWorkouts));
      await tx
        .delete(workoutSetsTable)
        .where(inArray(workoutSetsTable.workoutExerciseId, myWorkoutExercises));
      await tx
        .delete(workoutExercisesTable)
        .where(inArray(workoutExercisesTable.workoutId, myWorkouts));
      await tx.delete(workoutsTable).where(eq(workoutsTable.userId, userId));
      await tx.delete(workoutPreferencesTable).where(eq(workoutPreferencesTable.userId, userId));
      await tx.delete(exercisesTable).where(eq(exercisesTable.ownerUserId, userId));

      await tx.delete(usersTable).where(eq(usersTable.id, userId));
    });

    // Best-effort external cleanup now that the DB is consistent.
    const storage = new ObjectStorageService();
    for (const { objectPath } of photos) {
      try {
        const file = await storage.getObjectEntityFile(objectPath);
        await file.delete({ ignoreNotFound: true });
      } catch (err) {
        req.log.warn(
          { err, userId },
          "Failed to delete a progress photo object during account deletion",
        );
      }
    }

    try {
      await clerkClient.users.deleteUser(userId);
    } catch (err) {
      req.log.error(
        { err, userId },
        "Failed to delete Clerk user during account deletion (app data already removed)",
      );
    }

    forgetUser(userId);
    clearSubscriptionCache(userId);
    req.log.info({ userId }, "account deleted");
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
