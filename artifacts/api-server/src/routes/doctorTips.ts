import { Router, type IRouter } from "express";
import { desc, eq, isNotNull, and } from "drizzle-orm";
import { db, doctorTipsTable } from "@workspace/db";
import { GetCurrentDoctorTipResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/doctor-tips/current", async (_req, res): Promise<void> => {
  const [tip] = await db
    .select()
    .from(doctorTipsTable)
    .where(and(eq(doctorTipsTable.status, "sent"), isNotNull(doctorTipsTable.sentAt)))
    .orderBy(desc(doctorTipsTable.sentAt))
    .limit(1);
  res.json(
    GetCurrentDoctorTipResponse.parse({
      tip: tip
        ? {
            id: tip.id,
            title: tip.title,
            body: tip.body,
            status: tip.status,
            source: tip.source,
            createdAt: tip.createdAt.toISOString(),
            approvedAt: tip.approvedAt ? tip.approvedAt.toISOString() : null,
            sentAt: tip.sentAt ? tip.sentAt.toISOString() : null,
          }
        : null,
    }),
  );
});

export default router;
