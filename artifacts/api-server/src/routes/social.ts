import { Router, type IRouter } from "express";
import { Readable } from "stream";
import type { ReadableStream } from "stream/web";
import { and, desc, eq, gte, inArray, or, asc, sql, sum } from "drizzle-orm";
import {
  db,
  usersTable,
  followsTable,
  shareSettingsTable,
  cheersTable,
  glowCheckinsTable,
  weightEntriesTable,
  goalsTable,
  progressPhotosTable,
  rewardEventsTable,
  type User,
  type GlowCheckin,
  type ProgressPhoto,
} from "@workspace/db";
import {
  GetFollowsResponse,
  RequestFollowBody,
  RequestFollowResponse,
  RespondToFollowBody,
  RespondToFollowResponse,
  GetFriendJourneysResponse,
  GetSharingSettingsResponse,
  UpdateSharingSettingsBody,
  UpdateSharingSettingsResponse,
  GetCheersResponse,
  SendCheerBody,
  SendCheerResponse,
} from "@workspace/api-zod";
import { userIdOf } from "../middlewares/auth";
import { computeGlowScore } from "./glow";
import { getTierInfo } from "../lib/rewards";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import type { Request, Response, NextFunction } from "express";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const socialHits = new Map<string, { count: number; windowStart: number }>();

function makeRateLimiter(prefix: string, limit: number, windowMs: number) {
  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();
    const keys = [`${prefix}:ip:${req.ip ?? "unknown"}`, `${prefix}:user:${userIdOf(res)}`];
    for (const key of keys) {
      const entry = socialHits.get(key);
      if (!entry || now - entry.windowStart > windowMs) {
        if (socialHits.size > 5000) socialHits.clear();
        socialHits.set(key, { count: 1, windowStart: now });
        continue;
      }
      entry.count += 1;
      if (entry.count > limit) {
        res.status(429).json({ error: "Too many attempts — try again in a minute" });
        return;
      }
    }
    next();
  };
}

const rateLimitFollowRequests = makeRateLimiter("follow", 5, 60_000);
const rateLimitCheers = makeRateLimiter("cheer", 10, 60_000);
const rateLimitFriendPhotos = makeRateLimiter("friendphoto", 120, 60_000);

function displayName(user: Pick<User, "firstName" | "email">): string {
  if (user.firstName) return user.firstName;
  if (user.email) return user.email.split("@")[0];
  return "Friend";
}

