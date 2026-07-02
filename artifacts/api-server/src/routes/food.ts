import { Router, type IRouter } from "express";
import { eq, asc, ilike, and, desc } from "drizzle-orm";
import { db, restaurantsTable, menuItemsTable, foodLogsTable, goalsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { z } from "zod/v4";
import { awardWithDailyCap, POINTS, FOOD_LOG_DAILY_CAP } from "../lib/rewards";
import { userIdOf } from "../middlewares/auth";
import {
  AnalyzeMealPhotoBody,
  AnalyzeMealPhotoResponse,
  ListRestaurantsResponse,
  ListMenuItemsParams,
  ListMenuItemsResponse,
  ListHealthyPicksParams,
  ListHealthyPicksResponse,
  SearchMenuItemsQueryParams,
  SearchMenuItemsResponse,
  ListFoodLogsQueryParams,
  ListFoodLogsResponse,
  CreateFoodLogBody,
  CreateFoodLogResponse,
  DeleteFoodLogParams,
  GetDailySummaryQueryParams,
  GetDailySummaryResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const menuItemSelect = {
  id: menuItemsTable.id,
  restaurantId: menuItemsTable.restaurantId,
  restaurantName: restaurantsTable.name,
  name: menuItemsTable.name,
  calories: menuItemsTable.calories,
  proteinG: menuItemsTable.proteinG,
  carbsG: menuItemsTable.carbsG,
  fatG: menuItemsTable.fatG,
  isHealthyPick: menuItemsTable.isHealthyPick,
  orderingTip: menuItemsTable.orderingTip,
};

router.get("/restaurants", async (_req, res): Promise<void> => {
  const rows = await db.select().from(restaurantsTable).orderBy(asc(restaurantsTable.name));
  res.json(ListRestaurantsResponse.parse(rows));
});

router.get("/restaurants/:id/menu-items", async (req, res): Promise<void> => {
  const params = ListMenuItemsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db
    .select(menuItemSelect)
    .from(menuItemsTable)
    .innerJoin(restaurantsTable, eq(menuItemsTable.restaurantId, restaurantsTable.id))
    .where(eq(menuItemsTable.restaurantId, params.data.id))
    .orderBy(asc(menuItemsTable.calories));
  res.json(ListMenuItemsResponse.parse(rows));
});

router.get("/restaurants/:id/healthy-picks", async (req, res): Promise<void> => {
  const params = ListHealthyPicksParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db
    .select(menuItemSelect)
    .from(menuItemsTable)
    .innerJoin(restaurantsTable, eq(menuItemsTable.restaurantId, restaurantsTable.id))
    .where(
      and(
        eq(menuItemsTable.restaurantId, params.data.id),
        eq(menuItemsTable.isHealthyPick, true),
      ),
    )
    .orderBy(asc(menuItemsTable.calories));
  res.json(ListHealthyPicksResponse.parse(rows));
});

router.get("/menu-items/search", async (req, res): Promise<void> => {
  const query = SearchMenuItemsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const rows = await db
    .select(menuItemSelect)
    .from(menuItemsTable)
    .innerJoin(restaurantsTable, eq(menuItemsTable.restaurantId, restaurantsTable.id))
    .where(ilike(menuItemsTable.name, `%${query.data.q}%`))
    .orderBy(asc(menuItemsTable.calories))
    .limit(50);
  res.json(SearchMenuItemsResponse.parse(rows));
});

router.get("/food-logs", async (req, res): Promise<void> => {
  const query = ListFoodLogsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const userId = userIdOf(res);
  const rows = query.data.date
    ? await db
        .select()
        .from(foodLogsTable)
        .where(and(eq(foodLogsTable.userId, userId), eq(foodLogsTable.date, query.data.date)))
        .orderBy(asc(foodLogsTable.id))
    : await db
        .select()
        .from(foodLogsTable)
        .where(eq(foodLogsTable.userId, userId))
        .orderBy(desc(foodLogsTable.date), asc(foodLogsTable.id));
  res.json(ListFoodLogsResponse.parse(rows));
});

router.post("/food-logs", async (req, res): Promise<void> => {
  const parsed = CreateFoodLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = userIdOf(res);
  const [row] = await db
    .insert(foodLogsTable)
    .values({ ...parsed.data, userId })
    .returning();
  await awardWithDailyCap(
    userId,
    "food_log",
    row.date,
    POINTS.foodLog,
    `Logged ${row.foodName}`,
    FOOD_LOG_DAILY_CAP,
  );
  res.status(201).json(CreateFoodLogResponse.parse(row));
});

const mealEstimateSchema = z.object({
  isFood: z.boolean(),
  name: z.string(),
  calories: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
  confidence: z.enum(["low", "medium", "high"]),
  notes: z.string(),
});

router.post("/food/analyze-photo", async (req, res): Promise<void> => {
  const body = AnalyzeMealPhotoBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,/.test(body.data.imageDataUrl)) {
    res.status(400).json({ error: "imageDataUrl must be a base64 JPEG, PNG, or WebP data URL" });
    return;
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    messages: [
      {
        role: "system",
        content:
          "You are a nutrition estimation assistant for a med spa patient app. " +
          "Analyze the meal photo and estimate total nutrition for the full visible portion. " +
          "Respond ONLY with JSON matching this shape: " +
          '{"isFood": boolean, "name": string, "calories": number, "proteinG": number, "carbsG": number, "fatG": number, "confidence": "low"|"medium"|"high", "notes": string}. ' +
          "If the image does not contain food or drink, set isFood to false. " +
          "Keep name short (e.g. 'Grilled chicken salad'). In notes, give one brief GLP-1-friendly observation (e.g. protein content, portion tip).",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Estimate the nutrition in this meal photo." },
          { type: "image_url", image_url: { url: body.data.imageDataUrl } },
        ],
      },
    ],
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    res.status(422).json({ error: "The photo could not be analyzed. Please try again." });
    return;
  }
  let estimate: z.infer<typeof mealEstimateSchema>;
  try {
    estimate = mealEstimateSchema.parse(JSON.parse(raw));
  } catch {
    req.log.warn({ raw }, "Unparseable meal estimate from model");
    res.status(422).json({ error: "The photo could not be analyzed. Please try again." });
    return;
  }
  if (!estimate.isFood) {
    res.status(422).json({ error: "That doesn't look like food. Try a clearer photo of your meal." });
    return;
  }

  res.json(
    AnalyzeMealPhotoResponse.parse({
      name: estimate.name,
      calories: Math.max(0, Math.round(estimate.calories)),
      proteinG: Math.max(0, Math.round(estimate.proteinG * 10) / 10),
      carbsG: Math.max(0, Math.round(estimate.carbsG * 10) / 10),
      fatG: Math.max(0, Math.round(estimate.fatG * 10) / 10),
      confidence: estimate.confidence,
      notes: estimate.notes,
    }),
  );
});

