import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, progressPhotosTable } from "@workspace/db";
import { CreateProgressPhotoBody } from "@workspace/api-zod";
import { ObjectStorageService } from "../lib/objectStorage";
import { POINTS, awardOncePerDay } from "../lib/rewards";

function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

function toPhotoResponse(row: typeof progressPhotosTable.$inferSelect) {
  return {
    id: row.id,
    takenOn: row.takenOn,
    category: row.category,
    note: row.note,
    objectPath: row.objectPath,
    createdAt: row.createdAt.toISOString(),
  };
}

router.get("/photos", async (_req: Request, res: Response) => {
  const userId = res.locals.userId as string;
  const rows = await db
    .select()
    .from(progressPhotosTable)
    .where(eq(progressPhotosTable.userId, userId))
    .orderBy(desc(progressPhotosTable.takenOn), desc(progressPhotosTable.id));
  res.json(rows.map(toPhotoResponse));
});

router.post("/photos", async (req: Request, res: Response) => {
  const userId = res.locals.userId as string;
  const parsed = CreateProgressPhotoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { objectPath: rawPath, takenOn, category, note } = parsed.data;

  // Ownership check: upload paths are issued per-user as
  // /objects/uploads/<userId>/<uuid>, so a user can only register
  // objects that were uploaded via their own presigned URL.
  const normalized = objectStorageService.normalizeObjectEntityPath(rawPath);
  const expectedPrefix = `/objects/uploads/${userId}/`;
  const remainder = normalized.startsWith(expectedPrefix)
    ? normalized.slice(expectedPrefix.length)
    : null;
  if (
    !remainder ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(remainder)
  ) {
    res.status(403).json({ error: "Invalid photo upload" });
    return;
  }

  let objectPath: string;
  try {
    objectPath = await objectStorageService.trySetObjectEntityAclPolicy(normalized, {
      owner: userId,
      visibility: "private",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to set ACL on progress photo");
    res.status(400).json({ error: "Invalid photo upload" });
    return;
  }

  const [row] = await db
    .insert(progressPhotosTable)
    .values({ userId, takenOn, category, note: note ?? null, objectPath })
    .returning();

  await awardOncePerDay(
    userId,
    "photo",
    todayString(),
    POINTS.progressPhoto,
    "Progress photo added",
  );

  res.status(201).json(toPhotoResponse(row!));
});

router.delete("/photos/:id", async (req: Request, res: Response) => {
  const userId = res.locals.userId as string;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [deleted] = await db
    .delete(progressPhotosTable)
    .where(and(eq(progressPhotosTable.id, id), eq(progressPhotosTable.userId, userId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(204).end();
});

export default router;
