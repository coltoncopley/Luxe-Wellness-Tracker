import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { asc, desc, eq, gt, inArray, or, sql } from "drizzle-orm";
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
  announcementsTable,
  rewardEventsTable,
  membershipCodesTable,
  type MembershipCode,
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
  AdminListAnnouncementsResponse,
  AdminCreateAnnouncementBody,
  AdminCreateAnnouncementResponse,
  AdminUpdateAnnouncementBody,
  AdminUpdateAnnouncementResponse,
  AdminGetMetricsResponse,
  AdminListMembershipCodesResponse,
  AdminCreateMembershipCodeBody,
  AdminCreateMembershipCodeResponse,
  AdminRevokeMembershipCodeResponse,
} from "@workspace/api-zod";
import { clearSubscriptionCache } from "../middlewares/subscription";
import { fanOutAnnouncement } from "../lib/notifications";
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
      compSource: "manual",
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
    .set({ compLifetime: false, compUntil: null, compSource: null })
    .where(eq(usersTable.id, userId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  clearSubscriptionCache(userId);
  res.status(204).end();
});

// ---- One-time membership access codes ----

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateMembershipCode(): string {
  const bytes = crypto.randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
    if (i === 3) s += "-";
  }
  return `LW-${s}`;
}

function membershipCodeStatus(row: MembershipCode): "active" | "redeemed" | "expired" | "revoked" {
  if (row.revokedAt) return "revoked";
  if (row.redeemedBy) {
    if (row.kind === "six_month" && row.accessUntil && row.accessUntil <= new Date()) {
      return "expired";
    }
    return "redeemed";
  }
  return "active";
}

async function toMembershipCodeResponses(rows: MembershipCode[]) {
  const userIds = new Set<string>();
  for (const r of rows) {
    userIds.add(r.createdBy);
    if (r.redeemedBy) userIds.add(r.redeemedBy);
  }
  const users =
    userIds.size > 0
      ? await db
          .select({
            id: usersTable.id,
            email: usersTable.email,
            firstName: usersTable.firstName,
          })
          .from(usersTable)
          .where(inArray(usersTable.id, [...userIds]))
      : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => {
    const creator = byId.get(r.createdBy);
    const redeemer = r.redeemedBy ? byId.get(r.redeemedBy) : undefined;
    return {
      id: r.id,
      code: r.code,
      kind: r.kind,
      status: membershipCodeStatus(r),
      createdAt: r.createdAt.toISOString(),
      createdByName: creator?.firstName ?? null,
      createdByEmail: creator?.email ?? null,
      redeemedAt: r.redeemedAt ? r.redeemedAt.toISOString() : null,
      redeemedByName: redeemer?.firstName ?? null,
      redeemedByEmail: redeemer?.email ?? null,
      accessUntil: r.accessUntil ? r.accessUntil.toISOString() : null,
      revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
    };
  });
}

router.get("/admin/membership-codes", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(membershipCodesTable)
    .orderBy(desc(membershipCodesTable.createdAt))
    .limit(500);
  res.json(AdminListMembershipCodesResponse.parse(await toMembershipCodeResponses(rows)));
});

router.post("/admin/membership-codes", async (req, res): Promise<void> => {
  const body = AdminCreateMembershipCodeBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const actorId = res.locals.userId as string;
  if (body.data.kind === "unlimited") {
    const [actor] = await db.select().from(usersTable).where(eq(usersTable.id, actorId));
    if (actor?.role !== "admin") {
      res.status(403).json({ error: "Only admins can create unlimited access codes" });
      return;
    }
  }
  // Retry on the (astronomically unlikely) chance of a code collision.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const [row] = await db
        .insert(membershipCodesTable)
        .values({ code: generateMembershipCode(), kind: body.data.kind, createdBy: actorId })
        .returning();
      const [payload] = await toMembershipCodeResponses([row!]);
      res.status(201).json(AdminCreateMembershipCodeResponse.parse(payload));
      return;
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
});

router.post(
  "/admin/membership-codes/:id/revoke",
  requireAdmin,
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(404).json({ error: "Code not found" });
      return;
    }
    const actorId = res.locals.userId as string;
    const row = await db.transaction(async (tx) => {
      const [code] = await tx
        .select()
        .from(membershipCodesTable)
        .where(eq(membershipCodesTable.id, id))
        .for("update");
      if (!code) return null;
      let updated = code;
      if (!code.revokedAt) {
        const [r] = await tx
          .update(membershipCodesTable)
          .set({ revokedAt: new Date(), revokedBy: actorId })
          .where(eq(membershipCodesTable.id, id))
          .returning();
        updated = r!;
        // Remove only the free access this exact code granted — never clobber a
        // separate manual comp grant (those carry compSource "manual").
        if (code.redeemedBy) {
          const [redeemer] = await tx
            .select()
            .from(usersTable)
            .where(eq(usersTable.id, code.redeemedBy))
            .for("update");
          if (redeemer && redeemer.compSource === `code:${code.id}`) {
            await tx
              .update(usersTable)
              .set(
                code.kind === "unlimited"
                  ? { compLifetime: false, compSource: null }
                  : { compUntil: null, compSource: null },
              )
              .where(eq(usersTable.id, code.redeemedBy));
          }
        }
      }
      return updated;
    });
    if (!row) {
      res.status(404).json({ error: "Code not found" });
      return;
    }
    if (row.redeemedBy) clearSubscriptionCache(row.redeemedBy);
    const [payload] = await toMembershipCodeResponses([row]);
    res.json(AdminRevokeMembershipCodeResponse.parse(payload));
  },
);

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

