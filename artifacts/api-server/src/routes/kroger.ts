import { Router, type IRouter, type Request, type Response } from "express";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, krogerTokensTable } from "@workspace/db";
import { userIdOf } from "../middlewares/auth";
import { todayET } from "../lib/dates";

const router: IRouter = Router();

/*
 * Kroger Public API (developer.kroger.com) — free tier, per-member OAuth so
 * items land in the member's OWN Kroger-family cart (Kroger, Ralphs, Fred
 * Meyer, King Soopers, Smith's, Fry's, Harris Teeter, QFC, Dillons, ...).
 * The cart API is write-only: we add items; members review quantities,
 * substitutions, and checkout on kroger.com.
 *
 * Config: KROGER_CLIENT_ID + KROGER_CLIENT_SECRET (Replit secrets), and the
 * redirect URI registered in the Kroger developer portal. In development the
 * redirect defaults to https://$REPLIT_DEV_DOMAIN/api/kroger/callback; in
 * production set KROGER_REDIRECT_URI (https://<app-domain>/api/kroger/callback)
 * in deployment secrets. Without config, /kroger/status reports enabled=false
 * and both apps hide the Kroger buttons.
 */
const KROGER_AUTH_URL = "https://api.kroger.com/v1/connect/oauth2/authorize";
const KROGER_TOKEN_URL = "https://api.kroger.com/v1/connect/oauth2/token";
const KROGER_API_URL = "https://api.kroger.com/v1";
const KROGER_SCOPES = "product.compact cart.basic:write";
const KROGER_TIMEOUT_MS = 10_000;
const STATE_TTL_MS = 10 * 60_000;
const MAX_CART_SENDS_PER_DAY = 30;
const SEARCH_CONCURRENCY = 4;
const KROGER_CART_URL = "https://www.kroger.com/cart";

function clientId(): string | undefined {
  return process.env.KROGER_CLIENT_ID;
}

function clientSecret(): string | undefined {
  return process.env.KROGER_CLIENT_SECRET;
}

function redirectUri(): string | undefined {
  if (process.env.KROGER_REDIRECT_URI) return process.env.KROGER_REDIRECT_URI;
  const dev = process.env.REPLIT_DEV_DOMAIN;
  return dev ? `https://${dev}/api/kroger/callback` : undefined;
}

export function krogerConfigured(): boolean {
  return Boolean(clientId() && clientSecret() && redirectUri() && process.env.SESSION_SECRET);
}

/* ---------- Signed state ----------
 * The OAuth callback arrives in a bare browser (on mobile it is the system
 * browser with no app session at all), so the member's identity travels
 * inside an HMAC-signed, expiring state token instead of a cookie. */

interface StatePayload {
  u: string;
  p: "web" | "mobile";
  e: number;
  /** One-time-use nonce (jti). */
  j: string;
}

function signState(payload: StatePayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", process.env.SESSION_SECRET as string)
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

function verifyState(state: string): StatePayload | null {
  const dot = state.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = createHmac("sha256", process.env.SESSION_SECRET as string)
    .update(body)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString()) as Partial<StatePayload>;
    if (typeof parsed.u !== "string") return null;
    if (parsed.p !== "web" && parsed.p !== "mobile") return null;
    if (typeof parsed.e !== "number" || parsed.e < Date.now()) return null;
    if (typeof parsed.j !== "string" || parsed.j.length < 8) return null;
    return parsed as StatePayload;
  } catch {
    return null;
  }
}

/* One-time use: a verified state may complete the callback only once, so a
 * leaked/replayed link is dead after first use (defense-in-depth on top of the
 * HMAC + 10-minute expiry; Kroger's auth code is single-use anyway). In-memory
 * is fine — the app deploys as a single always-on VM and states are ephemeral. */
const usedStates = new Map<string, number>(); // jti -> state expiry
function stateAlreadyUsed(state: StatePayload): boolean {
  if (usedStates.size > 1_000) {
    const now = Date.now();
    for (const [jti, exp] of usedStates) {
      if (exp < now) usedStates.delete(jti);
    }
  }
  if (usedStates.has(state.j)) return true;
  usedStates.set(state.j, state.e);
  return false;
}