router.delete("/food-logs/:id", async (req, res): Promise<void> => {
  const params = DeleteFoodLogParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(foodLogsTable)
    .where(and(eq(foodLogsTable.id, params.data.id), eq(foodLogsTable.userId, userIdOf(res))))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Food log not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/food-logs/daily-summary", async (req, res): Promise<void> => {
  const query = GetDailySummaryQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const userId = userIdOf(res);
  const rows = await db
    .select()
    .from(foodLogsTable)
    .where(and(eq(foodLogsTable.userId, userId), eq(foodLogsTable.date, query.data.date)));

  const [goal] = await db.select().from(goalsTable).where(eq(goalsTable.userId, userId));

  const totals = rows.reduce(
    (acc, r) => {
      acc.calories += r.calories;
      acc.protein += r.proteinG ?? 0;
      acc.carbs += r.carbsG ?? 0;
      acc.fat += r.fatG ?? 0;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  res.json(
    GetDailySummaryResponse.parse({
      date: query.data.date,
      totalCalories: totals.calories,
      totalProteinG: Math.round(totals.protein * 10) / 10,
      totalCarbsG: Math.round(totals.carbs * 10) / 10,
      totalFatG: Math.round(totals.fat * 10) / 10,
      mealCount: rows.length,
      calorieTarget: goal?.dailyCalorieTarget ?? null,
    }),
  );
});

export default router;
