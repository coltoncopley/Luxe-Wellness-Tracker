import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, notificationPrefsTable, pushSubscriptionsTable } from "@workspace/db";
import {
  GetNotificationPrefsResponse,
  UpdateNotificationPrefsBody,
  UpdateNotificationPrefsResponse,
  GetVapidPublicKeyResponse,
  SubscribePushBody,
  UnsubscribePushBody,
  SendTestNotificationResponse,
} from "@workspace/api-zod";
import { userIdOf } from "../middlewares/auth";
import {
  getOrCreatePrefs,
  getVapidKeys,
  getAccountEmail,
  sendDirect,
} from "../lib/notifications";

const router: IRouter = Router();

async function prefsPayload(userId: string) {
  const prefs = await getOrCreatePrefs(userId);
  const accountEmail = await getAccountEmail(userId);
  return {
    pushEnabled: prefs.pushEnabled,
    emailEnabled: prefs.emailEnabled,
    emailOverride: prefs.emailOverride,
    accountEmail,
    announcements: prefs.announcements,
    habitReminders: prefs.habitReminders,
    streakAlerts: prefs.streakAlerts,
    weeklySummary: prefs.weeklySummary,
    treatmentReminders: prefs.treatmentReminders,
  };
}

router.get("/notifications/prefs", async (_req, res): Promise<void> => {
  const userId = userIdOf(res);
  res.json(GetNotificationPrefsResponse.parse(await prefsPayload(userId)));
});

router.put("/notifications/prefs", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const body = UpdateNotificationPrefsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid preferences" });
    return;
  }
  const update = body.data;
  if (
    update.emailOverride !== undefined &&
    update.emailOverride !== null &&
    update.emailOverride.trim() !== "" &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(update.emailOverride.trim())
  ) {
    res.status(400).json({ error: "Please enter a valid email address" });
    return;
  }
  await getOrCreatePrefs(userId);
  const values: Partial<typeof notificationPrefsTable.$inferInsert> = { updatedAt: new Date() };
  if (update.pushEnabled !== undefined) values.pushEnabled = update.pushEnabled;
  if (update.emailEnabled !== undefined) values.emailEnabled = update.emailEnabled;
  if (update.emailOverride !== undefined) {
    values.emailOverride =
      update.emailOverride === null || update.emailOverride.trim() === ""
        ? null
        : update.emailOverride.trim();
  }
  if (update.announcements !== undefined) values.announcements = update.announcements;
  if (update.habitReminders !== undefined) values.habitReminders = update.habitReminders;
  if (update.streakAlerts !== undefined) values.streakAlerts = update.streakAlerts;
  if (update.weeklySummary !== undefined) values.weeklySummary = update.weeklySummary;
  if (update.treatmentReminders !== undefined)
    values.treatmentReminders = update.treatmentReminders;
  await db
    .update(notificationPrefsTable)
    .set(values)
    .where(eq(notificationPrefsTable.userId, userId));
  res.json(UpdateNotificationPrefsResponse.parse(await prefsPayload(userId)));
});

router.get("/notifications/vapid-public-key", async (_req, res): Promise<void> => {
  const { publicKey } = await getVapidKeys();
  res.json(GetVapidPublicKeyResponse.parse({ publicKey }));
});

router.post("/notifications/push/subscribe", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const body = SubscribePushBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid subscription" });
    return;
  }
  const { endpoint, keys } = body.data;
  // Never transfer an endpoint owned by a different user (ownership takeover
  // guard). The client handles 409 by creating a fresh browser subscription.
  const [existing] = await db
    .select({ userId: pushSubscriptionsTable.userId })
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.endpoint, endpoint))
    .limit(1);
  if (existing && existing.userId !== userId) {
    res.status(409).json({ error: "This device is registered to another account" });
    return;
  }
  await db
    .insert(pushSubscriptionsTable)
    .values({ userId, endpoint, p256dh: keys.p256dh, auth: keys.auth })
    .onConflictDoUpdate({
      target: pushSubscriptionsTable.endpoint,
      set: { userId, p256dh: keys.p256dh, auth: keys.auth },
    });
  res.status(204).end();
});

router.post("/notifications/push/unsubscribe", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const body = UnsubscribePushBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  await db
    .delete(pushSubscriptionsTable)
    .where(
      and(
        eq(pushSubscriptionsTable.endpoint, body.data.endpoint),
        eq(pushSubscriptionsTable.userId, userId),
      ),
    );
  res.status(204).end();
});

router.post("/notifications/test", async (_req, res): Promise<void> => {
  const userId = userIdOf(res);
  const result = await sendDirect(userId, {
    title: "Test from LUXE Wellness ✨",
    body: "Notifications are working! You'll get updates here based on your preferences.",
    url: "/",
  });
  res.json(SendTestNotificationResponse.parse(result));
});

export default router;
