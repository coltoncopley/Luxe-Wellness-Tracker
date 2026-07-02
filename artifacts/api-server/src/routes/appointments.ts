import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, appointmentsTable } from "@workspace/db";
import { userIdOf } from "../middlewares/auth";
import {
  ListAppointmentsResponse,
  CreateAppointmentBody,
  CreateAppointmentResponse,
  UpdateAppointmentParams,
  UpdateAppointmentBody,
  UpdateAppointmentResponse,
  DeleteAppointmentParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/appointments", async (_req, res): Promise<void> => {
  const userId = userIdOf(res);
  const rows = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.userId, userId))
    .orderBy(asc(appointmentsTable.date));
  res.json(ListAppointmentsResponse.parse(rows));
});

router.post("/appointments", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const parsed = CreateAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(appointmentsTable)
    .values({ ...parsed.data, userId })
    .returning();
  res.status(201).json(CreateAppointmentResponse.parse(row));
});

router.patch("/appointments/:id", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const params = UpdateAppointmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(appointmentsTable)
    .set(parsed.data)
    .where(and(eq(appointmentsTable.id, params.data.id), eq(appointmentsTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }
  res.json(UpdateAppointmentResponse.parse(row));
});

router.delete("/appointments/:id", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const params = DeleteAppointmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(appointmentsTable)
    .where(and(eq(appointmentsTable.id, params.data.id), eq(appointmentsTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
