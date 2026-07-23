import { z } from "zod/v4";

/**
 * Open Food Facts barcode lookup. Lets patients scan a packaged food's UPC/EAN
 * and log real label nutrition. OFF is free/open (no API key), but we stay
 * polite: descriptive User-Agent (their policy), 24h in-memory cache, and a
 * per-user rate limit in the route layer.
 *
 * Upstream JSON is untrusted: Zod-validated, numbers clamped, strings
 * sanitized, image https-only. Nutrition basis: per labeled serving when the
 * product has per-serving calories, else per 100 g (flagged via `perServing`).
 * OFF reports sodium/salt in GRAMS — converted to mg here.
 */

const BASE_URL = "https://world.openfoodfacts.org";
const FETCH_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 2000;
const USER_AGENT = "LuxeWellnessApp/1.0 (https://luxewellnessapp.com)";

export type BarcodeUnavailableReason = "timeout" | "upstream";

export class BarcodeUnavailableError extends Error {
  constructor(public readonly reason: BarcodeUnavailableReason) {
    super(`barcode lookup unavailable: ${reason}`);
    this.name = "BarcodeUnavailableError";
  }
}

/** Thrown when the barcode isn't in the database (route maps to 404). */
export class BarcodeNotFoundError extends Error {
  constructor() {
    super("barcode product not found");
    this.name = "BarcodeNotFoundError";
  }
}

export interface BarcodeProductDetail {
  barcode: string;
  name: string;
  brand: string | null;
  servingSize: string | null;
  perServing: boolean;
  calories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  satFatG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
  imageUrl: string | null;
}

const clampInt = (n: number, max: number) => Math.min(Math.max(0, Math.round(n)), max);
const clampMacro = (n: number) => Math.min(Math.max(0, Math.round(n * 10) / 10), 500);

const cleanText = (s: string): string =>
  s
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

const safeHttpsUrl = (u: string | null | undefined): string | null =>
  typeof u === "string" && /^https:\/\/\S+$/i.test(u) ? u : null;

// --- Cache -------------------------------------------------------------------

interface CacheEntry {
  value: BarcodeProductDetail;
  expiresAt: number;
}

const productCache = new Map<string, CacheEntry>();

