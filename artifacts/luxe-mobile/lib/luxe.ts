import * as ImagePicker from "expo-image-picker";

export const BOOKING_URL = "https://hklqy.myaestheticrecord.com/online-booking";

const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "";

/**
 * Launch the camera or photo library and return the picked asset (or null if
 * the user cancels). Requests the relevant permission first and throws a
 * user-facing error message when permission is denied.
 */
export async function pickImageAsset(
  source: "camera" | "library",
  opts?: { base64?: boolean },
): Promise<ImagePicker.ImagePickerAsset | null> {
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      throw new Error("Camera access is needed to take a photo. Enable it in Settings.");
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      base64: opts?.base64,
    });
    return res.canceled ? null : (res.assets[0] ?? null);
  }
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error("Photo library access is needed. Enable it in Settings.");
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.7,
    base64: opts?.base64,
  });
  return res.canceled ? null : (res.assets[0] ?? null);
}

export function webUrl(path: string): string {
  return `https://${domain}${path}`;
}

export function apiUrl(path: string): string {
  return `https://${domain}/api${path}`;
}

/** Local date as YYYY-MM-DD */
export function todayStr(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** "2026-07-03" -> "Jul 3" */
export function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** ISO timestamp -> "3h ago", "2d ago", etc. */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, Date.now() - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