function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateStringDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function computeStreak(dateSet: Set<string>): number {
  let streak = 0;
  const cursor = new Date();
  if (!dateSet.has(todayString())) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    if (!dateSet.has(`${y}-${m}-${d}`)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

const DEFAULT_SETTINGS = {
  shareGlow: true,
  shareWeightProgress: true,
  shareStreak: true,
  sharePoints: false,
  shareNumbers: false,
  sharePhotos: false,
};

async function getSettingsFor(userId: string) {
  const [row] = await db
    .select()
    .from(shareSettingsTable)
    .where(eq(shareSettingsTable.userId, userId));
  return row ?? { userId, ...DEFAULT_SETTINGS };
}

router.get("/follows", async (_req, res): Promise<void> => {
  const userId = userIdOf(res);
  const rows = await db
    .select()
    .from(followsTable)
    .where(or(eq(followsTable.followerUserId, userId), eq(followsTable.followeeUserId, userId)))
    .orderBy(asc(followsTable.createdAt));

  const otherIds = Array.from(
    new Set(rows.map((r) => (r.followerUserId === userId ? r.followeeUserId : r.followerUserId))),
  );
  const others = otherIds.length
    ? await db.select().from(usersTable).where(inArray(usersTable.id, otherIds))
    : [];
  const nameOf = new Map(others.map((u) => [u.id, displayName(u)]));

  type FollowEntry = {
    id: number;
    userId: string;
    name: string;
    status: "pending" | "accepted";
    direction: "following" | "follower";
  };
  const following: FollowEntry[] = [];
  const followers: FollowEntry[] = [];
  const incomingRequests: FollowEntry[] = [];
  const outgoingRequests: FollowEntry[] = [];
  for (const r of rows) {
    const iAmFollower = r.followerUserId === userId;
    const otherId = iAmFollower ? r.followeeUserId : r.followerUserId;
    const entry = {
      id: r.id,
      userId: otherId,
      name: nameOf.get(otherId) ?? "Friend",
      status: r.status as "pending" | "accepted",
      direction: (iAmFollower ? "following" : "follower") as "following" | "follower",
    };
    if (r.status === "accepted") {
      (iAmFollower ? following : followers).push(entry);
    } else if (r.status === "pending") {
      (iAmFollower ? outgoingRequests : incomingRequests).push(entry);
    }
  }
  res.json(GetFollowsResponse.parse({ following, followers, incomingRequests, outgoingRequests }));
});

router.post("/follows/request", rateLimitFollowRequests, async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const body = RequestFollowBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const code = body.data.code.trim().toUpperCase();
  const [friend] = await db.select().from(usersTable).where(eq(usersTable.referralCode, code));
  if (!friend) {
    res.json(RequestFollowResponse.parse({ requested: false, reason: "invalid_code" }));
    return;
  }
  if (friend.id === userId) {
    res.json(RequestFollowResponse.parse({ requested: false, reason: "own_code" }));
    return;
  }
  const [existing] = await db
    .select()
    .from(followsTable)
    .where(and(eq(followsTable.followerUserId, userId), eq(followsTable.followeeUserId, friend.id)));
  if (existing) {
    const reason = existing.status === "accepted" ? "already_following" : "already_requested";
    res.json(RequestFollowResponse.parse({ requested: false, reason }));
    return;
  }
  await db
    .insert(followsTable)
    .values({ followerUserId: userId, followeeUserId: friend.id, status: "pending" })
    .onConflictDoNothing();
  res.json(RequestFollowResponse.parse({ requested: true, reason: null }));
});

router.post("/follows/:id/respond", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const id = Number(req.params.id);
  const body = RespondToFollowBody.safeParse(req.body);
  if (!Number.isInteger(id) || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  if (body.data.accept) {
    const [updated] = await db
      .update(followsTable)
      .set({ status: "accepted", respondedAt: new Date() })
      .where(
        and(
          eq(followsTable.id, id),
          eq(followsTable.followeeUserId, userId),
          eq(followsTable.status, "pending"),
        ),
      )
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    res.json(RespondToFollowResponse.parse({ status: "accepted" }));
    return;
  }
  const deleted = await db
    .delete(followsTable)
    .where(
      and(
        eq(followsTable.id, id),
        eq(followsTable.followeeUserId, userId),
        eq(followsTable.status, "pending"),
      ),
    )
    .returning();
  if (deleted.length === 0) {
    res.status(404).json({ error: "Request not found" });
    return;
  }
  res.json(RespondToFollowResponse.parse({ status: "declined" }));
});

router.delete("/follows/:id", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const deleted = await db
    .delete(followsTable)
    .where(
      and(
        eq(followsTable.id, id),
        or(eq(followsTable.followerUserId, userId), eq(followsTable.followeeUserId, userId)),
      ),
    )
    .returning();
  if (deleted.length === 0) {
    res.status(404).json({ error: "Follow not found" });
    return;
  }
  res.status(204).end();
});

