import { Router, type IRouter } from "express";
import { and, count, eq, gte, lte, sql } from "drizzle-orm";
import {
  db,
  foodLogsTable,
  glowCheckinsTable,
  weightEntriesTable,
  cheersTable,
  rewardEventsTable,
} from "@workspace/db";
import { ListMissionsResponse } from "@workspace/api-zod";
import { userIdOf } from "../middlewares/auth";

const router: IRouter = Router();

interface MissionDef {
  key: string;
  title: string;
  description: string;
  target: number;
  rewardPoints: number;
  progress: (userId: string, weekStart: string, weekEnd: string) => Promise<number>;
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday-based current week as YYYY-MM-DD strings. */
export function currentWeek(now = new Date()): { weekStart: string; weekEnd: string } {
  const d = new Date(now);
  const dow = d.getDay(); // 0 = Sunday
  const sinceMonday = (dow + 6) % 7;
  d.setDate(d.getDate() - sinceMonday);
  const start = toDateString(d);
  d.setDate(d.getDate() + 6);
  return { weekStart: start, weekEnd: toDateString(d) };
}

const MISSIONS: MissionDef[] = [
  {
    key: "glow_checkins",
    title: "Glow getter",
    description: "Complete 3 Glow check-ins this week",
    target: 3,
    rewardPoints: 40,
    progress: async (userId, weekStart, weekEnd) => {
      const [row] = await db
        .select({ n: count() })
        .from(glowCheckinsTable)
        .where(
          and(
            eq(glowCheckinsTable.userId, userId),
            gte(glowCheckinsTable.date, weekStart),
            lte(glowCheckinsTable.date, weekEnd),
          ),
        );
      return row?.n ?? 0;
    },
  },
  {
    key: "meals_logged",
    title: "Mindful eater",
    description: "Log 5 meals this week",
    target: 5,
    rewardPoints: 30,
    progress: async (userId, weekStart, weekEnd) => {
      const [row] = await db
        .select({ n: count() })
        .from(foodLogsTable)
        .where(
          and(
            eq(foodLogsTable.userId, userId),
            gte(foodLogsTable.date, weekStart),
            lte(foodLogsTable.date, weekEnd),
          ),
        );
      return row?.n ?? 0;
    },
  },
  {
    key: "weigh_ins",
    title: "Scale check",
    description: "Weigh in twice this week",
    target: 2,
    rewardPoints: 25,
    progress: async (userId, weekStart, weekEnd) => {
      const [row] = await db
        .select({ n: count() })
        .from(weightEntriesTable)
        .where(
          and(
            eq(weightEntriesTable.userId, userId),
            gte(weightEntriesTable.date, weekStart),
            lte(weightEntriesTable.date, weekEnd),
          ),
        );
      return row?.n ?? 0;
    },
  },
  {
    key: "cheers_sent",
    title: "Hype friend",
    description: "Send 2 cheers to friends this week",
    target: 2,
    rewardPoints: 15,
    progress: async (userId, weekStart) => {
      const [row] = await db
        .select({ n: count() })
        .from(cheersTable)
        .where(
          and(
            eq(cheersTable.fromUserId, userId),
            sql`${cheersTable.createdAt} >= ${weekStart}::date`,
          ),
        );
      return row?.n ?? 0;
    },
  },
];

router.get("/missions", async (_req, res): Promise<void> => {
  const userId = userIdOf(res);
  const { weekStart, weekEnd } = currentWeek();
  const today = toDateString(new Date());

  const missions = await Promise.all(
    MISSIONS.map(async (m) => {
      const raw = await m.progress(userId, weekStart, weekEnd);
      const progress = Math.min(raw, m.target);
      const completed = raw >= m.target;
      if (completed) {
        await db
          .insert(rewardEventsTable)
          .values({
            userId,
            type: "mission",
            date: today,
            points: m.rewardPoints,
            description: `Mission complete: ${m.title}`,
            dedupeKey: `mission:${m.key}:${weekStart}`,
          })
          .onConflictDoNothing({
            target: [rewardEventsTable.userId, rewardEventsTable.dedupeKey],
          });
      }
      return {
        key: m.key,
        title: m.title,
        description: m.description,
        target: m.target,
        progress,
        completed,
        rewardPoints: m.rewardPoints,
      };
    }),
  );

  res.json(
    ListMissionsResponse.parse({
      weekStart,
      weekEnd,
      missions,
      completedCount: missions.filter((m) => m.completed).length,
    }),
  );
});

export default router;
