import { Router, type IRouter } from "express";
import { eq, asc, ilike, and, desc } from "drizzle-orm";
import { db, restaurantsTable, menuItemsTable, foodLogsTable, goalsTable } from "@workspace/db";
import {
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
  const rows = query.data.date
    ? await db
        .select()
        .from(foodLogsTable)
        .where(eq(foodLogsTable.date, query.data.date))
        .orderBy(asc(foodLogsTable.id))
    : await db.select().from(foodLogsTable).orderBy(desc(foodLogsTable.date), asc(foodLogsTable.id));
  res.json(ListFoodLogsResponse.parse(rows));
});

router.post("/food-logs", async (req, res): Promise<void> => {
  const parsed = CreateFoodLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(foodLogsTable).values(parsed.data).returning();
  res.status(201).json(CreateFoodLogResponse.parse(row));
});

router.delete("/food-logs/:id", async (req, res): Promise<void> => {
  const params = DeleteFoodLogParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(foodLogsTable)
    .where(eq(foodLogsTable.id, params.data.id))
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
  const rows = await db
    .select()
    .from(foodLogsTable)
    .where(eq(foodLogsTable.date, query.data.date));

  const [goal] = await db.select().from(goalsTable).limit(1);

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