router.get("/friends/journeys", async (_req, res): Promise<void> => {
  const userId = userIdOf(res);
  const accepted = await db
    .select()
    .from(followsTable)
    .where(and(eq(followsTable.followerUserId, userId), eq(followsTable.status, "accepted")));
  const friendIds = accepted.map((f) => f.followeeUserId);
  if (friendIds.length === 0) {
    res.json(GetFriendJourneysResponse.parse({ journeys: [] }));
    return;
  }

  const [friends, settingsRows, checkins, goals, weights, points, sharedPhotoRows] =
    await Promise.all([
      db.select().from(usersTable).where(inArray(usersTable.id, friendIds)),
      db.select().from(shareSettingsTable).where(inArray(shareSettingsTable.userId, friendIds)),
      db
        .select()
        .from(glowCheckinsTable)
        .where(inArray(glowCheckinsTable.userId, friendIds))
        .orderBy(desc(glowCheckinsTable.date)),
      db.select().from(goalsTable).where(inArray(goalsTable.userId, friendIds)),
      db
        .select()
        .from(weightEntriesTable)
        .where(inArray(weightEntriesTable.userId, friendIds))
        .orderBy(desc(weightEntriesTable.date)),
      db
        .select({
          userId: rewardEventsTable.userId,
          balance: sum(rewardEventsTable.points),
          earned: sql<string>`sum(case when ${rewardEventsTable.points} > 0 then ${rewardEventsTable.points} else 0 end)`,
        })
        .from(rewardEventsTable)
        .where(inArray(rewardEventsTable.userId, friendIds))
        .groupBy(rewardEventsTable.userId),
      db
        .select()
        .from(progressPhotosTable)
        .where(
          and(
            inArray(progressPhotosTable.userId, friendIds),
            eq(progressPhotosTable.sharedWithFriends, true),
          ),
        )
        .orderBy(desc(progressPhotosTable.takenOn), desc(progressPhotosTable.id)),
    ]);

  const settingsOf = new Map(settingsRows.map((s) => [s.userId, s]));
  const pointsOf = new Map(
    points.map((p) => [p.userId, { balance: Number(p.balance ?? 0), earned: Number(p.earned ?? 0) }]),
  );
  const sharedPhotosOf = new Map<string, ProgressPhoto[]>();
  for (const photo of sharedPhotoRows) {
    const list = sharedPhotosOf.get(photo.userId) ?? [];
    if (list.length < 4) {
      list.push(photo);
      sharedPhotosOf.set(photo.userId, list);
    }
  }
  const checkinsOf = new Map<string, GlowCheckin[]>();
  for (const c of checkins) {
    const list = checkinsOf.get(c.userId) ?? [];
    list.push(c);
    checkinsOf.set(c.userId, list);
  }
  const goalOf = new Map(goals.map((g) => [g.userId, g]));
  const latestWeightOf = new Map<string, number>();
  for (const w of weights) {
    if (!latestWeightOf.has(w.userId)) latestWeightOf.set(w.userId, w.weightLbs);
  }

  const today = todayString();
  const weekAgo = dateStringDaysAgo(6);
  const journeys = friends.map((friend) => {
    const settings = settingsOf.get(friend.id) ?? { userId: friend.id, ...DEFAULT_SETTINGS };
    const friendCheckins = checkinsOf.get(friend.id) ?? [];
    const dateSet = new Set(friendCheckins.map((c) => c.date));

    let streakDays: number | null = null;
    let glowScoreToday: number | null = null;
    let checkinsLast7Days: number | null = null;
    let lastActiveDate: string | null = null;
    if (settings.shareStreak) {
      streakDays = computeStreak(dateSet);
    }
    if (settings.shareGlow) {
      const todayCheckin = friendCheckins.find((c) => c.date === today);
      glowScoreToday = todayCheckin ? computeGlowScore(todayCheckin) : null;
      checkinsLast7Days = friendCheckins.filter((c) => c.date >= weekAgo).length;
      lastActiveDate = friendCheckins[0]?.date ?? null;
    }

    let weightProgressPct: number | null = null;
    if (settings.shareWeightProgress) {
      const goal = goalOf.get(friend.id);
      const current = latestWeightOf.get(friend.id);
      if (
        goal?.startWeightLbs != null &&
        goal?.goalWeightLbs != null &&
        current != null &&
        goal.startWeightLbs !== goal.goalWeightLbs
      ) {
        const pct =
          ((goal.startWeightLbs - current) / (goal.startWeightLbs - goal.goalWeightLbs)) * 100;
        weightProgressPct = Math.round(Math.min(100, Math.max(0, pct)));
      }
    }

    let pointsBalance: number | null = null;
    let tier: string | null = null;
    if (settings.sharePoints) {
      const p = pointsOf.get(friend.id) ?? { balance: 0, earned: 0 };
      pointsBalance = p.balance;
      tier = getTierInfo(p.earned).name;
    }

    let poundsLost: number | null = null;
    if (settings.shareNumbers) {
      const goal = goalOf.get(friend.id);
      const current = latestWeightOf.get(friend.id);
      if (goal?.startWeightLbs != null && current != null) {
        poundsLost = Math.round((goal.startWeightLbs - current) * 10) / 10;
      }
    }

    const sharedPhotos = settings.sharePhotos
      ? (sharedPhotosOf.get(friend.id) ?? []).map((p) => ({
          id: p.id,
          takenOn: p.takenOn,
          category: p.category,
        }))
      : [];

    return {
      userId: friend.id,
      name: displayName(friend),
      streakDays,
      glowScoreToday,
      checkinsLast7Days,
      weightProgressPct,
      lastActiveDate,
      pointsBalance,
      tier,
      poundsLost,
      sharedPhotos,
    };
  });

  journeys.sort((a, b) => a.name.localeCompare(b.name));
  res.json(GetFriendJourneysResponse.parse({ journeys }));
});

