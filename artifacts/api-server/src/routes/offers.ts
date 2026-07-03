import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";
import { and, asc, eq, gt } from "drizzle-orm";
import { db, offersTable, offerClaimsTable } from "@workspace/db";
import { ListOffersResponse, ClaimOfferResponse } from "@workspace/api-zod";
import { requirePatient } from "../middlewares/auth";

const router: IRouter = Router();

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateClaimCode(): string {
  const bytes = crypto.randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
    if (i === 3) s += "-";
  }
  return `OFR-${s}`;
}

const claimHits = new Map<string, { count: number; windowStart: number }>();
const CLAIM_LIMIT = 10;
const CLAIM_WINDOW_MS = 60_000;

function rateLimitClaims(req: Request, res: Response, next: NextFunction): void {
  const key = `${req.ip ?? "unknown"}:${res.locals.userId ?? ""}`;
  const now = Date.now();
  const entry = claimHits.get(key);
  if (!entry || now - entry.windowStart > CLAIM_WINDOW_MS) {
    if (claimHits.size > 1000) claimHits.clear();
    claimHits.set(key, { count: 1, windowStart: now });
    next();
    return;
  }
  entry.count += 1;
  if (entry.count > CLAIM_LIMIT) {
    res.status(429).json({ error: "Too many attempts — try again in a minute" });
    return;
  }
  next();
}

router.get("/offers", async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const rows = await db
    .select()
    .from(offersTable)
    .where(and(eq(offersTable.active, true), gt(offersTable.endsAt, new Date())))
    .orderBy(asc(offersTable.endsAt));
  const claims =
    rows.length > 0
      ? await db.select().from(offerClaimsTable).where(eq(offerClaimsTable.userId, userId))
      : [];
  const claimByOffer = new Map(claims.map((c) => [c.offerId, c]));
  res.json(
    ListOffersResponse.parse({
      offers: rows.map((o) => {
        const claim = claimByOffer.get(o.id);
        return {
          id: o.id,
          title: o.title,
          description: o.description,
          endsAt: o.endsAt.toISOString(),
          claimed: !!claim,
          claimCode: claim ? claim.code : null,
        };
      }),
    }),
  );
});

router.post(
  "/offers/:id/claim",
  requirePatient,
  rateLimitClaims,
  async (req, res): Promise<void> => {
    const userId = res.locals.userId as string;
    const offerId = Number(req.params.id);
    if (!Number.isInteger(offerId) || offerId <= 0) {
      res.status(404).json({ error: "Offer not found" });
      return;
    }
    const [offer] = await db
      .select()
      .from(offersTable)
      .where(
        and(eq(offersTable.id, offerId), eq(offersTable.active, true), gt(offersTable.endsAt, new Date())),
      );
    if (!offer) {
      res.status(404).json({ error: "Offer not found or no longer active" });
      return;
    }
    const [existing] = await db
      .select()
      .from(offerClaimsTable)
      .where(and(eq(offerClaimsTable.offerId, offerId), eq(offerClaimsTable.userId, userId)));
    if (existing) {
      res.status(409).json(ClaimOfferResponse.parse({ code: existing.code }));
      return;
    }
    // Retry on the (astronomically unlikely) chance of a code collision; the
    // unique (offerId, userId) index makes double-claims race-safe.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const [row] = await db
          .insert(offerClaimsTable)
          .values({ offerId, userId, code: generateClaimCode() })
          .onConflictDoNothing({ target: [offerClaimsTable.offerId, offerClaimsTable.userId] })
          .returning();
        if (!row) {
          const [raced] = await db
            .select()
            .from(offerClaimsTable)
            .where(and(eq(offerClaimsTable.offerId, offerId), eq(offerClaimsTable.userId, userId)));
          if (raced) {
            res.status(409).json(ClaimOfferResponse.parse({ code: raced.code }));
            return;
          }
          continue;
        }
        req.log.info({ userId, offerId }, "offer claimed");
        res.status(201).json(ClaimOfferResponse.parse({ code: row.code }));
        return;
      } catch (err) {
        if (attempt === 2) throw err;
      }
    }
    res.status(500).json({ error: "Could not claim this offer — please try again" });
  },
);

export default router;
