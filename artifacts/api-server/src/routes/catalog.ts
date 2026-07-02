import { Router, type IRouter } from "express";
import { db, servicesTable, staffTable } from "@workspace/db";
import { ListServicesResponse, ListStaffResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/services", async (_req, res): Promise<void> => {
  const services = await db.select().from(servicesTable).orderBy(servicesTable.category, servicesTable.name);
  res.json(ListServicesResponse.parse(services));
});

router.get("/staff", async (_req, res): Promise<void> => {
  const staff = await db.select().from(staffTable).orderBy(staffTable.id);
  res.json(ListStaffResponse.parse(staff));
});

export default router;
