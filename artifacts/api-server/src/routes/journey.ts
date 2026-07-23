import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import {
  db,
  progressPhotosTable,
  weightEntriesTable,
  glowCheckinsTable,
} from "@workspace/db";
import { GetJourneyResponse } from "@workspace/api-zod";
import { userIdOf } from "../middlewares/auth";
import { computeGlowScore } from "./glow";

const router: IRouter = Router();

interface DayBucket {
  photos: { id: number; objectPath: string; category: string; note: string | null }[];
  weightLbs: number | null;
  glowScore: number | null;
}

router.get("/journey", async (_req, res): Promise<void> => {
  const userId = userIdOf(res);

  const [photos, weights, glows] = await Promise.all([
    db
      .select()
      .from(progressPhotosTable)
      .where(eq(progressPhotosTable.userId, userId))
      .orderBy(asc(progressPhotosTable.takenOn), asc(progressPhotosTable.id)),
    db
      .select()
      .from(weightEntriesTable)
      .where(eq(weightEntriesTable.userId, userId))
      .orderBy(asc(weightEntriesTable.date), asc(weightEntriesTable.id)),
    db
      .select()
      .from(glowCheckinsTable)
      .where(eq(glowCheckinsTable.userId, userId))
      .orderBy(asc(glowCheckinsTable.date)),
  ]);

  const byDate = new Map<string, DayBucket>();
  const bucket = (date: string): DayBucket => {
    let b = byDate.get(date);
    if (!b) {
      b = { photos: [], weightLbs: null, glowScore: null };
      byDate.set(date, b);
    }
    return b;
  };

  for (const p of photos) {
    bucket(p.takenOn).photos.push({
      id: p.id,
      objectPath: p.objectPath,
      category: p.category,
      note: p.note,
    });
  }
  // Later same-day weigh-ins win (mirrors weight page's latest-entry semantics).
  for (const w of weights) bucket(w.date).weightLbs = w.weightLbs;
  for (const g of glows) bucket(g.date).glowScore = computeGlowScore(g);

  const days = [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, b]) => ({ date, ...b }));

  const firstWeight = weights[0] ?? null;
  const lastWeight = weights.length > 0 ? weights[weights.length - 1]! : null;

  res.json(
    GetJourneyResponse.parse({
      days,
      startWeightLbs: firstWeight?.weightLbs ?? null,
      currentWeightLbs: lastWeight?.weightLbs ?? null,
      firstDate: days.length > 0 ? days[0]!.date : null,
    }),
  );
});

export default router;
