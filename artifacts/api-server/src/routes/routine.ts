import { Router, type IRouter } from "express";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import {
  db,
  routineItemsTable,
  routineCheckinsTable,
  ingredientScansTable,
  glowCheckinsTable,
  progressPhotosTable,
} from "@workspace/db";
import {
  GetRoutineResponse,
  UpdateRoutineBody,
  UpdateRoutineResponse,
  UpdateRoutineCheckinBody,
  UpdateRoutineCheckinResponse,
} from "@workspace/api-zod";
import { userIdOf } from "../middlewares/auth";
import { todayET, addDays } from "../lib/dates";

const router: IRouter = Router();

/** Shared response builder: routine items + today's check-off + photo nudge. */
async function routineState(userId: string): Promise<Record<string, unknown>> {
  const today = todayET();
  const [items, checkins, recentPhotos] = await Promise.all([
    db
      .select()
      .from(routineItemsTable)
      .where(eq(routineItemsTable.userId, userId))
      .orderBy(asc(routineItemsTable.period), asc(routineItemsTable.position)),
    db
      .select()
      .from(routineCheckinsTable)
      .where(and(eq(routineCheckinsTable.userId, userId), eq(routineCheckinsTable.date, today)))
      .limit(1),
    db
      .select({ id: progressPhotosTable.id })
      .from(progressPhotosTable)
      .where(
        and(
          eq(progressPhotosTable.userId, userId),
          gte(progressPhotosTable.takenOn, addDays(today, -6)),
        ),
      )
      .limit(1),
  ]);
  const checkin = checkins[0];
  return {
    items: items.map((i) => ({
      id: i.id,
      period: i.period,
      position: i.position,
      productName: i.productName,
      ingredientScanId: i.ingredientScanId,
    })),
    today: {
      amDone: checkin?.amDone ?? false,
      pmDone: checkin?.pmDone ?? false,
      sunscreenUsed: checkin?.sunscreenUsed ?? false,
    },
    photoDue: recentPhotos.length === 0,
  };
}

router.get("/routine", async (_req, res): Promise<void> => {
  const userId = userIdOf(res);
  res.json(GetRoutineResponse.parse(await routineState(userId)));
});

router.put("/routine", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const body = UpdateRoutineBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Each product needs a name (max 10 per routine)" });
    return;
  }

  // Ownership check: linked scans must belong to the caller.
  const scanIds = [...body.data.am, ...body.data.pm]
    .map((i) => i.ingredientScanId)
    .filter((id): id is number => id != null);
  if (scanIds.length > 0) {
    const owned = await db
      .select({ id: ingredientScansTable.id })
      .from(ingredientScansTable)
      .where(
        and(eq(ingredientScansTable.userId, userId), inArray(ingredientScansTable.id, scanIds)),
      );
    const ownedIds = new Set(owned.map((r) => r.id));
    if (!scanIds.every((id) => ownedIds.has(id))) {
      res.status(400).json({ error: "One of the linked product scans was not found" });
      return;
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(routineItemsTable).where(eq(routineItemsTable.userId, userId));
    const rows = [
      ...body.data.am.map((item, idx) => ({
        userId,
        period: "am",
        position: idx,
        productName: item.productName.trim(),
        ingredientScanId: item.ingredientScanId ?? null,
      })),
      ...body.data.pm.map((item, idx) => ({
        userId,
        period: "pm",
        position: idx,
        productName: item.productName.trim(),
        ingredientScanId: item.ingredientScanId ?? null,
      })),
    ].filter((r) => r.productName.length > 0);
    if (rows.length > 0) await tx.insert(routineItemsTable).values(rows);
  });

  res.json(UpdateRoutineResponse.parse(await routineState(userId)));
});

router.patch("/routine/checkin", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const body = UpdateRoutineCheckinBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid check-in" });
    return;
  }
  const today = todayET();
  const patch: Partial<{ amDone: boolean; pmDone: boolean; sunscreenUsed: boolean }> = {};
  if (body.data.amDone !== undefined) patch.amDone = body.data.amDone;
  if (body.data.pmDone !== undefined) patch.pmDone = body.data.pmDone;
  if (body.data.sunscreenUsed !== undefined) patch.sunscreenUsed = body.data.sunscreenUsed;

  const [row] = await db
    .insert(routineCheckinsTable)
    .values({ userId, date: today, ...patch })
    .onConflictDoUpdate({
      target: [routineCheckinsTable.userId, routineCheckinsTable.date],
      set: patch,
    })
    .returning();

  // Mirror into the Glow check-in (no new points — the glow award already
  // covers skincare). Idempotent upsert that only ever flips the flag on.
  if (row && (row.amDone || row.pmDone)) {
    await db
      .insert(glowCheckinsTable)
      .values({ userId, date: today, skincareDone: true })
      .onConflictDoUpdate({
        target: [glowCheckinsTable.userId, glowCheckinsTable.date],
        set: { skincareDone: true },
      });
  }

  res.json(UpdateRoutineCheckinResponse.parse(await routineState(userId)));
});

export default router;
