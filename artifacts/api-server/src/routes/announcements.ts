import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, announcementsTable } from "@workspace/db";
import { ListAnnouncementsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/announcements", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(announcementsTable)
    .where(eq(announcementsTable.active, true))
    .orderBy(desc(announcementsTable.createdAt))
    .limit(10);
  res.json(
    ListAnnouncementsResponse.parse({
      announcements: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    }),
  );
});

export default router;
