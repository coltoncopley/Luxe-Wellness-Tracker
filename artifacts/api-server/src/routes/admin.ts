import { Router, type IRouter } from "express";
import { asc, desc, eq, gt, or, sql } from "drizzle-orm";
import {
  db,
  servicesTable,
  rewardItemsTable,
  redemptionsTable,
  usersTable,
  restaurantsTable,
  menuItemsTable,
  communityPostsTable,
  communityHeartsTable,
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
  AdminListCompsResponse,
  AdminGrantCompBody,
  AdminGrantCompResponse,
  ModerateCommunityPostBody,
  AdminListCommunityPostsResponse,
  AdminListStaffResponse,
  AdminUpdateStaffRoleBody,
  AdminUpdateStaffRoleResponse,
  AdminGetAccessCodeResponse,
  AdminUpdateAccessCodeBody,
  AdminUpdateAccessCodeResponse,
} from "@workspace/api-zod";
import { clearSubscriptionCache } from "../middlewares/subscription";
import { requireAdmin, isStaffRole } from "../middlewares/auth";
import { appSettingsTable } from "@workspace/db";

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

/** Add months to a date, clamping the day-of-month to the target month's last day
 *  (e.g. Jan 31 + 1 month = Feb 28/29, not Mar 2/3). */
function addMonthsClamped(from: Date, months: number): Date {
  const d = new Date(from);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

function toCompAccess(u: {
  id: string;
  email: string | null;
  firstName: string | null;
  compLifetime: boolean;
  compUntil: Date | null;
}) {
  return {
    userId: u.id,
    email: u.email,
    firstName: u.firstName,
    lifetime: u.compLifetime,
    until: u.compLifetime ? null : (u.compUntil?.toISOString() ?? null),
  };
}

router.get("/admin/comps", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      compLifetime: usersTable.compLifetime,
      compUntil: usersTable.compUntil,
    })
    .from(usersTable)
    .where(or(eq(usersTable.compLifetime, true), gt(usersTable.compUntil, new Date())))
    .orderBy(asc(usersTable.email));
  res.json(AdminListCompsResponse.parse(rows.map(toCompAccess)));
});

router.post("/admin/comps", async (req, res): Promise<void> => {
  const body = AdminGrantCompBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const email = body.data.email.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(usersTable)
    .where(sql`lower(${usersTable.email}) = ${email}`);
  if (!user) {
    res.status(404).json({
      error: "No account found with that email. The patient must sign up first.",
    });
    return;
  }

  const lifetime = body.data.lifetime === true;
  const months = body.data.months ?? 1;
  if (!lifetime && ![1, 3, 6, 12].includes(months)) {
    res.status(400).json({ error: "Months must be 1, 3, 6, or 12" });
    return;
  }
  const until = addMonthsClamped(new Date(), months);

  const [updated] = await db
    .update(usersTable)
    .set({
      compLifetime: lifetime,
      compUntil: lifetime ? null : until,
    })
    .where(eq(usersTable.id, user.id))
    .returning();
  clearSubscriptionCache(user.id);
  res.json(AdminGrantCompResponse.parse(toCompAccess(updated!)));
});

router.delete("/admin/comps/:userId", async (req, res): Promise<void> => {
  const userId = req.params.userId;
  const [updated] = await db
    .update(usersTable)
    .set({ compLifetime: false, compUntil: null })
    .where(eq(usersTable.id, userId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  clearSubscriptionCache(userId);
  res.status(204).end();
});

router.get("/admin/community/posts", async (_req, res): Promise<void> => {
  const posts = await db
    .select({
      id: communityPostsTable.id,
      category: communityPostsTable.category,
      body: communityPostsTable.body,
      createdAt: communityPostsTable.createdAt,
      hidden: communityPostsTable.hidden,
      heartCount: sql<number>`(select count(*) from ${communityHeartsTable} where ${communityHeartsTable.postId} = ${communityPostsTable.id})`,
    })
    .from(communityPostsTable)
    .orderBy(desc(communityPostsTable.createdAt), desc(communityPostsTable.id))
    .limit(200);

  res.json(
    AdminListCommunityPostsResponse.parse({
      posts: posts.map((p) => ({
        id: p.id,
        category: p.category,
        body: p.body,
        createdAt: p.createdAt.toISOString(),
        hidden: p.hidden,
        heartCount: Number(p.heartCount),
      })),
    }),
  );
});

router.post("/admin/community/posts/:id/moderate", async (req, res): Promise<void> => {
  const postId = Number(req.params.id);
  if (!Number.isInteger(postId)) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  const body = ModerateCommunityPostBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [updated] = await db
    .update(communityPostsTable)
    .set({ hidden: body.data.hidden })
    .where(eq(communityPostsTable.id, postId))
    .returning({ id: communityPostsTable.id });
  if (!updated) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  res.status(204).end();
});

// ---- Admin-only routes (requireAdmin on top of the staff gate) ----

function toStaffMember(user: {
  id: string;
  email: string | null;
  firstName: string | null;
  role: string;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

router.get("/admin/staff", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.role, "staff"), eq(usersTable.role, "admin")))
    .orderBy(asc(usersTable.createdAt));
  res.json(AdminListStaffResponse.parse(rows.map(toStaffMember)));
});

router.post("/admin/staff/:userId/role", requireAdmin, async (req, res): Promise<void> => {
  const targetId = String(req.params.userId);
  const body = AdminUpdateStaffRoleBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const actorId = res.locals.userId as string;
  if (targetId === actorId) {
    res.status(400).json({ error: "You cannot change your own role" });
    return;
  }
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, targetId));
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (!isStaffRole(target.role) && body.data.role === "patient") {
    res.status(400).json({ error: "That user is not a staff member" });
    return;
  }
  const updated = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('admin_role_change'))`);
    if (target.role === "admin" && body.data.role !== "admin") {
      const [{ count }] = (await tx
        .select({ count: sql<number>`count(*)` })
        .from(usersTable)
        .where(eq(usersTable.role, "admin"))) as [{ count: number }];
      if (Number(count) <= 1) return null;
    }
    const [row] = await tx
      .update(usersTable)
      .set({ role: body.data.role })
      .where(eq(usersTable.id, targetId))
      .returning();
    return row ?? null;
  });
  if (!updated) {
    res.status(400).json({ error: "The app must always have at least one admin" });
    return;
  }
  clearSubscriptionCache(targetId);
  res.json(AdminUpdateStaffRoleResponse.parse(toStaffMember(updated)));
});

router.get("/admin/access-code", requireAdmin, async (_req, res): Promise<void> => {
  const [setting] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, "staff_access_code"));
  res.json(AdminGetAccessCodeResponse.parse({ code: setting?.value ?? "" }));
});

router.put("/admin/access-code", requireAdmin, async (req, res): Promise<void> => {
  const body = AdminUpdateAccessCodeBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Code must be 4-20 letters or numbers" });
    return;
  }
  const code = body.data.code.trim().toUpperCase();
  await db
    .insert(appSettingsTable)
    .values({ key: "staff_access_code", value: code })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: code } });
  res.json(AdminUpdateAccessCodeResponse.parse({ code }));
});

export default router;
