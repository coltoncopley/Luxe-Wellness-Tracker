import { Router, type IRouter } from "express";
import { asc, desc, eq } from "drizzle-orm";
import {
  db,
  servicesTable,
  rewardItemsTable,
  redemptionsTable,
  usersTable,
  restaurantsTable,
  menuItemsTable,
} from "@workspace/db";
import {
  AdminCreateServiceBody,
  AdminCreateServiceResponse,
  AdminUpdateServiceBody,
  AdminUpdateServiceResponse,
  AdminCreateRewardItemBody,
  AdminCreateRewardItemResponse,
  AdminUpdateRewardItemBody,
  AdminUpdateRewardItemResponse,
  AdminListRewardItemsResponse,
  AdminListRedemptionsResponse,
  AdminCreateRestaurantBody,
  AdminCreateRestaurantResponse,
  AdminCreateMenuItemBody,
  AdminCreateMenuItemResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const DEFAULT_BOOKING_URL = "https://hklqy.myaestheticrecord.com/online-booking";

router.post("/admin/services", async (req, res): Promise<void> => {
  const body = AdminCreateServiceBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [row] = await db
    .insert(servicesTable)
    .values({
      ...body.data,
      bookingUrl: body.data.bookingUrl || DEFAULT_BOOKING_URL,
    })
    .returning();
  res.status(201).json(AdminCreateServiceResponse.parse(row));
});

router.patch("/admin/services/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const body = AdminUpdateServiceBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (Object.keys(body.data).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  const [row] = await db
    .update(servicesTable)
    .set(body.data)
    .where(eq(servicesTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Service not found" });
    return;
  }
  res.json(AdminUpdateServiceResponse.parse(row));
});

router.delete("/admin/services/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db.delete(servicesTable).where(eq(servicesTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Service not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/admin/restaurants", async (req, res): Promise<void> => {
  const body = AdminCreateRestaurantBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [row] = await db.insert(restaurantsTable).values(body.data).returning();
  res.status(201).json(AdminCreateRestaurantResponse.parse(row));
});

router.delete("/admin/restaurants/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const deleted = await db.transaction(async (tx) => {
    await tx.delete(menuItemsTable).where(eq(menuItemsTable.restaurantId, id));
    return tx.delete(restaurantsTable).where(eq(restaurantsTable.id, id)).returning();
  });
  if (deleted.length === 0) {
    res.status(404).json({ error: "Restaurant not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/admin/restaurants/:id/menu-items", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const body = AdminCreateMenuItemBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [restaurant] = await db
    .select()
    .from(restaurantsTable)
    .where(eq(restaurantsTable.id, id));
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found" });
    return;
  }
  const [row] = await db
    .insert(menuItemsTable)
    .values({ ...body.data, restaurantId: id })
    .returning();
  res
    .status(201)
    .json(AdminCreateMenuItemResponse.parse({ ...row, restaurantName: restaurant.name }));
});

router.delete("/admin/menu-items/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db.delete(menuItemsTable).where(eq(menuItemsTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Menu item not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/admin/reward-items", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(rewardItemsTable)
    .orderBy(asc(rewardItemsTable.sortOrder), asc(rewardItemsTable.points));
  res.json(AdminListRewardItemsResponse.parse(rows));
});

router.post("/admin/reward-items", async (req, res): Promise<void> => {
  const body = AdminCreateRewardItemBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [row] = await db.insert(rewardItemsTable).values(body.data).returning();
  res.status(201).json(AdminCreateRewardItemResponse.parse(row));
});

router.patch("/admin/reward-items/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const body = AdminUpdateRewardItemBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (Object.keys(body.data).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  const [row] = await db
    .update(rewardItemsTable)
    .set(body.data)
    .where(eq(rewardItemsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Reward item not found" });
    return;
  }
  res.json(AdminUpdateRewardItemResponse.parse(row));
});

router.delete("/admin/reward-items/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .update(rewardItemsTable)
    .set({ active: false })
    .where(eq(rewardItemsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Reward item not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/admin/redemptions", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      code: redemptionsTable.code,
      title: redemptionsTable.title,
      points: redemptionsTable.points,
      date: redemptionsTable.date,
      usedAt: redemptionsTable.usedAt,
      patientEmail: usersTable.email,
      patientName: usersTable.firstName,
    })
    .from(redemptionsTable)
    .leftJoin(usersTable, eq(redemptionsTable.userId, usersTable.id))
    .orderBy(desc(redemptionsTable.createdAt))
    .limit(200);
  res.json(
    AdminListRedemptionsResponse.parse(
      rows.map((r) => ({
        ...r,
        usedAt: r.usedAt ? r.usedAt.toISOString() : null,
      })),
    ),
  );
});

export default router;
