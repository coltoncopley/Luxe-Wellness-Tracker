import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, appSettingsTable } from "@workspace/db";
import {
  GetMeResponse,
  ActivateStaffAccessBody,
  ActivateStaffAccessResponse,
  AcknowledgePrivacyNoticeResponse,
  UpdateBirthdayBody,
  UpdateBirthdayResponse,
} from "@workspace/api-zod";
import { userIdOf } from "../middlewares/auth";

const router: IRouter = Router();

const activationHits = new Map<string, { count: number; windowStart: number }>();
const ACTIVATION_LIMIT = 5;
const ACTIVATION_WINDOW_MS = 60_000;

function rateLimitActivation(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip ?? "unknown";
  const now = Date.now();
  const entry = activationHits.get(key);
  if (!entry || now - entry.windowStart > ACTIVATION_WINDOW_MS) {
    if (activationHits.size > 1000) activationHits.clear();
    activationHits.set(key, { count: 1, windowStart: now });
    next();
    return;
  }
  entry.count += 1;
  if (entry.count > ACTIVATION_LIMIT) {
    res.status(429).json({ error: "Too many attempts — try again in a minute" });
    return;
  }
  next();
}

router.get("/me", async (_req, res): Promise<void> => {
  const userId = userIdOf(res);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  res.json(
    GetMeResponse.parse({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      role: user.role,
      privacyAcknowledged: user.privacyAckAt !== null,
      birthday: user.birthday,
    }),
  );
});

router.put("/me/birthday", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const body = UpdateBirthdayBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Birthday must be in MM-DD format" });
    return;
  }
  const [user] = await db
    .update(usersTable)
    .set({ birthday: body.data.birthday })
    .where(eq(usersTable.id, userId))
    .returning();
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  res.json(UpdateBirthdayResponse.parse({ birthday: user.birthday }));
});

router.post("/me/privacy-ack", async (_req, res): Promise<void> => {
  const userId = userIdOf(res);
  const [user] = await db
    .update(usersTable)
    .set({ privacyAckAt: new Date() })
    .where(eq(usersTable.id, userId))
    .returning();
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  res.json(
    AcknowledgePrivacyNoticeResponse.parse({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      role: user.role,
      privacyAcknowledged: true,
    }),
  );
});

router.post("/me/staff-access", rateLimitActivation, async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const body = ActivateStaffAccessBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [setting] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, "staff_access_code"));
  const submitted = body.data.code.trim().toUpperCase();
  if (!setting || submitted !== setting.value.toUpperCase()) {
    res.status(403).json({ error: "That access code is not valid" });
    return;
  }
  const [current] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  const [bootstrap] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, "admin_bootstrap_email"));
  const isBootstrapAdmin =
    bootstrap !== undefined &&
    current?.email !== null &&
    current?.email !== undefined &&
    current.email.trim().toLowerCase() === bootstrap.value.trim().toLowerCase();
  const newRole = isBootstrapAdmin || current?.role === "admin" ? "admin" : "staff";
  const [user] = await db
    .update(usersTable)
    .set({ role: newRole })
    .where(eq(usersTable.id, userId))
    .returning();
  res.json(
    ActivateStaffAccessResponse.parse({
      privacyAcknowledged: user!.privacyAckAt !== null,
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      role: user.role,
    }),
  );
});

export default router;
