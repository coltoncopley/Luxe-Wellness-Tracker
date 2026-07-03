---
name: Express router.use middleware scoping
description: Unscoped middleware in router.use(mw, subRouter) runs for ALL fall-through requests, not just the sub-router's paths — role gates must be path-scoped.
---

# Express middleware scoping pitfall

**Rule:** Never mount a role/permission gate inline with a root-mounted sub-router, e.g. `router.use(requireRoleX, featureRouter)`. In Express, `router.use()` without a path mounts at `/`, so the middleware runs for **every** request that falls through to that layer — including requests destined for routers mounted later.

**Why:** This silently broke the entire admin router: `requirePatient` mounted inline before the admin mount rejected every staff/admin request to `/api/admin/*` with 403 ("not letting me create codes"), while patients were unaffected. The bug only bites the roles the gate excludes, so it hides until a staff/admin user touches a later-mounted route.

**How to apply:** Scope role gates to explicit path prefixes: `router.use(["/passport", "/mind", ...], requireAuth, requirePatient)` and mount the feature routers separately without the inline gate. Role-neutral middleware whose logic exempts other roles internally (like the subscription gate exempting staff) can stay unscoped, but it's still a footgun — prefer path scoping when adding new gated mounts. When debugging mystery 403s where the DB role looks correct, suspect an earlier unscoped gate in the mount chain, and check which middleware produced the error body.
