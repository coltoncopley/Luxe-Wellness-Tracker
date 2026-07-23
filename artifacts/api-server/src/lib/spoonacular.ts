import { z } from "zod/v4";

/**
 * Spoonacular chain-restaurant menu lookup. Lets patients search REAL published
 * nutrition for 800+ national/regional chains, complementing the curated local
 * restaurants and the AI-generated custom ones.
 *
 * Free-tier discipline (Spoonacular ~150 points/day, cache max 1h per ToS):
 *  - In-memory caches (search keyed by lowercased query, item keyed by id), TTL 1h.
 *  - Global daily call budget (ET reset) that soft-fails BEFORE Spoonacular 429s us.
 *  - Per-user rate limit lives in the route layer.
 * Upstream JSON is untrusted: Zod-validated, numbers clamped, strings sanitized,
 * arrays capped. Errors surface as a typed error the route maps to a coarse 503.
 * The API key is read from env per call and never logged.
 */

const BASE_URL = "https://api.spoonacular.com";
const FETCH_TIMEOUT_MS = 8000;
const SEARCH_RESULT_CAP = 25;

const SEARCH_TTL_MS = 60 * 60 * 1000; // 1h — Spoonacular ToS caps caching at 1h
const ITEM_TTL_MS = 60 * 60 * 1000;
const SEARCH_CACHE_MAX = 500;
const ITEM_CACHE_MAX = 1000;
const DAILY_CALL_BUDGET = 140; // stay comfortably under the ~150/day free tier

export type ChainMenuUnavailableReason = "no_key" | "budget" | "timeout" | "upstream";

export class ChainMenuUnavailableError extends Error {
  constructor(public readonly reason: ChainMenuUnavailableReason) {
    super(`chain menu unavailable: ${reason}`);
    this.name = "ChainMenuUnavailableError";
  }
}

export interface ChainSearchItem {
  id: number;
  name: string;
  restaurantName: string;
  imageUrl: string | null;
}

export interface ChainItemDetail {
  id: number;
  name: string;
  restaurantName: string | null;
  calories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  satFatG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
  cholesterolMg: number | null;
  servingSize: string | null;
}

const clampInt = (n: number, max: number) => Math.min(Math.max(0, Math.round(n)), max);
const clampMacro = (n: number) => Math.min(Math.max(0, Math.round(n * 10) / 10), 500);
const macroOrNull = (n: number | null) => (n == null ? null : clampMacro(n));
const intOrNull = (n: number | null, max: number) => (n == null ? null : clampInt(n, max));

const cleanText = (s: string): string =>
  s
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

const safeHttpsUrl = (u: string | null | undefined): string | null =>
  typeof u === "string" && /^https:\/\/\S+$/i.test(u) ? u : null;

// --- Caches -----------------------------------------------------------------

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

function readCache<K, T>(cache: Map<K, CacheEntry<T>>, key: K): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache<K, T>(cache: Map<K, CacheEntry<T>>, key: K, value: T, ttl: number, max: number) {
  cache.set(key, { value, expiresAt: Date.now() + ttl });
  while (cache.size > max) {
    const oldest = cache.keys().next().value as K | undefined;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

const searchCache = new Map<string, CacheEntry<ChainSearchItem[]>>();
const itemCache = new Map<number, CacheEntry<ChainItemDetail>>();

// --- Daily budget -----------------------------------------------------------

let budget = { count: 0, dayKey: "" };

function etDayKey(): string {
  // en-CA gives YYYY-MM-DD; anchor to Eastern Time so the reset matches the app's schedulers.
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

/** Reserve one budget slot for a real upstream call (cache hits never call this). */
function reserveBudgetSlot(): void {
  const day = etDayKey();
  if (budget.dayKey !== day) budget = { count: 0, dayKey: day };
  if (budget.count >= DAILY_CALL_BUDGET) throw new ChainMenuUnavailableError("budget");
  budget.count += 1;
}

// --- Fetch ------------------------------------------------------------------

async function spoonFetch(path: string): Promise<unknown> {
  const key = process.env.SPOONACULAR_API_KEY;
  if (!key) throw new ChainMenuUnavailableError("no_key");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "x-api-key": key, accept: "application/json" },
      signal: controller.signal,
    });
    if (res.status === 404) {
      // Distinguish not-found from generic upstream errors for the item route.
      const notFound = new Error("not_found");
      notFound.name = "SpoonacularNotFound";
      throw notFound;
    }
    if (!res.ok) throw new ChainMenuUnavailableError("upstream");
    return (await res.json()) as unknown;
  } catch (e) {
    if (e instanceof ChainMenuUnavailableError) throw e;
    if (e instanceof Error && e.name === "SpoonacularNotFound") throw e;
    // Node's fetch abort throws a DOMException (not always instanceof Error);
    // check the signal directly so timeouts are classified correctly.
    if (controller.signal.aborted) throw new ChainMenuUnavailableError("timeout");
    throw new ChainMenuUnavailableError("upstream");
  } finally {
    clearTimeout(timer);
  }
}