function readCache(key: string): BarcodeProductDetail | null {
  const entry = productCache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    productCache.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache(key: string, value: BarcodeProductDetail) {
  productCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  while (productCache.size > CACHE_MAX) {
    const oldest = productCache.keys().next().value;
    if (oldest === undefined) break;
    productCache.delete(oldest);
  }
}

// --- Fetch ---------------------------------------------------------------------

const FIELDS = "product_name,brands,serving_size,nutriments,image_front_url";

/** Returns parsed JSON, or null when OFF says the code isn't in the database. */
async function offFetch(code: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${BASE_URL}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`,
      {
        headers: { "user-agent": USER_AGENT, accept: "application/json" },
        signal: controller.signal,
      },
    );
    // OFF returns HTTP 404 with a JSON body ({status: 0}) for unknown codes.
    if (res.status === 404) return null;
    if (!res.ok) throw new BarcodeUnavailableError("upstream");
    const body = (await res.json()) as unknown;
    if (
      typeof body === "object" &&
      body !== null &&
      "status" in body &&
      (body as { status?: unknown }).status === 0
    ) {
      return null;
    }
    return body;
  } catch (e) {
    if (e instanceof BarcodeUnavailableError) throw e;
    // Node's fetch abort throws a DOMException (not always instanceof Error);
    // check the signal directly so timeouts are classified correctly.
    if (controller.signal.aborted) throw new BarcodeUnavailableError("timeout");
    throw new BarcodeUnavailableError("upstream");
  } finally {
    clearTimeout(timer);
  }
}

// --- Upstream schema (untrusted) ----------------------------------------------

const upstreamSchema = z.object({
  product: z.object({
    product_name: z.string().nullish(),
    brands: z.string().nullish(),
    serving_size: z.string().nullish(),
    image_front_url: z.string().nullish(),
    // OFF nutriment values are usually numbers but occasionally numeric strings.
    nutriments: z.record(z.string(), z.unknown()).nullish(),
  }),
});

function num(nutriments: Record<string, unknown>, key: string): number | null {
  const v = nutriments[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const parsed = Number(v);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

// --- Public API -----------------------------------------------------------------

/**
 * Look up a product by barcode. Throws BarcodeNotFoundError when unknown (or
 * known but missing all energy data — nothing loggable), BarcodeUnavailableError
 * on upstream trouble.
 */
export async function getBarcodeProduct(rawCode: string): Promise<BarcodeProductDetail> {
  const code = rawCode.replace(/\D/g, "");
  if (code.length < 6 || code.length > 14) throw new BarcodeNotFoundError();

  const cached = readCache(code);
  if (cached) return cached;

  let raw = await offFetch(code);
  // US UPC-A (12 digits) is often stored as EAN-13 with a leading zero.
  if (raw === null && code.length === 12) {
    raw = await offFetch(`0${code}`);
  }
  if (raw === null) throw new BarcodeNotFoundError();

  const parsed = upstreamSchema.safeParse(raw);
  if (!parsed.success) throw new BarcodeUnavailableError("upstream");

  const p = parsed.data.product;
  const n = p.nutriments ?? {};

  // Prefer per-serving values (matches the label); fall back to per-100g.
  const kcalServing = num(n, "energy-kcal_serving");
  const kcal100 = num(n, "energy-kcal_100g");
  // Last resort: energy_* is in kJ.
  const kjServing = num(n, "energy_serving");
  const kj100 = num(n, "energy_100g");

  let perServing: boolean;
  let calories: number;
  if (kcalServing != null) {
    perServing = true;
    calories = kcalServing;
  } else if (kcal100 != null) {
    perServing = false;
    calories = kcal100;
  } else if (kjServing != null) {
    perServing = true;
    calories = kjServing / 4.184;
  } else if (kj100 != null) {
    perServing = false;
    calories = kj100 / 4.184;
  } else {
    // A product with no energy data at all isn't loggable.
    throw new BarcodeNotFoundError();
  }

  const suffix = perServing ? "_serving" : "_100g";
  const macro = (base: string): number | null => {
    const v = num(n, `${base}${suffix}`);
    return v == null ? null : clampMacro(v);
  };

  // OFF sodium/salt are in grams; salt ≈ sodium × 2.5. Crowd-sourced entries
  // sometimes hold mg in the grams field — drop implausible values (>8 g
  // sodium) instead of clamping to a wrong-but-plausible number.
  const sodiumG = num(n, `sodium${suffix}`);
  const saltG = num(n, `salt${suffix}`);
  const sodiumMgRaw =
    sodiumG != null ? sodiumG * 1000 : saltG != null ? (saltG / 2.5) * 1000 : null;
  const sodiumMg =
    sodiumMgRaw != null && sodiumMgRaw <= 8000 ? clampInt(sodiumMgRaw, 8000) : null;

  const servingSizeRaw = p.serving_size ? cleanText(p.serving_size).slice(0, 60) : "";

  const detail: BarcodeProductDetail = {
    barcode: code,
    name: (p.product_name ? cleanText(p.product_name).slice(0, 160) : "") || "Packaged food",
    brand: (p.brands ? cleanText(p.brands).slice(0, 80) : "") || null,
    servingSize: perServing ? servingSizeRaw || null : "100 g",
    perServing,
    calories: clampInt(calories, 5000),
    proteinG: macro("proteins"),
    carbsG: macro("carbohydrates"),
    fatG: macro("fat"),
    satFatG: macro("saturated-fat"),
    fiberG: macro("fiber"),
    sugarG: macro("sugars"),
    sodiumMg,
    imageUrl: safeHttpsUrl(p.image_front_url),
  };

  writeCache(code, detail);
  return detail;
}
