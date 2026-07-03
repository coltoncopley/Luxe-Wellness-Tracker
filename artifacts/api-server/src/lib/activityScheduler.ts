import cron from "node-cron";
import { syncAllOuraConnections } from "./oura";
import { logger } from "./logger";

const TIMEZONE = "America/New_York";

export function startActivityScheduler(): void {
  cron.schedule("0 6 * * *", () => void syncAllOuraConnections(), { timezone: TIMEZONE });
  logger.info("Activity scheduler started (Oura sync daily 6:00 ET)");
}
