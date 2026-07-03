import { Router, type IRouter } from "express";
import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, communityPostsTable, communityHeartsTable } from "@workspace/db";
import { awardOncePerDay, POINTS } from "../lib/rewards";
import { userIdOf } from "../middlewares/auth";
import { CreateCommunityPostBody } from "@workspace/api-zod";
import type { Request, Response, NextFunction } from "express";

const router: IRouter = Router();

const DAILY_POST_LIMIT = 3;

const communityHits = new Map<string, { count: number; windowStart: number }>();

function makeRateLimiter(prefix: string, limit: number, windowMs: number) {
  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();
    const keys = [`${prefix}:ip:${req.ip ?? "unknown"}`, `${prefix}:user:${userIdOf(res)}`];
    for (const key of keys) {
      const entry = communityHits.get(key);
      if (!entry || now - entry.windowStart > windowMs) {
        if (communityHits.size > 5000) communityHits.clear();
        communityHits.set(key, { count: 1, windowStart: now });
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

const rateLimitPosts = makeRateLimiter("post", 5, 60_000);
const rateLimitHearts = makeRateLimiter("heart", 30, 60_000);

router.get("/community/posts", async (_req, res): Promise<void> => {
  const userId = userIdOf(res);
  const posts = await db
    .select()
    .from(communityPostsTable)
    .where(eq(communityPostsTable.hidden, false))
    .orderBy(desc(communityPostsTable.createdAt), desc(communityPostsTable.id))
    .limit(100);

  const postIds = posts.map((p) => p.id);
  const heartRows = postIds.length
    ? await db
        .select({
          postId: communityHeartsTable.postId,
          total: count(),
          mine: sql<number>`count(*) filter (where ${communityHeartsTable.userId} = ${userId})`,
        })
        .from(communityHeartsTable)
        .where(inArray(communityHeartsTable.postId, postIds))
        .groupBy(communityHeartsTable.postId)
    : [];
  const heartsByPost = new Map(heartRows.map((r) => [r.postId, r]));

  res.json({
    posts: posts.map((p) => ({
      id: p.id,
      category: p.category,
      body: p.body,
      createdAt: p.createdAt.toISOString(),
      heartCount: Number(heartsByPost.get(p.id)?.total ?? 0),
      heartedByMe: Number(heartsByPost.get(p.id)?.mine ?? 0) > 0,
      mine: p.userId === userId,
    })),
  });
});

router.post("/community/posts", rateLimitPosts, async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const body = CreateCommunityPostBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Posts need a category and 10-500 characters of text" });
    return;
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const post = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`community_post:${userId}`}))`);
    const [{ postedToday }] = await tx
      .select({ postedToday: count() })
      .from(communityPostsTable)
      .where(
        and(
          eq(communityPostsTable.userId, userId),
          gte(communityPostsTable.createdAt, startOfToday),
        ),
      );
    if (Number(postedToday) >= DAILY_POST_LIMIT) return null;
    const [created] = await tx
      .insert(communityPostsTable)
      .values({ userId, category: body.data.category, body: body.data.body.trim() })
      .returning();
    return created;
  });
  if (!post) {
    res.status(429).json({ error: `You can share up to ${DAILY_POST_LIMIT} posts per day` });
    return;
  }

  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  await awardOncePerDay(
    userId,
    "community_post",
    `${y}-${m}-${d}`,
    POINTS.communityPost,
    "Shared a win with the community",
  );

  res.status(201).json({
    id: post.id,
    category: post.category,
    body: post.body,
    createdAt: post.createdAt.toISOString(),
    heartCount: 0,
    heartedByMe: false,
    mine: true,
  });
});

router.delete("/community/posts/:id", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const postId = Number(req.params.id);
  if (!Number.isInteger(postId)) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  const deleted = await db.transaction(async (tx) => {
    const [post] = await tx
      .select({ id: communityPostsTable.id })
      .from(communityPostsTable)
      .where(and(eq(communityPostsTable.id, postId), eq(communityPostsTable.userId, userId)));
    if (!post) return false;
    await tx.delete(communityHeartsTable).where(eq(communityHeartsTable.postId, postId));
    await tx.delete(communityPostsTable).where(eq(communityPostsTable.id, postId));
    return true;
  });
  if (!deleted) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  res.status(204).end();
});

router.post("/community/posts/:id/heart", rateLimitHearts, async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const postId = Number(req.params.id);
  if (!Number.isInteger(postId)) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  const [post] = await db
    .select({ id: communityPostsTable.id })
    .from(communityPostsTable)
    .where(and(eq(communityPostsTable.id, postId), eq(communityPostsTable.hidden, false)));
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const { hearted, total } = await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`community_heart:${userId}:${postId}`}))`,
    );
    const inserted = await tx
      .insert(communityHeartsTable)
      .values({ postId, userId })
      .onConflictDoNothing({
        target: [communityHeartsTable.postId, communityHeartsTable.userId],
      })
      .returning({ id: communityHeartsTable.id });

    let nowHearted = true;
    if (inserted.length === 0) {
      await tx
        .delete(communityHeartsTable)
        .where(
          and(eq(communityHeartsTable.postId, postId), eq(communityHeartsTable.userId, userId)),
        );
      nowHearted = false;
    }

    const [{ total: heartTotal }] = await tx
      .select({ total: count() })
      .from(communityHeartsTable)
      .where(eq(communityHeartsTable.postId, postId));
    return { hearted: nowHearted, total: heartTotal };
  });

  res.json({ hearted, heartCount: Number(total) });
});

export default router;
