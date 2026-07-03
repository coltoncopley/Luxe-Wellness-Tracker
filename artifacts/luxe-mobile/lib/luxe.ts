export const BOOKING_URL = "https://hklqy.myaestheticrecord.com/online-booking";

const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "";

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

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
