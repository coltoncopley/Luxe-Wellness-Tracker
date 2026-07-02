import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, weightEntriesTable, measurementsTable, goalsTable } from "@workspace/db";
import { awardOncePerDay, POINTS } from "../lib/rewards";
import {
  ListWeightEntriesResponse,
  CreateWeightEntryBody,
  CreateWeightEntryResponse,
  DeleteWeightEntryParams,
  ListMeasurementsResponse,
  CreateMeasurementBody,
  CreateMeasurementResponse,
  DeleteMeasurementParams,
  GetGoalResponse,
  SetGoalBody,
  SetGoalResponse,
  GetWeightProgressResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/weight-entries", async (_req, res): Promise<void> => {
  const rows = await db.select().from(weightEntriesTable).orderBy(asc(weightEntriesTable.date));
  res.json(ListWeightEntriesResponse.parse(rows));
});

router.post("/weight-entries", async (req, res): Promise<void> => {
  const parsed = CreateWeightEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(weightEntriesTable).values(parsed.data).returning();
  await awardOncePerDay("weight_entry", row.date, POINTS.weightEntry, "Daily weigh-in");
  res.status(201).json(CreateWeightEntryResponse.parse(row));
});

router.delete("/weight-entries/:id", async (req, res): Promise<void> => {
  const params = DeleteWeightEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(weightEntriesTable)
    .where(eq(weightEntriesTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Weight entry not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/measurements", async (_req, res): Promise<void> => {
  const rows = await db.select().from(measurementsTable).orderBy(asc(measurementsTable.date));
  res.json(ListMeasurementsResponse.parse(rows));
});

router.post("/measurements", async (req, res): Promise<void> => {
  const parsed = CreateMeasurementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(measurementsTable).values(parsed.data).returning();
  res.status(201).json(CreateMeasurementResponse.parse(row));
});

router.delete("/measurements/:id", async (req, res): Promise<void> => {
  const params = DeleteMeasurementParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(measurementsTable)
    .where(eq(measurementsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Measurement not found" });
    return;
  }
  res.sendStatus(204);
});

async function getOrCreateGoal() {
  const [existing] = await db.select().from(goalsTable).orderBy(asc(goalsTable.id)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(goalsTable).values({}).returning();
  return created;
}

router.get("/goal", async (_req, res): Promise<void> => {
  const goal = await getOrCreateGoal();
  res.json(GetGoalResponse.parse(goal));
});

router.put("/goal", async (req, res): Promise<void> => {
  const parsed = SetGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const goal = await getOrCreateGoal();
  const [updated] = await db
    .update(goalsTable)
    .set(parsed.data)
    .where(eq(goalsTable.id, goal.id))
    .returning();
  res.json(SetGoalResponse.parse(updated));
});

router.get("/weight/progress", async (_req, res): Promise<void> => {
  const entries = await db.select().from(weightEntriesTable).orderBy(asc(weightEntriesTable.date));
  const goal = await getOrCreateGoal();

  const first = entries[0] ?? null;
  const last = entries.length > 0 ? entries[entries.length - 1] : null;
  const startWeightLbs = goal.startWeightLbs ?? first?.weightLbs ?? null;
  const currentWeightLbs = last?.weightLbs ?? null;
  const goalWeightLbs = goal.goalWeightLbs ?? null;

  let totalChangeLbs: number | null = null;
  if (startWeightLbs != null && currentWeightLbs != null) {
    totalChangeLbs = Math.round((currentWeightLbs - startWeightLbs) * 10) / 10;
  }

  let percentToGoal: number | null = null;
  if (startWeightLbs != null && currentWeightLbs != null && goalWeightLbs != null && startWeightLbs !== goalWeightLbs) {
    const pct = ((startWeightLbs - currentWeightLbs) / (startWeightLbs - goalWeightLbs)) * 100;
    percentToGoal = Math.max(0, Math.min(100, Math.round(pct)));
  }

  res.json(
    GetWeightProgressResponse.parse({
      startWeightLbs,
      currentWeightLbs,
      goalWeightLbs,
      totalChangeLbs,
      percentToGoal,
      entries,
    }),
  );
});

export default router;
