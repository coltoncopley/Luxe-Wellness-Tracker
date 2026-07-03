import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Weekly tips from the doctor, with an admin approval queue.
 * status: "draft" (needs admin approval) -> "approved" (queued to send) -> "sent" (published).
 * The weekly scheduler publishes the oldest approved tip; admin can also send now.
 * (DB table is named wellness_tips; distinct from the static "tips" catalog table.)
 */
export const doctorTipsTable = pgTable("wellness_tips", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("draft"), // "draft" | "approved" | "sent"
  source: text("source").notNull().default("manual"), // "ai" | "manual"
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

export type DoctorTip = typeof doctorTipsTable.$inferSelect;