// ---- Announcements (staff can post spa updates) ----

function toAnnouncement(row: {
  id: number;
  title: string;
  body: string;
  active: boolean;
  createdAt: Date;
}) {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

router.get("/admin/announcements", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(announcementsTable)
    .orderBy(desc(announcementsTable.createdAt));
  res.json(AdminListAnnouncementsResponse.parse({ announcements: rows.map(toAnnouncement) }));
});

router.post("/admin/announcements", async (req, res): Promise<void> => {
  const body = AdminCreateAnnouncementBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Title must be 3-100 characters and body 10-1000 characters" });
    return;
  }
  const [row] = await db
    .insert(announcementsTable)
    .values({ title: body.data.title.trim(), body: body.data.body.trim() })
    .returning();
  fanOutAnnouncement(row!.id, row!.title);
  res.status(201).json(AdminCreateAnnouncementResponse.parse(toAnnouncement(row!)));
});

router.patch("/admin/announcements/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const body = AdminUpdateAnnouncementBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [row] = await db
    .update(announcementsTable)
    .set({ active: body.data.active })
    .where(eq(announcementsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Announcement not found" });
    return;
  }
  res.json(AdminUpdateAnnouncementResponse.parse(toAnnouncement(row)));
});

router.delete("/admin/announcements/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .delete(announcementsTable)
    .where(eq(announcementsTable.id, id))
    .returning({ id: announcementsTable.id });
  if (!row) {
    res.status(404).json({ error: "Announcement not found" });
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

// Aggregate business metrics — counts and totals only, never individual patient data.
router.get("/admin/metrics", requireAdmin, async (_req, res): Promise<void> => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    subCounts,
    compCount,
    patientCounts,
    activeUsers,
    postCount,
    pointTotals,
    redemptionCounts,
    topRewards,
  ] = await Promise.all([
    db
      .execute(
        sql`SELECT status, count(*)::int AS count FROM stripe.subscriptions WHERE status IN ('active', 'trialing', 'past_due') GROUP BY status`,
      )
      .catch(() => ({ rows: [] as Array<Record<string, unknown>> })),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(
        sql`${usersTable.compLifetime} = true OR ${usersTable.compUntil} > ${now.toISOString()}`,
      ),
    db
      .select({
        total: sql<number>`count(*)::int`,
        recent: sql<number>`count(*) FILTER (WHERE ${usersTable.createdAt} > ${thirtyDaysAgo.toISOString()})::int`,
      })
      .from(usersTable)
      .where(eq(usersTable.role, "patient")),
    db
      .select({ count: sql<number>`count(DISTINCT ${rewardEventsTable.userId})::int` })
      .from(rewardEventsTable)
      .where(
        sql`${rewardEventsTable.createdAt} > ${sevenDaysAgo.toISOString()} AND ${rewardEventsTable.points} > 0`,
      ),
    db.select({ count: sql<number>`count(*)::int` }).from(communityPostsTable),
    db
      .select({
        earned: sql<number>`COALESCE(SUM(${rewardEventsTable.points}) FILTER (WHERE ${rewardEventsTable.points} > 0), 0)::int`,
        redeemed: sql<number>`COALESCE(-SUM(${rewardEventsTable.points}) FILTER (WHERE ${rewardEventsTable.points} < 0), 0)::int`,
      })
      .from(rewardEventsTable),
    db
      .select({
        total: sql<number>`count(*)::int`,
        used: sql<number>`count(*) FILTER (WHERE ${redemptionsTable.usedAt} IS NOT NULL)::int`,
      })
      .from(redemptionsTable),
    db
      .select({
        title: redemptionsTable.title,
        count: sql<number>`count(*)::int`,
      })
      .from(redemptionsTable)
      .groupBy(redemptionsTable.title)
      .orderBy(sql`count(*) DESC`)
      .limit(5),
  ]);

  const statusMap = new Map(
    (subCounts.rows as Array<Record<string, unknown>>).map((r) => [
      String(r["status"]),
      Number(r["count"]),
    ]),
  );

  res.json(
    AdminGetMetricsResponse.parse({
      membership: {
        activeMembers: statusMap.get("active") ?? 0,
        trialing: statusMap.get("trialing") ?? 0,
        pastDue: statusMap.get("past_due") ?? 0,
        activeComps: Number(compCount[0]?.count ?? 0),
      },
      patients: {
        totalPatients: Number(patientCounts[0]?.total ?? 0),
        newLast30Days: Number(patientCounts[0]?.recent ?? 0),
      },
      engagement: {
        activeUsersLast7Days: Number(activeUsers[0]?.count ?? 0),
        communityPosts: Number(postCount[0]?.count ?? 0),
      },
      rewards: {
        pointsEarned: Number(pointTotals[0]?.earned ?? 0),
        pointsRedeemed: Number(pointTotals[0]?.redeemed ?? 0),
        redemptionsTotal: Number(redemptionCounts[0]?.total ?? 0),
        redemptionsUsed: Number(redemptionCounts[0]?.used ?? 0),
        topRewards: topRewards.map((r) => ({ title: r.title, count: Number(r.count) })),
      },
    }),
  );
});

export default router;
