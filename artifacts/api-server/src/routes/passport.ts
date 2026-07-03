import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, passportEntriesTable, passportProfilesTable } from "@workspace/db";
import {
  GetPassportResponse,
  CreatePassportEntryBody,
  CreatePassportEntryResponse,
  UpdatePassportProfileBody,
  UpdatePassportProfileResponse,
  DeletePassportEntryParams,
  UpdatePassportReminderParams,
  UpdatePassportReminderBody,
  UpdatePassportReminderResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function entryToResponse(row: typeof passportEntriesTable.$inferSelect) {
  return {
    id: row.id,
    entryType: row.entryType,
    performedOn: row.performedOn,
    title: row.title,
    product: row.product,
    amount: row.amount,
    area: row.area,
    provider: row.provider,
    notes: row.notes,
    reminderOn: row.reminderOn,
  };
}

function profileToResponse(row: typeof passportProfilesTable.$inferSelect | undefined) {
  return {
    allergies: row?.allergies ?? "",
    skinType: row?.skinType ?? "",
    skincareRoutine: row?.skincareRoutine ?? "",
  };
}

router.get("/passport", async (_req: Request, res: Response) => {
  const userId = res.locals.userId as string;
  const [profileRows, entryRows] = await Promise.all([
    db.select().from(passportProfilesTable).where(eq(passportProfilesTable.userId, userId)).limit(1),
    db
      .select()
      .from(passportEntriesTable)
      .where(eq(passportEntriesTable.userId, userId))
      .orderBy(desc(passportEntriesTable.performedOn), desc(passportEntriesTable.id)),
  ]);
  res.json(
    GetPassportResponse.parse({
      profile: profileToResponse(profileRows[0]),
      entries: entryRows.map(entryToResponse),
    }),
  );
});

router.put("/passport/profile", async (req: Request, res: Response) => {
  const userId = res.locals.userId as string;
  const body = UpdatePassportProfileBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [row] = await db
    .insert(passportProfilesTable)
    .values({ userId, ...body.data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: passportProfilesTable.userId,
      set: { ...body.data, updatedAt: new Date() },
    })
    .returning();
  res.json(UpdatePassportProfileResponse.parse(profileToResponse(row!)));
});

router.post("/passport/entries", async (req: Request, res: Response) => {
  const userId = res.locals.userId as string;
  const body = CreatePassportEntryBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [row] = await db
    .insert(passportEntriesTable)
    .values({
      userId,
      entryType: body.data.entryType,
      performedOn: body.data.performedOn,
      title: body.data.title,
      product: body.data.product ?? null,
      amount: body.data.amount ?? null,
      area: body.data.area ?? null,
      provider: body.data.provider ?? null,
      notes: body.data.notes ?? null,
      reminderOn: body.data.reminderOn ?? null,
    })
    .returning();
  res.status(201).json(CreatePassportEntryResponse.parse(entryToResponse(row!)));
});

router.put("/passport/entries/:id/reminder", async (req: Request, res: Response) => {
  const userId = res.locals.userId as string;
  const params = UpdatePassportReminderParams.safeParse(req.params);
  if (!params.success) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const body = UpdatePassportReminderBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [row] = await db
    .update(passportEntriesTable)
    .set({ reminderOn: body.data.reminderOn })
    .where(
      and(eq(passportEntriesTable.id, params.data.id), eq(passportEntriesTable.userId, userId)),
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(UpdatePassportReminderResponse.parse(entryToResponse(row)));
});

router.delete("/passport/entries/:id", async (req: Request, res: Response) => {
  const userId = res.locals.userId as string;
  const params = DeletePassportEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const deleted = await db
    .delete(passportEntriesTable)
    .where(
      and(eq(passportEntriesTable.id, params.data.id), eq(passportEntriesTable.userId, userId)),
    )
    .returning({ id: passportEntriesTable.id });
  if (deleted.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(204).end();
});

export default router;
