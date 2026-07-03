import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, ingredientScansTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { z } from "zod/v4";
import {
  AnalyzeIngredientsBody,
  AnalyzeIngredientsResponse,
  ListIngredientScansResponse,
  DeleteIngredientScanParams,
} from "@workspace/api-zod";
import { POINTS, INGREDIENT_SCAN_DAILY_CAP, awardWithDailyCap } from "../lib/rewards";

const router: IRouter = Router();

function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const analysisSchema = z.object({
  isIngredientLabel: z.boolean(),
  productName: z.string(),
  verdict: z.enum(["great", "good", "mixed", "caution"]),
  summary: z.string(),
  goodIngredients: z.array(z.string()).max(8),
  concerns: z.array(z.string()).max(8),
  pregnancySafety: z.enum(["generally_ok", "use_caution", "avoid", "unknown"]),
  pregnancyNote: z.string(),
  suggestion: z.string().nullable().optional(),
});

const DOCTOR_DEFERRAL = "Always confirm with your own doctor before using any product during pregnancy.";
const DEFERRAL_KEYWORDS = /doctor|physician|provider|ob[- ]?gyn|obstetrician|midwife/i;
const DIAGNOSTIC_PATTERNS =
  /\byou (have|are suffering|are experiencing)\b|\bdiagnos/i;

function enforceSafetyLanguage(analysis: z.infer<typeof analysisSchema>): z.infer<typeof analysisSchema> {
  let pregnancyNote = analysis.pregnancyNote.trim();
  if (!DEFERRAL_KEYWORDS.test(pregnancyNote)) {
    pregnancyNote = pregnancyNote ? `${pregnancyNote} ${DOCTOR_DEFERRAL}` : DOCTOR_DEFERRAL;
  }
  const summary = DIAGNOSTIC_PATTERNS.test(analysis.summary)
    ? "Here's an educational overview of this product's ingredients. This is general cosmetic information only — for anything about your own skin, talk with your provider."
    : analysis.summary;
  return { ...analysis, summary, pregnancyNote };
}

function toResponse(row: typeof ingredientScansTable.$inferSelect) {
  return {
    id: row.id,
    scannedOn: row.scannedOn,
    productName: row.productName,
    verdict: row.verdict,
    summary: row.summary,
    goodIngredients: row.goodIngredients,
    concerns: row.concerns,
    pregnancySafety: row.pregnancySafety,
    pregnancyNote: row.pregnancyNote,
    suggestion: row.suggestion,
  };
}

router.get("/ingredients", async (_req: Request, res: Response) => {
  const userId = res.locals.userId as string;
  const rows = await db
    .select()
    .from(ingredientScansTable)
    .where(eq(ingredientScansTable.userId, userId))
    .orderBy(desc(ingredientScansTable.createdAt));
  res.json(ListIngredientScansResponse.parse({ scans: rows.map(toResponse) }));
});

router.post("/ingredients/analyze", async (req: Request, res: Response) => {
  const userId = res.locals.userId as string;
  const body = AnalyzeIngredientsBody.safeParse(req.body);
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
          "You are a cosmetic skincare ingredient educator for a med spa patient app. " +
          "You are NOT a doctor or pharmacist and NEVER give medical advice or diagnose reactions. " +
          "Read the ingredient list in the photo and respond ONLY with JSON matching: " +
          '{"isIngredientLabel": boolean, "productName": string, "verdict": "great"|"good"|"mixed"|"caution", "summary": string, "goodIngredients": string[], "concerns": string[], "pregnancySafety": "generally_ok"|"use_caution"|"avoid"|"unknown", "pregnancyNote": string, "suggestion": string|null}. ' +
          "If the photo does not show a readable cosmetic/skincare ingredient list, set isIngredientLabel to false. " +
          "productName: the product name if visible, otherwise a short description like 'Facial moisturizer'. " +
          "verdict: overall cosmetic quality of the formula ('great' = excellent actives and clean formula, 'caution' = multiple problematic ingredients). " +
          "summary: 2-3 friendly sentences — is it worth using, and for what skin type. Educational language only ('may', 'is generally considered'). " +
          "goodIngredients: up to 6 beneficial ingredients as 'Name — brief benefit'. " +
          "concerns: up to 6 flagged ingredients as 'Name — the concern' (comedogenic, common irritant, fragrance, drying alcohol, etc). Empty array if none. " +
          "pregnancySafety + pregnancyNote: general educational note on commonly-flagged pregnancy ingredients (e.g. retinoids, high-dose salicylic acid); ALWAYS say to confirm with their own doctor. " +
          "suggestion: at most ONE gentle, no-pressure invitation to ask their LUXE provider about a medical-grade alternative from the lines LUXE carries — prefer SkinMedica first, then Colorescience (only when Colorescience is the more relevant fit, e.g. mineral SPF or tinted sun protection). Name the brand and the relevant product category (e.g. 'a SkinMedica growth-factor serum'), phrased as something to ask their provider about at their next visit — never as a directive to buy or a claim it will fix their skin. Use null if no alternative genuinely makes sense.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Here is the ingredient label of a skincare product." },
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
    req.log.warn({ raw }, "Unparseable ingredient analysis from model");
    res.status(422).json({ error: "The photo could not be analyzed. Please try again." });
    return;
  }
  analysis = enforceSafetyLanguage(analysis);
  if (!analysis.isIngredientLabel) {
    res.status(422).json({
      error:
        "That doesn't look like an ingredient list. Try a clear, close-up photo of the ingredients on the label.",
    });
    return;
  }

  const [row] = await db
    .insert(ingredientScansTable)
    .values({
      userId,
      scannedOn: todayString(),
      productName: analysis.productName,
      verdict: analysis.verdict,
      summary: analysis.summary,
      goodIngredients: analysis.goodIngredients,
      concerns: analysis.concerns,
      pregnancySafety: analysis.pregnancySafety,
      pregnancyNote: analysis.pregnancyNote,
      suggestion: analysis.suggestion ?? null,
    })
    .returning();

  await awardWithDailyCap(
    userId,
    "ingredient_scan",
    todayString(),
    POINTS.ingredientScan,
    "Ingredient scan",
    INGREDIENT_SCAN_DAILY_CAP,
  );

  res.json(AnalyzeIngredientsResponse.parse(toResponse(row!)));
});

router.delete("/ingredients/:id", async (req: Request, res: Response) => {
  const userId = res.locals.userId as string;
  const params = DeleteIngredientScanParams.safeParse(req.params);
  if (!params.success) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const deleted = await db
    .delete(ingredientScansTable)
    .where(
      and(
        eq(ingredientScansTable.id, params.data.id),
        eq(ingredientScansTable.userId, userId),
      ),
    )
    .returning({ id: ingredientScansTable.id });
  if (deleted.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(204).end();
});

export default router;
