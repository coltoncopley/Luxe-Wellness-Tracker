import { Router, type IRouter, type Request, type Response } from "express";
import { asc, eq } from "drizzle-orm";
import { db, skinScansTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { z } from "zod/v4";
import {
  AnalyzeSkinScanBody,
  AnalyzeSkinScanResponse,
  GetSkinScanHistoryResponse,
} from "@workspace/api-zod";
import { POINTS, awardOncePerDay } from "../lib/rewards";
import { currentWeek } from "./missions";

const router: IRouter = Router();

function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const scoreSchema = z.number().min(0).max(100);

const analysisSchema = z.object({
  isFace: z.boolean(),
  hydration: scoreSchema,
  smoothness: scoreSchema,
  evenness: scoreSchema,
  clarity: scoreSchema,
  radiance: scoreSchema,
  summary: z.string(),
  tips: z.array(z.string()).min(1).max(4),
  suggestion: z.string().nullable().optional(),
});

function toScanResponse(row: typeof skinScansTable.$inferSelect) {
  return {
    id: row.id,
    weekStart: row.weekStart,
    scannedOn: row.scannedOn,
    overall: row.overall,
    hydration: row.hydration,
    smoothness: row.smoothness,
    evenness: row.evenness,
    clarity: row.clarity,
    radiance: row.radiance,
    summary: row.summary,
    tips: row.tips,
    suggestion: row.suggestion,
  };
}

router.get("/skin-scan", async (_req: Request, res: Response) => {
  const userId = res.locals.userId as string;
  const { weekStart } = currentWeek();
  const rows = await db
    .select()
    .from(skinScansTable)
    .where(eq(skinScansTable.userId, userId))
    .orderBy(asc(skinScansTable.weekStart));
  res.json(
    GetSkinScanHistoryResponse.parse({
      scans: rows.map(toScanResponse),
      weekStart,
      currentWeekScanned: rows.some((r) => r.weekStart === weekStart),
    }),
  );
});

router.post("/skin-scan/analyze", async (req: Request, res: Response) => {
  const userId = res.locals.userId as string;
  const body = AnalyzeSkinScanBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input" });
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
          "You are a cosmetic skin-wellness assistant for a med spa patient app. " +
          "You are NOT a dermatologist and NEVER diagnose conditions, diseases, or infections. " +
          "Assess the visible cosmetic qualities of the skin in the selfie and respond ONLY with JSON matching: " +
          '{"isFace": boolean, "hydration": number, "smoothness": number, "evenness": number, "clarity": number, "radiance": number, "summary": string, "tips": string[], "suggestion": string|null}. ' +
          "All scores are 0-100 where higher is better (hydration = moisture/plumpness, smoothness = texture, evenness = tone uniformity, clarity = freedom from visible blemishes, radiance = glow). " +
          "Be encouraging and realistic; typical healthy skin scores 60-85. " +
          "If the image is not a clear, well-lit human face, set isFace to false. " +
          "summary: 2-3 warm sentences on what looks good and what to focus on. Educational language only ('appears', 'may') — never medical claims. " +
          "tips: 2-4 short at-home skincare/hydration/lifestyle tips tailored to what you see. " +
          "suggestion: at most ONE gentle LUXE med spa treatment idea relevant to the main opportunity (e.g. hydrafacial, chemical peel, microneedling, dermaplaning), phrased as an option to ask about — or null if nothing fits. Never pressure.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Here is my weekly skin check-in selfie." },
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
  let analysis: z.infer<typeof analysisSchema>;
  try {
    analysis = analysisSchema.parse(JSON.parse(raw));
  } catch {
    req.log.warn({ raw }, "Unparseable skin analysis from model");
    res.status(422).json({ error: "The photo could not be analyzed. Please try again." });
    return;
  }
  if (!analysis.isFace) {
    res.status(422).json({
      error: "That doesn't look like a clear face photo. Try a well-lit selfie facing the camera.",
    });
    return;
  }

  const round = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  const hydration = round(analysis.hydration);
  const smoothness = round(analysis.smoothness);
  const evenness = round(analysis.evenness);
  const clarity = round(analysis.clarity);
  const radiance = round(analysis.radiance);
  const overall = round((hydration + smoothness + evenness + clarity + radiance) / 5);

  const { weekStart } = currentWeek();
  const values = {
    userId,
    weekStart,
    scannedOn: todayString(),
    overall,
    hydration,
    smoothness,
    evenness,
    clarity,
    radiance,
    summary: analysis.summary,
    tips: analysis.tips,
    suggestion: analysis.suggestion ?? null,
  };

  const [row] = await db
    .insert(skinScansTable)
    .values(values)
    .onConflictDoUpdate({
      target: [skinScansTable.userId, skinScansTable.weekStart],
      set: values,
    })
    .returning();

  await awardOncePerDay(userId, "skin_scan", weekStart, POINTS.skinScan, "Weekly skin scan");

  res.json(AnalyzeSkinScanResponse.parse(toScanResponse(row!)));
});

export default router;