/* ---------- Kroger HTTP plumbing ---------- */

async function krogerFetch(url: string, init: RequestInit): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), KROGER_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

interface TokenGrant {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/** "denied" = Kroger rejected the grant itself (revoked/expired/invalid) — the
 * stored tokens are dead. "unavailable" = transient trouble (network, timeout,
 * 5xx, rate limit) — do NOT touch stored tokens. */
async function exchangeToken(
  params: Record<string, string>,
): Promise<TokenGrant | "denied" | "unavailable"> {
  const basic = Buffer.from(`${clientId()}:${clientSecret()}`).toString("base64");
  try {
    const resp = await krogerFetch(KROGER_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params).toString(),
    });
    if (!resp.ok) return resp.status === 400 || resp.status === 401 ? "denied" : "unavailable";
    const data = (await resp.json()) as Partial<TokenGrant>;
    if (!data.access_token || !data.refresh_token || !data.expires_in) return "unavailable";
    return data as TokenGrant;
  } catch {
    return "unavailable";
  }
}

async function saveGrant(userId: string, grant: TokenGrant): Promise<void> {
  const set = {
    accessToken: grant.access_token,
    refreshToken: grant.refresh_token,
    expiresAt: new Date(Date.now() + grant.expires_in * 1000),
    updatedAt: new Date(),
  };
  await db
    .insert(krogerTokensTable)
    .values({ userId, ...set })
    .onConflictDoUpdate({ target: krogerTokensTable.userId, set });
}

type FreshToken = { kind: "ok"; token: string } | { kind: "reconnect" } | { kind: "unavailable" };

async function currentTokenRow(userId: string) {
  const [row] = await db
    .select()
    .from(krogerTokensTable)
    .where(eq(krogerTokensTable.userId, userId))
    .limit(1);
  return row;
}

/* Refreshes are serialized per user in-process AND compare-and-swapped against
 * the refresh token they started from, so a request that loses the race can
 * never delete or overwrite tokens a parallel request just rotated. */
const refreshInflight = new Map<string, Promise<FreshToken>>();

/** Valid access token for the member, refreshing when stale.
 * reconnect = not connected / grant revoked; unavailable = Kroger unreachable. */
async function freshAccessToken(userId: string): Promise<FreshToken> {
  const inflight = refreshInflight.get(userId);
  if (inflight) return inflight;
  const task = (async (): Promise<FreshToken> => {
    const row = await currentTokenRow(userId);
    if (!row) return { kind: "reconnect" };
    if (row.expiresAt.getTime() > Date.now() + 60_000) {
      return { kind: "ok", token: row.accessToken };
    }
    const grant = await exchangeToken({
      grant_type: "refresh_token",
      refresh_token: row.refreshToken,
    });
    if (grant === "unavailable") return { kind: "unavailable" };
    if (grant === "denied") {
      // Drop the row ONLY if it still holds the refresh token Kroger denied —
      // a parallel request may have rotated it successfully already.
      await db
        .delete(krogerTokensTable)
        .where(
          and(
            eq(krogerTokensTable.userId, userId),
            eq(krogerTokensTable.refreshToken, row.refreshToken),
          ),
        );
      const survivor = await currentTokenRow(userId);
      return survivor ? { kind: "ok", token: survivor.accessToken } : { kind: "reconnect" };
    }
    const updated = await db
      .update(krogerTokensTable)
      .set({
        accessToken: grant.access_token,
        refreshToken: grant.refresh_token,
        expiresAt: new Date(Date.now() + grant.expires_in * 1000),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(krogerTokensTable.userId, userId),
          eq(krogerTokensTable.refreshToken, row.refreshToken),
        ),
      )
      .returning({ id: krogerTokensTable.id });
    if (updated.length === 0) {
      // Lost the race to a parallel refresh — use whatever it saved.
      const winner = await currentTokenRow(userId);
      return winner ? { kind: "ok", token: winner.accessToken } : { kind: "reconnect" };
    }
    return { kind: "ok", token: grant.access_token };
  })();
  refreshInflight.set(userId, task);
  try {
    return await task;
  } finally {
    refreshInflight.delete(userId);
  }
}

