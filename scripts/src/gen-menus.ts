/**
 * One-off generator: builds comprehensive, realistic menus for the curated
 * (owner_user_id IS NULL) restaurants and writes them to
 * lib/db/src/restaurant-menu-extra.ts, which seed-data.ts merges into the seed.
 *
 * - Resumable: progress is checkpointed to scripts/.gen-menus-checkpoint.json
 *   after each restaurant, so a mid-run restart continues where it left off.
 * - GEN_LIMIT=<n>  : only process the first n restaurants missing from the
 *   checkpoint (used for a quick smoke test).
 * - GEN_EMIT_ONLY=1: skip generation, just (re)emit the .ts file from the
 *   existing checkpoint.
 *
 * Run: pnpm --filter @workspace/scripts run gen-menus
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { db, restaurantsTable } from "@workspace/db";
import { isNull, asc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { menuItemsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

type GenItem = {
  name: string;
  calories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  satFatG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
  cholesterolMg: number | null;
  isHealthyPick: boolean;
  orderingTip: string | null;
};

type Checkpoint = Record<string, GenItem[]>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHECKPOINT = path.join(__dirname, "..", ".gen-menus-checkpoint.json");
const OUT = path.join(__dirname, "..", "..", "lib", "db", "src", "restaurant-menu-extra.ts");
const MAX_ITEMS = 24;

const SHAPE =
  '{"menuItems":[{"name":string,"calories":number,"proteinG":number,"carbsG":number,"fatG":number,' +
  '"satFatG":number,"fiberG":number,"sugarG":number,"sodiumMg":number,"cholesterolMg":number,' +
  '"isHealthyPick":boolean,"orderingTip":string|null}]}';

const SYSTEM =
  "You are a nutrition data assistant for a wellness app dining guide. Given a well-known restaurant/chain, output a COMPREHENSIVE list of its REAL, popular menu items with realistic published nutrition. " +
  "Use ONLY real items this chain actually sells. Provide 18-24 items spanning the categories that chain is known for (entrees, sandwiches/burgers, sides, breakfast if applicable, salads/bowls, kids, and a few popular drinks/desserts). " +
  "Estimate nutrition per standard single serving using the chain's published values where known: calories plus grams of protein, carbs, fat, saturated fat, fiber, and sugar, plus milligrams of sodium and cholesterol. Never use null for a number — give your best realistic estimate. " +
  "Mark the 3-5 lightest and highest-protein choices as isHealthyPick:true, each with a short practical, non-medical orderingTip (e.g. 'Ask for dressing on the side'). All other items: isHealthyPick:false and orderingTip:null. " +
  "Use educational, non-medical language only. Never mention medications, dosing, or medical conditions. Do NOT include any item in the provided exclude list (case-insensitive, including close variants). " +
  "Respond ONLY with JSON — no prose or markdown: " +
  SHAPE;

function extractJson(raw: string): string | null {
  const cleaned = raw.replace(/```(?:json)?/gi, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return cleaned.slice(start, end + 1);
}

function num(n: unknown): number | null {
  return typeof n === "number" && isFinite(n) ? n : null;
}
const clampInt = (n: unknown, max: number): number | null => {
  const v = num(n);
  return v == null ? null : Math.min(Math.max(0, Math.round(v)), max);
};
const clampMacro = (n: unknown): number | null => {
  const v = num(n);
  return v == null ? null : Math.min(Math.max(0, Math.round(v * 10) / 10), 500);
};

function normalize(raw: unknown, exclude: Set<string>): GenItem[] {
  if (!raw || typeof raw !== "object") return [];
  const arr = (raw as { menuItems?: unknown }).menuItems;
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>(exclude);
  const out: GenItem[] = [];
  for (const it of arr) {
    if (!it || typeof it !== "object") continue;
    const name = String((it as { name?: unknown }).name ?? "").trim();
    const calories = clampInt((it as { calories?: unknown }).calories, 3000);
    if (!name || name.length > 120 || calories == null || calories <= 0) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const tipRaw = (it as { orderingTip?: unknown }).orderingTip;
    const tip = typeof tipRaw === "string" && tipRaw.trim() ? tipRaw.trim().slice(0, 240) : null;
    out.push({
      name,
      calories,
      proteinG: clampMacro((it as { proteinG?: unknown }).proteinG),
      carbsG: clampMacro((it as { carbsG?: unknown }).carbsG),
      fatG: clampMacro((it as { fatG?: unknown }).fatG),
      satFatG: clampMacro((it as { satFatG?: unknown }).satFatG),
      fiberG: clampMacro((it as { fiberG?: unknown }).fiberG),
      sugarG: clampMacro((it as { sugarG?: unknown }).sugarG),
      sodiumMg: clampInt((it as { sodiumMg?: unknown }).sodiumMg, 10000),
      cholesterolMg: clampInt((it as { cholesterolMg?: unknown }).cholesterolMg, 3000),
      isHealthyPick: (it as { isHealthyPick?: unknown }).isHealthyPick === true,
      orderingTip: (it as { isHealthyPick?: unknown }).isHealthyPick === true ? tip : null,
    });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

async function generate(name: string, cuisine: string, exclude: string[]): Promise<GenItem[]> {
  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Restaurant: ${name}\nCuisine: ${cuisine}\nExclude these already-listed items: ${JSON.stringify(exclude)}`,
      },
    ],
    response_format: { type: "json_object" },
  });
  const rawText = completion.choices[0]?.message?.content ?? "";
  const json = extractJson(rawText);
  if (!json) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  return normalize(parsed, new Set(exclude.map((e) => e.toLowerCase())));
}

function emit(cp: Checkpoint): void {
  const entries = Object.entries(cp).filter(([, items]) => items.length > 0);
  const body = entries
    .map(([restaurant, items]) => {
      const lines = items
        .map(
          (i) =>
            `      { name: ${JSON.stringify(i.name)}, calories: ${i.calories}, proteinG: ${i.proteinG}, carbsG: ${i.carbsG}, fatG: ${i.fatG}, satFatG: ${i.satFatG}, fiberG: ${i.fiberG}, sugarG: ${i.sugarG}, sodiumMg: ${i.sodiumMg}, cholesterolMg: ${i.cholesterolMg}, isHealthyPick: ${i.isHealthyPick}, orderingTip: ${JSON.stringify(i.orderingTip)} },`,
        )
        .join("\n");
      return `  {\n    restaurant: ${JSON.stringify(restaurant)},\n    items: [\n${lines}\n    ],\n  },`;
    })
    .join("\n");
  const file = `// AUTO-GENERATED by scripts/src/gen-menus.ts — do not edit by hand.
// Comprehensive curated restaurant menus: real popular items with estimated
// nutrition. Merged into RESTAURANT_SEED by seed-data.ts. Regenerate with:
//   pnpm --filter @workspace/scripts run gen-menus

export type RestaurantMenuExtraItem = {
  name: string;
  calories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  satFatG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
  cholesterolMg: number | null;
  isHealthyPick: boolean;
  orderingTip: string | null;
};

export const RESTAURANT_MENU_EXTRA: { restaurant: string; items: RestaurantMenuExtraItem[] }[] = [
${body}
];
`;
  writeFileSync(OUT, file, "utf8");
  const total = entries.reduce((n, [, items]) => n + items.length, 0);
  console.log(`Emitted ${OUT} — ${entries.length} restaurants, ${total} items.`);
}

async function main(): Promise<void> {
  const cp: Checkpoint = existsSync(CHECKPOINT)
    ? (JSON.parse(readFileSync(CHECKPOINT, "utf8")) as Checkpoint)
    : {};

  if (process.env.GEN_EMIT_ONLY === "1") {
    emit(cp);
    return;
  }

  const restaurants = await db
    .select({ id: restaurantsTable.id, name: restaurantsTable.name, cuisine: restaurantsTable.cuisine })
    .from(restaurantsTable)
    .where(isNull(restaurantsTable.ownerUserId))
    .orderBy(asc(restaurantsTable.name));

  const limit = process.env.GEN_LIMIT ? parseInt(process.env.GEN_LIMIT, 10) : Infinity;
  let processed = 0;

  for (const r of restaurants) {
    if (cp[r.name] && cp[r.name].length > 0) {
      console.log(`skip (done): ${r.name} (${cp[r.name].length})`);
      continue;
    }
    if (processed >= limit) break;
    const existingRows = await db
      .select({ name: menuItemsTable.name })
      .from(menuItemsTable)
      .where(eq(menuItemsTable.restaurantId, r.id));
    const exclude = existingRows.map((x) => x.name);
    const t0 = Date.now();
    try {
      const items = await generate(r.name, r.cuisine, exclude);
      cp[r.name] = items;
      writeFileSync(CHECKPOINT, JSON.stringify(cp, null, 2), "utf8");
      console.log(
        `ok: ${r.name} → ${items.length} items (${items.filter((i) => i.isHealthyPick).length} picks) in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
      );
    } catch (err) {
      console.error(`FAIL: ${r.name}:`, err instanceof Error ? err.message : err);
    }
    processed++;
  }

  emit(cp);
  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