router.get(
  "/friends/:friendId/photos/:photoId/image",
  rateLimitFriendPhotos,
  async (req, res): Promise<void> => {
    const userId = userIdOf(res);
    const friendIdParam = req.params.friendId;
    const friendId = typeof friendIdParam === "string" ? friendIdParam : "";
    const photoId = Number(req.params.photoId);
    if (!friendId || !Number.isInteger(photoId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    // All checks run fresh per request so unsharing/unfollowing takes effect
    // immediately. Every failure mode returns an identical 404.
    const [photo] = await db
      .select()
      .from(progressPhotosTable)
      .where(
        and(
          eq(progressPhotosTable.id, photoId),
          eq(progressPhotosTable.userId, friendId),
          eq(progressPhotosTable.sharedWithFriends, true),
        ),
      );
    if (!photo) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [follow] = await db
      .select()
      .from(followsTable)
      .where(
        and(
          eq(followsTable.followerUserId, userId),
          eq(followsTable.followeeUserId, friendId),
          eq(followsTable.status, "accepted"),
        ),
      );
    if (!follow) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const settings = await getSettingsFor(friendId);
    if (!settings.sharePhotos) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    try {
      const objectFile = await objectStorageService.getObjectEntityFile(photo.objectPath);
      // Short cache so a revoked share doesn't linger in browser cache.
      const response = await objectStorageService.downloadObject(objectFile, 300);
      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));
      if (response.body) {
        const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      req.log.error({ err: error }, "Failed to stream friend photo");
      res.status(404).json({ error: "Not found" });
    }
  },
);

router.get("/social/settings", async (_req, res): Promise<void> => {
  const userId = userIdOf(res);
  const settings = await getSettingsFor(userId);
  res.json(
    GetSharingSettingsResponse.parse({
      shareGlow: settings.shareGlow,
      shareWeightProgress: settings.shareWeightProgress,
      shareStreak: settings.shareStreak,
      sharePoints: settings.sharePoints,
      shareNumbers: settings.shareNumbers,
      sharePhotos: settings.sharePhotos,
    }),
  );
});

router.put("/social/settings", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const body = UpdateSharingSettingsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [saved] = await db
    .insert(shareSettingsTable)
    .values({ userId, ...body.data })
    .onConflictDoUpdate({ target: shareSettingsTable.userId, set: body.data })
    .returning();
  res.json(
    UpdateSharingSettingsResponse.parse({
      shareGlow: saved.shareGlow,
      shareWeightProgress: saved.shareWeightProgress,
      shareStreak: saved.shareStreak,
      sharePoints: saved.sharePoints,
      shareNumbers: saved.shareNumbers,
      sharePhotos: saved.sharePhotos,
    }),
  );
});

router.get("/cheers", async (_req, res): Promise<void> => {
  const userId = userIdOf(res);
  const rows = await db
    .select({
      id: cheersTable.id,
      emoji: cheersTable.emoji,
      message: cheersTable.message,
      createdAt: cheersTable.createdAt,
      fromFirstName: usersTable.firstName,
      fromEmail: usersTable.email,
    })
    .from(cheersTable)
    .innerJoin(usersTable, eq(usersTable.id, cheersTable.fromUserId))
    .where(eq(cheersTable.toUserId, userId))
    .orderBy(desc(cheersTable.createdAt))
    .limit(20);
  res.json(
    GetCheersResponse.parse({
      cheers: rows.map((r) => ({
        id: r.id,
        fromName: displayName({ firstName: r.fromFirstName, email: r.fromEmail }),
        emoji: r.emoji,
        message: r.message,
        createdAt: r.createdAt.toISOString(),
      })),
    }),
  );
});

router.post("/cheers", rateLimitCheers, async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const body = SendCheerBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const { toUserId, emoji, message } = body.data;
  const [follow] = await db
    .select()
    .from(followsTable)
    .where(
      and(
        eq(followsTable.followerUserId, userId),
        eq(followsTable.followeeUserId, toUserId),
        eq(followsTable.status, "accepted"),
      ),
    );
  if (!follow) {
    res.status(403).json({ error: "You can only cheer friends you follow" });
    return;
  }
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todaysCheers = await db
    .select({ id: cheersTable.id })
    .from(cheersTable)
    .where(
      and(
        eq(cheersTable.fromUserId, userId),
        eq(cheersTable.toUserId, toUserId),
        gte(cheersTable.createdAt, startOfDay),
      ),
    );
  if (todaysCheers.length >= 5) {
    res.status(429).json({ error: "You've sent this friend plenty of cheers today — try again tomorrow!" });
    return;
  }
  await db.insert(cheersTable).values({ fromUserId: userId, toUserId, emoji, message: message ?? null });
  res.json(SendCheerResponse.parse({ sent: true }));
});

export default router;