async function mapLimit<T, R>(arr: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array<R>(arr.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, arr.length) }, async () => {
    for (;;) {
      const idx = next++;
      if (idx >= arr.length) return;
      out[idx] = await fn(arr[idx] as T);
    }
  });
  await Promise.all(workers);
  return out;
}

type UpcLookup = { upc: string | null } | "auth" | "down";

/** Best product match for a shopping-list line. { upc: null } = Kroger truly
 * has nothing; "auth" = token rejected (drive reconnect); "down" = transient
 * upstream trouble (must never be misreported as "not found"). */
async function findUpc(token: string, name: string): Promise<UpcLookup> {
  try {
    const resp = await krogerFetch(
      `${KROGER_API_URL}/products?filter.term=${encodeURIComponent(name)}&filter.limit=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (resp.status === 401 || resp.status === 403) return "auth";
    if (!resp.ok) return "down";
    const data = (await resp.json()) as { data?: Array<{ upc?: string; productId?: string }> };
    return { upc: data.data?.[0]?.upc ?? data.data?.[0]?.productId ?? null };
  } catch {
    return "down";
  }
}

/* ---------- Routes (mounted with requireAuth + requireActiveSubscription) ---------- */

router.get("/kroger/status", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  const [row] = await db
    .select({ id: krogerTokensTable.id })
    .from(krogerTokensTable)
    .where(eq(krogerTokensTable.userId, userId))
    .limit(1);
  res.json({ enabled: krogerConfigured(), connected: Boolean(row) });
});

router.get("/kroger/connect-url", (req, res): void => {
  const userId = userIdOf(res);
  if (!krogerConfigured()) {
    res.status(503).json({ error: "Kroger shopping isn't set up yet." });
    return;
  }
  const platform = req.query["platform"] === "mobile" ? "mobile" : "web";
  const state = signState({
    u: userId,
    p: platform,
    e: Date.now() + STATE_TTL_MS,
    j: randomBytes(12).toString("base64url"),
  });
  const params = new URLSearchParams({
    scope: KROGER_SCOPES,
    response_type: "code",
    client_id: clientId() as string,
    redirect_uri: redirectUri() as string,
    state,
  });
  res.json({ url: `${KROGER_AUTH_URL}?${params.toString()}` });
});

const cartInput = z.object({
  items: z
    .array(z.object({ name: z.string().trim().min(1).max(120) }))
    .min(1)
    .max(60),
});

const cartRate = new Map<string, { date: string; count: number }>();

router.post("/kroger/cart", async (req, res): Promise<void> => {
  const userId = userIdOf(res);
  if (!krogerConfigured()) {
    res.status(503).json({ error: "Kroger shopping isn't set up yet." });
    return;
  }
  const parsed = cartInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid items." });
    return;
  }
  const today = todayET();
  const rate = cartRate.get(userId);
  const count = rate?.date === today ? rate.count : 0;
  if (count >= MAX_CART_SENDS_PER_DAY) {
    res.status(429).json({ error: "That's a lot of shopping for one day — try again tomorrow." });
    return;
  }
  const fresh = await freshAccessToken(userId);
  if (fresh.kind === "unavailable") {
    res.status(503).json({ error: "Couldn't reach Kroger. Please try again." });
    return;
  }
  if (fresh.kind === "reconnect") {
    res.status(409).json({ error: "Connect your Kroger account first." });
    return;
  }
  const token = fresh.token;

  const names = parsed.data.items.map((i) => i.name);
  let searchAuthFailed = false;
  const lookups = await mapLimit(names, SEARCH_CONCURRENCY, async (n): Promise<UpcLookup> => {
    if (searchAuthFailed) return "auth"; // stop burning calls once the token is dead
    const result = await findUpc(token, n);
    if (result === "auth") searchAuthFailed = true;
    return result;
  });
  if (searchAuthFailed) {
    // Token rejected mid-search — clear it (only if unrotated) and flip clients to "Connect".
    await db
      .delete(krogerTokensTable)
      .where(and(eq(krogerTokensTable.userId, userId), eq(krogerTokensTable.accessToken, token)));
    res.status(409).json({ error: "Your Kroger connection expired — please reconnect." });
    return;
  }
  if (lookups.some((r) => r === "down")) {
    // Transient Kroger trouble — surface it honestly instead of "items not found".
    res.status(503).json({ error: "Couldn't reach Kroger. Please try again." });
    return;
  }
  const found: { upc: string; name: string }[] = [];
  const missed: string[] = [];
  names.forEach((n, i) => {
    const result = lookups[i];
    const upc = typeof result === "object" && result !== null ? result.upc : null;
    if (upc) found.push({ upc, name: n });
    else missed.push(n);
  });

  if (found.length > 0) {
    try {
      const resp = await krogerFetch(`${KROGER_API_URL}/cart/add`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ items: found.map((f) => ({ upc: f.upc, quantity: 1 })) }),
      });
      if (resp.status === 401 || resp.status === 403) {
        await db
          .delete(krogerTokensTable)
          .where(
            and(eq(krogerTokensTable.userId, userId), eq(krogerTokensTable.accessToken, token)),
          );
        res.status(409).json({ error: "Your Kroger connection expired — please reconnect." });
        return;
      }
      if (!resp.ok) {
        req.log.error({ status: resp.status }, "kroger cart add failed");
        res.status(503).json({ error: "Couldn't reach Kroger. Please try again." });
        return;
      }
    } catch (err) {
      req.log.error({ err, aborted: true }, "kroger cart add error");
      res.status(503).json({ error: "Couldn't reach Kroger. Please try again." });
      return;
    }
  }

  cartRate.set(userId, { date: today, count: count + 1 });
  res.json({ added: found.map((f) => f.name), missed, cartUrl: KROGER_CART_URL });
});

/* ---------- Public OAuth callback (mounted WITHOUT auth in routes/index.ts) ---------- */

function mobileHtml(ok: boolean): string {
  const title = ok ? "Kroger connected" : "Connection didn't go through";
  const body = ok
    ? "You're all set. Close this window and return to the LUXE app to send your list."
    : "The link may have expired. Please return to the LUXE app and tap Connect Kroger again.";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head><body style="margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#0F1729;color:#F8F5F0;font-family:Georgia,serif;text-align:center"><div style="padding:32px;max-width:420px"><p style="font-size:44px;margin:0 0 12px">${ok ? "✓" : "✕"}</p><h1 style="font-size:24px;font-weight:600;margin:0 0 10px">${title}</h1><p style="font-size:15px;line-height:1.5;opacity:.75;margin:0">${body}</p></div></body></html>`;
}

export async function krogerCallback(req: Request, res: Response): Promise<void> {
  const rawState = typeof req.query["state"] === "string" ? req.query["state"] : "";
  const state = rawState ? verifyState(rawState) : null;
  if (!state) {
    // Unknown platform — a neutral page covers both.
    res.status(400).send(mobileHtml(false));
    return;
  }
  const fail = (): void => {
    if (state.p === "web") res.redirect("/meal-plan?kroger=error");
    else res.status(200).send(mobileHtml(false));
  };
  if (stateAlreadyUsed(state)) {
    // One-time use: a replayed (or refreshed) callback link must start over.
    fail();
    return;
  }
  const code = typeof req.query["code"] === "string" ? req.query["code"] : null;
  if (!code || !krogerConfigured()) {
    // Includes the member tapping "deny" on Kroger's consent screen.
    fail();
    return;
  }
  try {
    const grant = await exchangeToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri() as string,
    });
    if (typeof grant === "string") {
      req.log.error({ reason: grant }, "kroger code exchange failed");
      fail();
      return;
    }
    await saveGrant(state.u, grant);
  } catch (err) {
    req.log.error({ err }, "kroger callback error");
    fail();
    return;
  }
  if (state.p === "web") res.redirect("/meal-plan?kroger=connected");
  else res.send(mobileHtml(true));
}

export default router;
