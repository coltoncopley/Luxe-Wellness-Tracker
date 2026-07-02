import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, rewardEventsTable } from "@workspace/db";
import {
  GetRewardsSummaryResponse,
  RedeemRewardBody,
  RedeemRewardResponse,
} from "@workspace/api-zod";
import { REWARD_CATALOG, getBalance, redeemPoints } from "../lib/rewards";

const router: IRouter = Router();

function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

router.get("/rewards/summary", async (_req, res): Promise<void> => {
  const events = await db
    .select()
    .from(rewardEventsTable)
    .orderBy(desc(rewardEventsTable.createdAt), desc(rewardEventsTable.id))
    .limit(50);

  const balance = await getBalance();
  const totalEarned = (
    await db.select().from(rewardEventsTable)
  ).reduce((acc, e) => (e.points > 0 ? acc + e.points : acc), 0);

  res.json(
    GetRewardsSummaryResponse.parse({
      balance,
      totalEarned,
      history: events,
      catalog: REWARD_CATALOG,
    }),
  );
});

router.post("/rewards/redeem", async (req, res): Promise<void> => {
  const body = RedeemRewardBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const reward = REWARD_CATALOG.find((r) => r.id === body.data.rewardId);
  if (!reward) {
    res.status(400).json({ error: "Unknown reward" });
    return;
  }
  const code = `LUXE-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const result = await redeemPoints(reward, todayString(), code);
  if (!result.ok) {
    res.status(400).json({ error: "Not enough points for this reward" });
    return;
  }

  res.json(
    RedeemRewardResponse.parse({
      code,
      reward,
      balance: result.balance,
    }),
  );
});

export default router;
