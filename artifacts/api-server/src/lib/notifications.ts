import webpush from "web-push";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  appSettingsTable,
  usersTable,
  notificationPrefsTable,
  pushSubscriptionsTable,
  notificationSendsTable,
  type NotificationPrefs,
} from "@workspace/db";
import { logger } from "./logger";

export type NotificationTopic =
  | "announcements"
  | "habitReminders"
  | "streakAlerts"
  | "weeklySummary"
  | "treatmentReminders";

export interface NotificationMessage {
  title: string;
  body: string;
  /** Path within the app the notification should open, e.g. "/glow" */
  url?: string;
}

/* ---------- VAPID keys (lazily generated, stored in app_settings) ---------- */

let cachedVapid: { publicKey: string; privateKey: string } | null = null;

export async function getVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  if (cachedVapid) return cachedVapid;
  const rows = await db
    .select()
    .from(appSettingsTable)
    .where(inArray(appSettingsTable.key, ["vapid_public_key", "vapid_private_key"]));
  const publicKey = rows.find((r) => r.key === "vapid_public_key")?.value;
  const privateKey = rows.find((r) => r.key === "vapid_private_key")?.value;
  if (publicKey && privateKey) {
    cachedVapid = { publicKey, privateKey };
    return cachedVapid;
  }
  const generated = webpush.generateVAPIDKeys();
  await db
    .insert(appSettingsTable)
    .values([
      { key: "vapid_public_key", value: generated.publicKey },
      { key: "vapid_private_key", value: generated.privateKey },
    ])
    .onConflictDoNothing();
  // Re-read in case another instance won the race
  const after = await db
    .select()
    .from(appSettingsTable)
    .where(inArray(appSettingsTable.key, ["vapid_public_key", "vapid_private_key"]));
  cachedVapid = {
    publicKey: after.find((r) => r.key === "vapid_public_key")!.value,
    privateKey: after.find((r) => r.key === "vapid_private_key")!.value,
  };
  return cachedVapid;
}

/* ---------- Preferences ---------- */

export async function getOrCreatePrefs(userId: string): Promise<NotificationPrefs> {
  const [existing] = await db
    .select()
    .from(notificationPrefsTable)
    .where(eq(notificationPrefsTable.userId, userId));
  if (existing) return existing;
  await db.insert(notificationPrefsTable).values({ userId }).onConflictDoNothing();
  const [row] = await db
    .select()
    .from(notificationPrefsTable)
    .where(eq(notificationPrefsTable.userId, userId));
  return row!;
}

/* ---------- Email via the Resend connector ---------- */

let cachedResend: { apiKey: string; fetchedAt: number } | null = null;

