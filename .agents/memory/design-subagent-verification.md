---
name: Design subagent output verification
description: Checks to run after any DESIGN subagent build before presenting to the user
---

**Rule:** After a DESIGN subagent reports completion, always verify: (1) the expected page files actually exist, (2) `pnpm --filter <artifact> run typecheck` passes, (3) grep for literal `\`` / `\${` escapes in generated TSX — subagents sometimes emit escaped template literals that break compilation, and (4) hooks match generated signatures (params objects vs raw strings).

**Why:** In this project a design subagent reported "completed" after building only the theme + one page, and a second run left escaped backticks in multiple files plus a wrong hook param shape (`useGetDailySummary(string)` instead of `({ date })`). Also mounted the wrong toaster (shadcn Toaster while pages imported `sonner`).

**How to apply:** After `wait_for_background_tasks` for any design build, run the file-existence check, typecheck, and `grep -rn '\\\`\|\\\${' src/` before restarting workflows or presenting.
