import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { and, eq, ne, sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

const knownUserIds = new Set<string>();

/**
 * Upsert the user row for a Clerk identity. Returns "duplicate_email" when
 * this is a BRAND-NEW identity whose email already belongs to an existing
 * account (e.g. the same person signed up once with Google and once with a
 * password) — in that case no row is created and the request must be
 * rejected so one email maps to exactly one account. Existing rows are
 * never blocked, only refreshed.
 */
async function ensureUserRow(userId: string): Promise<"ok" | "duplicate_email"> {
  if (knownUserIds.has(userId)) return "ok";
  let email: string | null = null;
  let firstName: string | null = null;
  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    email = clerkUser.primaryEmailAddress?.emailAddress ?? null;
    firstName = clerkUser.firstName ?? null;
  } catch {
    // Profile enrichment is best-effort; the row still gets created.
  }
  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!existing && email) {
    const [duplicate] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(
        and(
          ne(usersTable.id, userId),
          sql`lower(${usersTable.email}) = lower(${email})`,
        ),
      )
      .limit(1);
    if (duplicate) return "duplicate_email";
  }
  await db
    .insert(usersTable)
    .values({ id: userId, email, firstName })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: { email, firstName },
    });
  knownUserIds.add(userId);
  return "ok";
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  try {
    const result = await ensureUserRow(userId);
    if (result === "duplicate_email") {
      req.log.warn(
        { blockedUserId: userId },
        "sign-in blocked: email already registered to another account",
      );
      res.status(403).json({ error: "email_already_registered" });
      return;
    }
  } catch (err) {
    next(err);
    return;
  }
  res.locals.userId = userId;
  next();
}

export async function requireStaff(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = res.locals.userId as string | undefined;
  if (!userId) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user || !isStaffRole(user.role)) {
      req.log.warn(
        { staffCheckUserId: userId, rowFound: Boolean(user), rowRole: user?.role ?? null },
        "requireStaff rejected request",
      );
      res.status(403).json({ error: "Staff access required" });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function isStaffRole(role: string): boolean {
  return role === "staff" || role === "admin";
}

export async function requireAdmin(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = res.locals.userId as string | undefined;
  if (!userId) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user || user.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}

export async function requirePatient(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = res.locals.userId as string | undefined;
  if (!userId) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user || user.role !== "patient") {
      res.status(403).json({ error: "This feature is only available to patient accounts" });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function userIdOf(res: Response): string {
  const userId = res.locals.userId as string | undefined;
  if (!userId) throw new Error("userIdOf called without requireAuth");
  return userId;
}

/**
 * Drop a user from the in-memory "already upserted" cache. Called on account
 * deletion so a stale cache entry can never suppress a future upsert (and leave
 * a signed-in user without a row).
 */
export function forgetUser(userId: string): void {
  knownUserIds.delete(userId);
}
