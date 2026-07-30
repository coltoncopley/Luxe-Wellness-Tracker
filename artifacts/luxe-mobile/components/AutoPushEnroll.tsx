import { useAuth } from "@clerk/expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect } from "react";

import { getNotificationPrefs } from "@workspace/api-client-react";

import { configureNotificationHandler, pushSupported, registerDevice } from "@/lib/push";

const PROMPTED_KEY = "luxe.push.autoPrompted";
const ranForUsers = new Set<string>();

/**
 * Native mirror of the website's auto-enroll: push is on by default, so for
 * signed-in members whose push preference is enabled this registers the
 * phone's Expo push token — asking for OS permission once if needed. Members
 * who turned push off in Settings, or who declined the OS prompt, are left
 * alone (the Settings toggle is the way back in).
 */
export function AutoPushEnroll() {
  const { userId } = useAuth();

  useEffect(() => {
    if (!userId || ranForUsers.has(userId)) return;
    ranForUsers.add(userId);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          if (!pushSupported()) return;
          await configureNotificationHandler();
          const prefs = await getNotificationPrefs();
          if (!prefs.pushEnabled) return; // member turned push off — respect it
          // Only trigger the OS permission prompt once automatically.
          const alreadyPrompted = await AsyncStorage.getItem(PROMPTED_KEY);
          if (alreadyPrompted) {
            await registerDevice({ silent: true });
            return;
          }
          await AsyncStorage.setItem(PROMPTED_KEY, "1");
          await registerDevice();
        } catch {
          // Best-effort: the Settings toggle still works.
        }
      })();
    }, 2500);
    return () => clearTimeout(timer);
  }, [userId]);

  return null;
}
