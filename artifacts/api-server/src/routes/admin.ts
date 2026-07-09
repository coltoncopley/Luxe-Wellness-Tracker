import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import crypto from "node:crypto";
import { z } from "zod/v4";
import { and, asc, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
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
  staffCodesTable,
  type StaffCode,
  doctorTipsTable,
  type DoctorTip,
  offersTable,
  offerClaimsTable,
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
  AdminAddStaffByEmailBody,
  AdminAddStaffByEmailResponse,
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
  AdminListStaffCodesResponse,
  AdminCreateStaffCodeBody,
  AdminCreateStaffCodeResponse,
  AdminRevokeStaffCodeResponse,
  AdminCreateMembershipCodeResponse,
  AdminRevokeMembershipCodeResponse,
  AdminListDoctorTipsResponse,
  AdminCreateDoctorTipBody,
  AdminCreateDoctorTipResponse,
  AdminGenerateDoctorTipsResponse,
  AdminUpdateDoctorTipBody,
  AdminUpdateDoctorTipResponse,
  AdminSendDoctorTipNowResponse,
  AdminListOffersResponse,
  AdminCreateOfferBody,
  AdminCreateOfferResponse,
  AdminUpdateOfferBody,
  AdminUpdateOfferResponse,
  AdminGetOfferClaimResponse,
  AdminRedeemOfferClaimResponse,
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
  res.status(201).json(AdminCreateRestaurantResponse.parse({ ...row, isMine: false }));
});

router.delete("/admin/restaurants/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const deleted = await db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: restaurantsTable.id })
      .from(restaurantsTable)
      .where(and(eq(restaurantsTable.id, id), isNull(restaurantsTable.ownerUserId)));
    if (!target) return [];
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
    .where(and(eq(restaurantsTable.id, id), isNull(restaurantsTable.ownerUserId)));
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
  const [row] = await db
    .delete(menuItemsTable)
    .where(
      and(
        eq(menuItemsTable.id, id),
        sql`${menuItemsTable.restaurantId} IN (SELECT ${restaurantsTable.id} FROM ${restaurantsTable} WHERE ${restaurantsTable.ownerUserId} IS NULL)`,
      ),
    )
    .returning();
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

// ---- One-time staff access codes (admin only) ----
//
// Per-person codes so the shared staff access code never has to be passed
// around. Redeeming one (POST /me/staff-access) grants the "staff" role only —
// never admin. Redeemer name/email exposure here is allowed under the privacy
// rules (same as membership codes); no patient health data is involved.

function generateStaffCode(): string {
  const bytes = crypto.randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
    if (i === 3) s += "-";
  }
  return `LWS-${s}`;
}

function staffCodeStatus(row: StaffCode): "active" | "redeemed" | "revoked" {
  if (row.revokedAt) return "revoked";
  if (row.redeemedBy) return "redeemed";
  return "active";
}

async function toStaffCodeResponses(rows: StaffCode[]) {
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
      label: r.label,
      status: staffCodeStatus(r),
      createdAt: r.createdAt.toISOString(),
      createdByName: creator?.firstName ?? null,
      createdByEmail: creator?.email ?? null,
      redeemedAt: r.redeemedAt ? r.redeemedAt.toISOString() : null,
      redeemedByName: redeemer?.firstName ?? null,
      redeemedByEmail: redeemer?.email ?? null,
      revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
    };
  });
}

router.get("/admin/staff-codes", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(staffCodesTable)
    .orderBy(desc(staffCodesTable.createdAt))
    .limit(500);
  res.json(AdminListStaffCodesResponse.parse(await toStaffCodeResponses(rows)));
});

router.post("/admin/staff-codes", requireAdmin, async (req, res): Promise<void> => {
  const body = AdminCreateStaffCodeBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const actorId = res.locals.userId as string;
  const label = body.data.label?.trim() || null;
  // Retry on the (astronomically unlikely) chance of a code collision.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const [row] = await db
        .insert(staffCodesTable)
        .values({ code: generateStaffCode(), label, createdBy: actorId })
        .returning();
      const [payload] = await toStaffCodeResponses([row!]);
      res.status(201).json(AdminCreateStaffCodeResponse.parse(payload));
      return;
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
});