async function getResendApiKey(): Promise<string | null> {
  if (cachedResend && Date.now() - cachedResend.fetchedAt < 5 * 60_000) {
    return cachedResend.apiKey;
  }
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;
  if (!hostname || !xReplitToken) return null;
  try {
    const response = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=resend`,
      { headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken } },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as {
      items?: Array<{ settings?: { api_key?: string } }>;
    };
    const apiKey = data.items?.[0]?.settings?.api_key;
    if (!apiKey) return null;
    cachedResend = { apiKey, fetchedAt: Date.now() };
    return apiKey;
  } catch (err) {
    logger.warn({ err }, "Failed to fetch Resend credentials");
    return null;
  }
}

function appUrl(path = "/"): string {
  const domain =
    process.env.REPLIT_DOMAINS?.split(",")[0]?.trim() || process.env.REPLIT_DEV_DOMAIN;
  if (!domain) return path;
  return `https://${domain}${path.startsWith("/") ? path : `/${path}`}`;
}

const FROM_EMAIL =
  process.env.NOTIFICATION_FROM_EMAIL || "LUXE Wellness <onboarding@resend.dev>";

function emailHtml(message: NotificationMessage): string {
  const link = appUrl(message.url ?? "/");
  return `<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#2d2a26;">
  <h1 style="font-size:20px;letter-spacing:2px;text-transform:uppercase;color:#8a7250;margin:0 0 4px;">LUXE Wellness &amp; Aesthetics</h1>
  <hr style="border:none;border-top:1px solid #e6ded2;margin:16px 0;" />
  <h2 style="font-size:18px;margin:0 0 8px;">${escapeHtml(message.title)}</h2>
  <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">${escapeHtml(message.body)}</p>
  <a href="${link}" style="display:inline-block;background:#8a7250;color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:6px;font-size:14px;">Open the app</a>
  <p style="font-size:12px;color:#9a938a;margin-top:32px;">You're receiving this because you opted in to email notifications. You can change your preferences anytime in the app under Settings.</p>
</div>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function isEmailConfigured(): Promise<boolean> {
  return (await getResendApiKey()) !== null;
}

async function sendEmail(to: string, message: NotificationMessage): Promise<boolean> {
  const apiKey = await getResendApiKey();
  if (!apiKey) {
    logger.warn("Email notification skipped: Resend is not connected");
    return false;
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject: message.title,
        html: emailHtml(message),
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      logger.warn({ status: response.status, text }, "Resend email send failed");
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ err }, "Resend email send errored");
    return false;
  }
}

export interface ShoppingListEmailData {
  weekStart: string;
  weekEnd: string;
  people: number;
  /** Each item is a preformatted display string, e.g. "2 lb Chicken breast". */
  categories: { category: string; items: string[] }[];
}

/**
 * Sends a member's weekly shopping list to their own account email. Unlike
 * generic notifications this is a user-initiated, transactional email: it
 * bypasses notification opt-in and the dedupe ledger, and it is ONLY ever sent
 * to the address passed in (which the caller must resolve to the account email —
 * there is deliberately no arbitrary "to" relay).
 */
export async function sendShoppingListEmail(
  to: string,
  data: ShoppingListEmailData,
): Promise<boolean> {
  const apiKey = await getResendApiKey();
  if (!apiKey) {
    logger.warn("Shopping list email skipped: Resend is not connected");
    return false;
  }
  const sections = data.categories
    .map(
      (c) =>
        `<h3 style="font-size:14px;text-transform:uppercase;letter-spacing:1px;color:#8a7250;margin:20px 0 6px;">${escapeHtml(c.category)}</h3>` +
        `<ul style="margin:0;padding-left:20px;font-size:15px;line-height:1.7;color:#2d2a26;">` +
        c.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("") +
        `</ul>`,
    )
    .join("");
  const peopleLabel = data.people === 1 ? "1 person" : `${data.people} people`;
  const html = `<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#2d2a26;">
  <h1 style="font-size:20px;letter-spacing:2px;text-transform:uppercase;color:#8a7250;margin:0 0 4px;">LUXE Wellness &amp; Aesthetics</h1>
  <hr style="border:none;border-top:1px solid #e6ded2;margin:16px 0;" />
  <h2 style="font-size:18px;margin:0 0 4px;">Your shopping list</h2>
  <p style="font-size:13px;color:#9a938a;margin:0 0 8px;">Week of ${escapeHtml(data.weekStart)} – ${escapeHtml(data.weekEnd)} · scaled for ${escapeHtml(peopleLabel)}</p>
  ${sections || '<p style="font-size:15px;">Your list is empty.</p>'}
  <p style="font-size:12px;color:#9a938a;margin-top:32px;">You asked us to email this list from the LUXE app. We only ever send it to your own account email.</p>
</div>`;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject: `Your LUXE shopping list — week of ${data.weekStart}`,
        html,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      logger.warn({ status: response.status, text }, "Shopping list email send failed");
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ err }, "Shopping list email errored");
    return false;
  }
}

/* ---------- Push ---------- */

async function sendPushToUser(userId: string, message: NotificationMessage): Promise<boolean> {
  const subs = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.userId, userId));
  if (subs.length === 0) return false;
  const { publicKey, privateKey } = await getVapidKeys();
  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
    url: message.url ?? "/",
  });
  let anySent = false;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        {
          vapidDetails: {
            subject: "mailto:notifications@luxewellness.app",
            publicKey,
            privateKey,
          },
        },
      );
      anySent = true;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        // Subscription expired or revoked — clean it up
        await db
          .delete(pushSubscriptionsTable)
          .where(eq(pushSubscriptionsTable.endpoint, sub.endpoint));
      } else {
        logger.warn({ err, statusCode }, "Push send failed");
      }
    }
  }
  return anySent;
}

/* ---------- High-level notify ---------- */

export interface NotifyResult {
  push: boolean;
  email: boolean;
}

/**
 * Send a notification to a user via their enabled channels, respecting topic
 * opt-ins. `dedupeKey` guarantees at-most-once delivery per event (per user).
 */
export async function notifyUser(
  userId: string,
  topic: NotificationTopic,
  message: NotificationMessage,
  dedupeKey: string,
): Promise<NotifyResult> {
  const prefs = await getOrCreatePrefs(userId);
  if (!prefs[topic]) return { push: false, email: false };
  if (!prefs.pushEnabled && !prefs.emailEnabled) return { push: false, email: false };

  const inserted = await db
    .insert(notificationSendsTable)
    .values({ userId, dedupeKey })
    .onConflictDoNothing()
    .returning({ id: notificationSendsTable.id });
  if (inserted.length === 0) return { push: false, email: false };

  const result: NotifyResult = { push: false, email: false };
  if (prefs.pushEnabled) {
    result.push = await sendPushToUser(userId, message);
  }
  if (prefs.emailEnabled) {
    const to = prefs.emailOverride ?? (await getAccountEmail(userId));
    if (to) result.email = await sendEmail(to, message);
  }
  return result;
}

export async function getAccountEmail(userId: string): Promise<string | null> {
  const [user] = await db
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return user?.email ?? null;
}

/**
 * Direct send that bypasses the dedupe ledger — used for user-triggered test
 * notifications only.
 */
export async function sendDirect(
  userId: string,
  message: NotificationMessage,
): Promise<NotifyResult> {
  const prefs = await getOrCreatePrefs(userId);
  const result: NotifyResult = { push: false, email: false };
  if (prefs.pushEnabled) {
    result.push = await sendPushToUser(userId, message);
  }
  if (prefs.emailEnabled) {
    const to = prefs.emailOverride ?? (await getAccountEmail(userId));
    if (to) result.email = await sendEmail(to, message);
  }
  return result;
}

/** Fan an announcement out to everyone who opted in. Fire-and-forget. */
export function fanOutAnnouncement(announcementId: number, title: string): void {
  void (async () => {
    try {
      const optedIn = await db
        .select({ userId: notificationPrefsTable.userId })
        .from(notificationPrefsTable)
        .innerJoin(usersTable, eq(usersTable.id, notificationPrefsTable.userId))
        .where(eq(notificationPrefsTable.announcements, true));
      let sent = 0;
      for (const row of optedIn) {
        const res = await notifyUser(
          row.userId,
          "announcements",
          {
            title: "New at LUXE ✨",
            body: title,
            url: "/",
          },
          `announce:${announcementId}:${row.userId}`,
        );
        if (res.push || res.email) sent += 1;
      }
      logger.info({ announcementId, sent }, "Announcement notifications fanned out");
    } catch (err) {
      logger.error({ err, announcementId }, "Announcement fan-out failed");
    }
  })();
}