// --- Upstream schemas (untrusted) ------------------------------------------

const upstreamSearchSchema = z.object({
  menuItems: z
    .array(
      z.object({
        id: z.number(),
        title: z.string(),
        restaurantChain: z.string().nullish(),
        image: z.string().nullish(),
      }),
    )
    .nullish(),
});

const upstreamItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  restaurantChain: z.string().nullish(),
  servingSize: z.string().nullish(),
  nutrition: z
    .object({
      nutrients: z
        .array(
          z.object({
            name: z.string(),
            amount: z.number(),
            unit: z.string().nullish(),
          }),
        )
        .nullish(),
    })
    .nullish(),
});

// --- Public API -------------------------------------------------------------

export async function searchChainMenuItems(qRaw: string): Promise<ChainSearchItem[]> {
  const q = qRaw.trim().toLowerCase().slice(0, 80);
  if (q.length < 2) return [];

  const cached = readCache(searchCache, q);
  if (cached) return cached;

  reserveBudgetSlot();
  const raw = await spoonFetch(
    `/food/menuItems/search?query=${encodeURIComponent(q)}&number=${SEARCH_RESULT_CAP}`,
  );
  const parsed = upstreamSearchSchema.safeParse(raw);
  if (!parsed.success) throw new ChainMenuUnavailableError("upstream");

  const items: ChainSearchItem[] = (parsed.data.menuItems ?? [])
    .slice(0, SEARCH_RESULT_CAP)
    .map((m) => ({
      id: m.id,
      name: cleanText(m.title).slice(0, 160) || "Menu item",
      restaurantName:
        (m.restaurantChain ? cleanText(m.restaurantChain).slice(0, 80) : "") || "Restaurant",
      imageUrl: safeHttpsUrl(m.image),
    }))
    .filter((m) => Number.isInteger(m.id) && m.id > 0);

  writeCache(searchCache, q, items, SEARCH_TTL_MS, SEARCH_CACHE_MAX);
  return items;
}

/** Throws SpoonacularNotFound (Error, name) when the id is unknown. */
export async function getChainMenuItem(id: number): Promise<ChainItemDetail> {
  const cached = readCache(itemCache, id);
  if (cached) return cached;

  reserveBudgetSlot();
  const raw = await spoonFetch(`/food/menuItems/${id}`);
  const parsed = upstreamItemSchema.safeParse(raw);
  if (!parsed.success) throw new ChainMenuUnavailableError("upstream");

  const byName = new Map<string, number>();
  for (const n of parsed.data.nutrition?.nutrients ?? []) {
    if (Number.isFinite(n.amount)) byName.set(n.name.toLowerCase(), n.amount);
  }
  const nutrient = (name: string): number | null => {
    const v = byName.get(name);
    return v == null || !Number.isFinite(v) ? null : v;
  };

  const detail: ChainItemDetail = {
    id: parsed.data.id,
    name: cleanText(parsed.data.title).slice(0, 160) || "Menu item",
    restaurantName: parsed.data.restaurantChain
      ? cleanText(parsed.data.restaurantChain).slice(0, 80) || null
      : null,
    calories: clampInt(nutrient("calories") ?? 0, 5000),
    proteinG: macroOrNull(nutrient("protein")),
    carbsG: macroOrNull(nutrient("carbohydrates")),
    fatG: macroOrNull(nutrient("fat")),
    satFatG: macroOrNull(nutrient("saturated fat")),
    fiberG: macroOrNull(nutrient("fiber")),
    sugarG: macroOrNull(nutrient("sugar")),
    sodiumMg: intOrNull(nutrient("sodium"), 8000),
    cholesterolMg: intOrNull(nutrient("cholesterol"), 1500),
    servingSize: parsed.data.servingSize ? cleanText(parsed.data.servingSize).slice(0, 60) || null : null,
  };

  writeCache(itemCache, id, detail, ITEM_TTL_MS, ITEM_CACHE_MAX);
  return detail;
}
