import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

import {
  registerExpoPushToken,
  unregisterExpoPushToken,
} from "@workspace/api-client-react";

// This module is the ONLY place that touches expo-notifications. Native push
// tokens don't exist on web (the LUXE website has its own web-push flow) and
// expo-notifications' remote-push APIs are unavailable in Expo Go / simulators,
// so the module is loaded lazily via a guarded dynamic import and unsupported
// environments degrade to an honest "unsupported" state instead of crashing.

type NotificationsModule = typeof import("expo-notifications");

const TOKEN_KEY = "luxe.expoPushToken";

export type PushRegisterResult =
  | "registered"
  | "denied"
  | "unsupported"
  | "conflict"
  | "failed";

let cached: NotificationsModule | null = null;
let loadFailed = false;

async function loadNotifications(): Promise<NotificationsModule | null> {
  if (cached) return cached;
  if (loadFailed) return null;
  if (Platform.OS === "web") {
    loadFailed = true;
    return null;
  }
  try {
    cached = await import("expo-notifications");
    return cached;
  } catch {
    loadFailed = true;
    return null;
  }
}

/** Whether native push can work in this environment at all. */
export function pushSupported(): boolean {
  return Platform.OS !== "web";
}

async function getExpoToken(notifications: NotificationsModule): Promise<string | null> {
  const projectId: string | undefined =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  try {
    const { data } = await notifications.getExpoPushTokenAsync({ projectId });
    return data || null;
  } catch {
    // Expo Go / simulator / no push credentials in this build
    return null;
  }
}

/**
 * Requests notification permission (if needed), fetches this device's Expo
 * push token, and registers it with the server. Safe to call when already
 * registered. When `silent` is true, never triggers the OS permission prompt —
 * it only proceeds if permission was already granted.
 */
export async function registerDevice(opts?: { silent?: boolean }): Promise<PushRegisterResult> {
  const notifications = await loadNotifications();
  if (!notifications) return "unsupported";

  let { status } = await notifications.getPermissionsAsync();
  if (status !== "granted") {
    if (opts?.silent) return "denied";
    ({ status } = await notifications.requestPermissionsAsync());
    if (status !== "granted") return "denied";
  }

  if (Platform.OS === "android") {
    await notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: notifications.AndroidImportance.DEFAULT,
    });
  }

  const token = await getExpoToken(notifications);
  if (!token) return "unsupported";

  try {
    await registerExpoPushToken({ token });
  } catch (err: unknown) {
    const statusCode = (err as { status?: number } | null)?.status;
    // Token belongs to another account (shared device). Expo tokens are bound
    // to the device+app install, so unlike web push we can't mint a fresh one.
    if (statusCode === 409) return "conflict";
    return "failed";
  }
  await AsyncStorage.setItem(TOKEN_KEY, token);
  return "registered";
}

/** Removes this device's token from the server (used when push is turned off). */
export async function unregisterDevice(): Promise<void> {
  let token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) {
    const notifications = await loadNotifications();
    if (notifications) token = await getExpoToken(notifications);
  }
  if (!token) return;
  try {
    await unregisterExpoPushToken({ token });
  } catch {
    // Best-effort — the server also cleans up dead tokens on send.
  }
  await AsyncStorage.removeItem(TOKEN_KEY);
}

/**
 * Foreground presentation: show banners even while the app is open, so test
 * notifications and daytime reminders are visible.
 */
export async function configureNotificationHandler(): Promise<void> {
  const notifications = await loadNotifications();
  if (!notifications) return;
  notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