router.post("/admin/staff-codes/:id/revoke", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(404).json({ error: "Code not found" });
    return;
  }
  const actorId = res.locals.userId as string;
  const result = await db.transaction(async (tx) => {
    const [code] = await tx
      .select()
      .from(staffCodesTable)
      .where(eq(staffCodesTable.id, id))
      .for("update");
    if (!code) return "not_found" as const;
    // A redeemed code already did its job — the person IS staff. Removing
    // their access is a role-management action, not a code action.
    if (code.redeemedBy) return "already_redeemed" as const;
    if (code.revokedAt) return code;
    const [updated] = await tx
      .update(staffCodesTable)
      .set({ revokedAt: new Date(), revokedBy: actorId })
      .where(eq(staffCodesTable.id, id))
      .returning();
    return updated!;
  });
  if (result === "not_found") {
    res.status(404).json({ error: "Code not found" });
    return;
  }
  if (result === "already_redeemed") {
    res.status(409).json({
      error: "This code was already used. To remove that person's access, change their role in Staff management.",
    });
    return;
  }
  const [payload] = await toStaffCodeResponses([result]);
  res.json(AdminRevokeStaffCodeResponse.parse(payload));
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

// Grant staff (or admin) to an EXISTING account by email — the no-code path.
// The person must already have signed into the app at least once (so a users
// row exists); this only flips their role, it never creates an account.
router.post("/admin/staff/add", requireAdmin, async (req, res): Promise<void> => {
  const body = AdminAddStaffByEmailBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const actorId = res.locals.userId as string;
  const email = body.data.email.trim();
  const role = body.data.role ?? "staff";
  if (!email) {
    res.status(400).json({ error: "Enter an email address" });
    return;
  }
  const [target] = await db
    .select()
    .from(usersTable)
    .where(sql`lower(${usersTable.email}) = lower(${email})`);
  if (!target) {
    res.status(404).json({ error: "No account exists with that email" });
    return;
  }
  if (target.id === actorId) {
    res.status(400).json({ error: "You cannot change your own role" });
    return;
  }
  // Never silently demote: if they already have staff/admin access, don't touch
  // their role — this is an "Add" action, not a role editor (use the staff list
  // for demotions).
  if (isStaffRole(target.role)) {
    res.status(409).json({ error: "That person already has staff access" });
    return;
  }
  const updated = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('admin_role_change'))`);
    const [row] = await tx
      .update(usersTable)
      .set({ role })
      .where(eq(usersTable.id, target.id))
      .returning();
    return row ?? null;
  });
  if (!updated) {
    res.status(400).json({ error: "Couldn't update that account" });
    return;
  }
  clearSubscriptionCache(target.id);
  req.log.info({ targetId: target.id, role, actorId }, "staff access granted by email");
  res.json(AdminAddStaffByEmailResponse.parse(toStaffMember(updated)));
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

// ---- Doctor tips (weekly tips with admin approval queue) ----

function toDoctorTipResponse(t: DoctorTip) {
  return {
    id: t.id,
    title: t.title,
    body: t.body,
    status: t.status,
    source: t.source,
    createdAt: t.createdAt.toISOString(),
    approvedAt: t.approvedAt ? t.approvedAt.toISOString() : null,
    sentAt: t.sentAt ? t.sentAt.toISOString() : null,
  };
}

router.get("/admin/doctor-tips", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(doctorTipsTable)
    .orderBy(desc(doctorTipsTable.createdAt))
    .limit(500);
  res.json(AdminListDoctorTipsResponse.parse({ tips: rows.map(toDoctorTipResponse) }));
});

router.post("/admin/doctor-tips", requireAdmin, async (req, res): Promise<void> => {
  const body = AdminCreateDoctorTipBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const actorId = res.locals.userId as string;
  const [row] = await db
    .insert(doctorTipsTable)
    .values({ title: body.data.title, body: body.data.body, source: "manual", createdBy: actorId })
    .returning();
  res.status(201).json(AdminCreateDoctorTipResponse.parse(toDoctorTipResponse(row!)));
});

const tipIdeasSchema = z.object({
  tips: z
    .array(z.object({ title: z.string().min(3).max(100), body: z.string().min(10).max(1000) }))
    .min(1)
    .max(6),
});

// Deterministic safety filter: drop any generated tip whose language crosses from
// educational wellness content into diagnosis, prescribing, dosing, or absolute
// medical claims. Mirrors the enforceSafetyLanguage pattern used for ingredient scans.
const TIP_UNSAFE_PATTERNS: RegExp[] = [
  /\bdiagnos(e|is|ed|ing)\b/i,
  /\bprescri(be|bed|ption|ptions)\b/i,
  /\b\d+(\.\d+)?\s?(mg|mcg|µg|ml|milligrams?|micrograms?|units?|iu)\b/i, // dosing amounts
  /\bdos(e|es|age|ing)\b/i,
  /\b(cure|cures|cured|curing)\b/i,
  /\bguarantee(s|d)?\b/i,
  /\b(will|proven to)\s+(treat|heal|cure|eliminate|fix|reverse)\b/i,
  /\bstop(ping)?\s+(taking\s+)?(your\s+)?(medication|meds|medicine)\b/i,
  /\b(increase|decrease|adjust|change|skip|double)\s+(your\s+)?(dose|dosage|medication|meds|injection)\b/i,
  /\byou\s+(have|are suffering from|likely have)\b/i, // diagnostic phrasing
];

function tipIsSafe(tip: { title: string; body: string }): boolean {
  const text = `${tip.title} ${tip.body}`;
  return !TIP_UNSAFE_PATTERNS.some((p) => p.test(text));
}

router.post("/admin/doctor-tips/generate", requireAdmin, async (req, res): Promise<void> => {
  const actorId = res.locals.userId as string;
  const existing = await db
    .select({ title: doctorTipsTable.title })
    .from(doctorTipsTable)
    .orderBy(desc(doctorTipsTable.createdAt))
    .limit(50);
  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    messages: [
      {
        role: "system",
        content:
          "You draft short weekly wellness tips for patients of LUXE Wellness & Aesthetics, a physician-owned med spa, written in the friendly voice of the practice. " +
          "Topics: skincare habits, sun protection, hydration, sleep, gentle nutrition (many patients are on a weight-loss journey, some on GLP-1 medication), stress relief, and treatment aftercare basics. " +
          "Rules: educational only — no diagnosis, no medical advice, no medication dosing; use conditional language ('may', 'can help'); no product sales pressure; each tip stands alone. " +
          'Respond ONLY with JSON matching {"tips": [{"title": string, "body": string}]} — exactly 5 tips, titles under 80 characters, bodies 2-4 friendly sentences.' +
          (existing.length > 0
            ? ` Avoid repeating these existing tip titles: ${existing.map((t) => t.title).join("; ")}.`
            : ""),
      },
      { role: "user", content: "Draft 5 new weekly tip ideas for the approval queue." },
    ],
    response_format: { type: "json_object" },
  });
  const raw = completion.choices[0]?.message?.content;
  let ideas: z.infer<typeof tipIdeasSchema>;
  try {
    ideas = tipIdeasSchema.parse(JSON.parse(raw ?? ""));
  } catch {
    req.log.warn({ raw }, "Unparseable tip ideas from model");
    res.status(422).json({ error: "Could not draft tips — please try again" });
    return;
  }
  const safeTips = ideas.tips.filter(tipIsSafe);
  if (safeTips.length < ideas.tips.length) {
    req.log.warn(
      { dropped: ideas.tips.length - safeTips.length },
      "Dropped generated tips that failed the safety-language filter",
    );
  }
  if (safeTips.length === 0) {
    res.status(422).json({ error: "Could not draft tips — please try again" });
    return;
  }
  const rows = await db
    .insert(doctorTipsTable)
    .values(
      safeTips.map((t) => ({
        title: t.title,
        body: t.body,
        source: "ai",
        createdBy: actorId,
      })),
    )
    .returning();
  res.status(201).json(AdminGenerateDoctorTipsResponse.parse({ tips: rows.map(toDoctorTipResponse) }));
});

router.patch("/admin/doctor-tips/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(404).json({ error: "Tip not found" });
    return;
  }
  const body = AdminUpdateDoctorTipBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [current] = await db.select().from(doctorTipsTable).where(eq(doctorTipsTable.id, id));
  if (!current) {
    res.status(404).json({ error: "Tip not found" });
    return;
  }
  if (current.status === "sent") {
    res.status(400).json({ error: "This tip has already been sent and can no longer be changed" });
    return;
  }
  const updates: Partial<typeof doctorTipsTable.$inferInsert> = {};
  if (body.data.title !== undefined) updates.title = body.data.title;
  if (body.data.body !== undefined) updates.body = body.data.body;
  if (body.data.status !== undefined) {
    updates.status = body.data.status;
    updates.approvedAt = body.data.status === "approved" ? new Date() : null;
  }
  const [row] = await db
    .update(doctorTipsTable)
    .set(updates)
    .where(eq(doctorTipsTable.id, id))
    .returning();
  res.json(AdminUpdateDoctorTipResponse.parse(toDoctorTipResponse(row!)));
});

router.delete("/admin/doctor-tips/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(404).json({ error: "Tip not found" });
    return;
  }
  const deleted = await db
    .delete(doctorTipsTable)
    .where(eq(doctorTipsTable.id, id))
    .returning({ id: doctorTipsTable.id });
  if (deleted.length === 0) {
    res.status(404).json({ error: "Tip not found" });
    return;
  }
  res.status(204).end();
});

router.post("/admin/doctor-tips/:id/send-now", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(404).json({ error: "Tip not found" });
    return;
  }
  // Atomic: only an approved tip can be published.
  const [row] = await db
    .update(doctorTipsTable)
    .set({ status: "sent", sentAt: new Date() })
    .where(and(eq(doctorTipsTable.id, id), eq(doctorTipsTable.status, "approved")))
    .returning();
  if (!row) {
    const [exists] = await db.select().from(doctorTipsTable).where(eq(doctorTipsTable.id, id));
    if (!exists) {
      res.status(404).json({ error: "Tip not found" });
      return;
    }
    res.status(400).json({ error: "Only approved tips can be sent" });
    return;
  }
  res.json(AdminSendDoctorTipNowResponse.parse(toDoctorTipResponse(row)));
});

// ---- Limited-time offers ----

async function toAdminOfferResponses(rows: (typeof offersTable.$inferSelect)[]) {
  if (rows.length === 0) return [];
  const counts = await db
    .select({
      offerId: offerClaimsTable.offerId,
      claimCount: sql<number>`count(*)::int`,
      redeemedCount: sql<number>`count(${offerClaimsTable.redeemedAt})::int`,
    })
    .from(offerClaimsTable)
    .where(
      inArray(
        offerClaimsTable.offerId,
        rows.map((r) => r.id),
      ),
    )
    .groupBy(offerClaimsTable.offerId);
  const byOffer = new Map(counts.map((c) => [c.offerId, c]));
  return rows.map((o) => ({
    id: o.id,
    title: o.title,
    description: o.description,
    endsAt: o.endsAt.toISOString(),
    active: o.active,
    createdAt: o.createdAt.toISOString(),
    claimCount: byOffer.get(o.id)?.claimCount ?? 0,
    redeemedCount: byOffer.get(o.id)?.redeemedCount ?? 0,
  }));
}

router.get("/admin/offers", async (_req, res): Promise<void> => {
  const rows = await db.select().from(offersTable).orderBy(desc(offersTable.createdAt)).limit(500);
  res.json(AdminListOffersResponse.parse({ offers: await toAdminOfferResponses(rows) }));
});

router.post("/admin/offers", async (req, res): Promise<void> => {
  const body = AdminCreateOfferBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const endsAt = new Date(body.data.endsAt);
  if (Number.isNaN(endsAt.getTime()) || endsAt <= new Date()) {
    res.status(400).json({ error: "End date must be a valid date in the future" });
    return;
  }
  const actorId = res.locals.userId as string;
  const [row] = await db
    .insert(offersTable)
    .values({
      title: body.data.title,
      description: body.data.description,
      endsAt,
      createdBy: actorId,
    })
    .returning();
  const [payload] = await toAdminOfferResponses([row!]);
  res.status(201).json(AdminCreateOfferResponse.parse(payload));
});

router.patch("/admin/offers/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(404).json({ error: "Offer not found" });
    return;
  }
  const body = AdminUpdateOfferBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const updates: Partial<typeof offersTable.$inferInsert> = {};
  if (body.data.title !== undefined) updates.title = body.data.title;
  if (body.data.description !== undefined) updates.description = body.data.description;
  if (body.data.active !== undefined) updates.active = body.data.active;
  if (body.data.endsAt !== undefined) {
    const endsAt = new Date(body.data.endsAt);
    if (Number.isNaN(endsAt.getTime())) {
      res.status(400).json({ error: "End date must be a valid date" });
      return;
    }
    updates.endsAt = endsAt;
  }
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }
  const [row] = await db.update(offersTable).set(updates).where(eq(offersTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Offer not found" });
    return;
  }
  const [payload] = await toAdminOfferResponses([row]);
  res.json(AdminUpdateOfferResponse.parse(payload));
});

const claimLookupHits = new Map<string, { count: number; windowStart: number }>();
const CLAIM_LOOKUP_LIMIT = 15;
const CLAIM_LOOKUP_WINDOW_MS = 60_000;

function rateLimitClaimLookup(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip ?? "unknown";
  const now = Date.now();
  const entry = claimLookupHits.get(key);
  if (!entry || now - entry.windowStart > CLAIM_LOOKUP_WINDOW_MS) {
    if (claimLookupHits.size > 1000) claimLookupHits.clear();
    claimLookupHits.set(key, { count: 1, windowStart: now });
    next();
    return;
  }
  entry.count += 1;
  if (entry.count > CLAIM_LOOKUP_LIMIT) {
    res.status(429).json({ error: "Too many lookups — try again in a minute" });
    return;
  }
  next();
}

async function offerClaimDetails(code: string) {
  const [claim] = await db
    .select()
    .from(offerClaimsTable)
    .where(eq(offerClaimsTable.code, code.trim().toUpperCase()));
  if (!claim) return null;
  const [offer] = await db.select().from(offersTable).where(eq(offersTable.id, claim.offerId));
  const [patient] = await db
    .select({ firstName: usersTable.firstName, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, claim.userId));
  return {
    code: claim.code,
    offerTitle: offer?.title ?? "Unknown offer",
    offerDescription: offer?.description ?? "",
    offerEndsAt: (offer?.endsAt ?? claim.claimedAt).toISOString(),
    patientName: patient?.firstName ?? null,
    patientEmail: patient?.email ?? null,
    claimedAt: claim.claimedAt.toISOString(),
    redeemedAt: claim.redeemedAt ? claim.redeemedAt.toISOString() : null,
  };
}

router.get("/admin/offer-claims/:code", rateLimitClaimLookup, async (req, res): Promise<void> => {
  const details = await offerClaimDetails(String(req.params.code ?? ""));
  if (!details) {
    res.status(404).json({ error: "Claim not found" });
    return;
  }
  res.json(AdminGetOfferClaimResponse.parse(details));
});

router.post(
  "/admin/offer-claims/:code/redeem",
  rateLimitClaimLookup,
  async (req, res): Promise<void> => {
    const code = String(req.params.code ?? "").trim().toUpperCase();
    // Atomic: only an unused claim can be marked used.
    const [row] = await db
      .update(offerClaimsTable)
      .set({ redeemedAt: new Date(), redeemedBy: res.locals.userId as string })
      .where(and(eq(offerClaimsTable.code, code), isNull(offerClaimsTable.redeemedAt)))
      .returning();
    if (!row) {
      const details = await offerClaimDetails(code);
      if (!details) {
        res.status(404).json({ error: "Claim not found" });
        return;
      }
      res.status(409).json({ error: "This claim code has already been used" });
      return;
    }
    const details = await offerClaimDetails(code);
    res.json(AdminRedeemOfferClaimResponse.parse(details));
  },
);

export default router;
