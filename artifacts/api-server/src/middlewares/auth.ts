import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

const knownUserIds = new Set<string>();

async function ensureUserRow(userId: string): Promise<void> {
  if (knownUserIds.has(userId)) return;
  let email: string | null = null;
  let firstName: string | null = null;
  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    email = clerkUser.primaryEmailAddress?.emailAddress ?? null;
    firstName = clerkUser.firstName ?? null;
  } catch {
    // Profile enrichment is best-effort; the row still gets created.
  }
  await db
    .insert(usersTable)
    .values({ id: userId, email, firstName })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: { email, firstName },
    });
  knownUserIds.add(userId);
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  try {
    await ensureUserRow(userId);
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
