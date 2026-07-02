import { pgTable, text, serial, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const appointmentsTable = pgTable("appointments", {
  id: serial("id").primaryKey(),
  serviceName: text("service_name").notNull(),
  providerName: text("provider_name"),
  date: date("date", { mode: "string" }).notNull(),
  time: text("time"),
  notes: text("notes"),
  status: text("status").notNull().default("upcoming"),
});

export const insertAppointmentSchema = createInsertSchema(appointmentsTable).omit({ id: true });
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointmentsTable.$inferSelect;
