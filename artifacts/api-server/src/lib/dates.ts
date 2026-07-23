const ET_TIMEZONE = "America/New_York";

/** Today's date in Eastern Time as YYYY-MM-DD (matches scheduler boundaries). */
export function todayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: ET_TIMEZONE });
}

/** Add (or subtract) days to a YYYY-MM-DD string, timezone-free. */
export function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

/** Month (YYYY-MM) containing the given ET date. */
export function monthOfET(dateStr = todayET()): string {
  return dateStr.slice(0, 7);
}

/** Add (or subtract) months to a YYYY-MM string. */
export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return dt.toISOString().slice(0, 7);
}

/** First and last day of a YYYY-MM month as YYYY-MM-DD strings. */
export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, "0")}` };
}

/** Monday-based week containing the given ET date, as YYYY-MM-DD strings. */
export function weekOfET(dateStr = todayET()): { weekStart: string; weekEnd: string } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  const sinceMonday = (dt.getUTCDay() + 6) % 7;
  const start = addDays(dateStr, -sinceMonday);
  return { weekStart: start, weekEnd: addDays(start, 6) };
}
