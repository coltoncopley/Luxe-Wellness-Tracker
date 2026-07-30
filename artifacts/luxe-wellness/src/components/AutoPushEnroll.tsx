import { useEffect } from "react";
import { useUser } from "@clerk/react";
import { getNotificationPrefs } from "@workspace/api-client-react";
import { pushSupported, subscribeDevice } from "@/lib/push";

const PROMPTED_KEY = "luxe-push-auto-prompted";
const ranForUsers = new Set<string>();

/**
 * Push notifications are on by default: for signed-in members whose push
 * preference is enabled (the default), this silently registers the device —
 * asking for browser permission once if needed. Members who turned push off
 * in Settings, or who dismissed/blocked the browser prompt, are left alone.
 */
export function AutoPushEnroll() {
  const { user } = useUser();
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId || ranForUsers.has(userId)) return;
    ranForUsers.add(userId);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          if (!pushSupported()) return;
          if (Notification.permission === "denied") return;
          // Only ask once automatically; after a dismissal the Settings
          // toggle is the way back in.
          if (Notification.permission === "default" && localStorage.getItem(PROMPTED_KEY)) {
            return;
          }
          const prefs = await getNotificationPrefs();
          if (!prefs.pushEnabled) return; // member turned push off — respect it
          localStorage.setItem(PROMPTED_KEY, "1");
          await subscribeDevice();
        } catch {
          // Best-effort: the Settings toggle still works.
        }
      })();
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [userId]);
  return null;
}
