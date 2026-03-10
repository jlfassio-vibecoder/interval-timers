# Astro Pre-PR Checklist Report

**Run date:** 2026-02-27

**Scope:** Astro boundaries (secret leakage, islands check) and git-diff review (security, cruft, regressions).

---

## Astro Boundaries

### Secret leakage

- **No server-only logic or non-PUBLIC env in client:** Verified.
  - **Client-bound code:** `src/lib/supabase/client.ts`, `src/services/geminiService.ts`, `src/pwa.ts`, and all React components use only `PUBLIC_*` env vars or built-ins (`import.meta.env.DEV`, `import.meta.env.PROD`, `import.meta.env.SITE`). `SITE` is Astro’s public site URL (astro.config).
  - **Server-only:** `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_PROJECT_ID`, `GOOGLE_LOCATION`, `RUNWAYML_API_SECRET` appear only in API routes (`src/pages/api/*`) or server modules (`src/lib/supabase/server.ts`, `src/lib/gemini-server.ts`). `gemini-server` is imported only from `src/pages/api/*`. `src/lib/supabase/admin/auth.ts` uses only `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` and is only imported from `.astro` pages and API routes.
- **`<script>` in Astro:** Only `BaseLayout.astro` has a `<script>`; it imports `../pwa`, which uses only `import.meta.env.DEV` and `console.warn`. No secrets.
- **Action:** None. No secret leakage.

### Islands check

- **Node-only modules in client:load / client:visible components:** None. No `fs` or `path` (or other Node-only) imports in `src/components`. `path` is used only in `src/lib/supabase/server.ts` and `src/lib/polyfills/dirname.ts`; both are server-only (API/server and Firebase Admin polyfill). No client island imports them.
- **Action:** None.

---

## @git (diff) Review Guidelines

_(Do not explain code logic. Flag only the following.)_

### Security

- **Exposed API keys or secrets:** None. No `import.meta.env` without `PUBLIC_` sent to the client.
- **Sensitive data or full DB objects in console:** None. `src/lib/supabase/admin/auth.ts` does not log tokens or cookie content. Remaining `console.error`/`console.warn` calls log error messages or guarded dev-only details; no full DB rows or secrets logged.

### Cruft

- **Leftover console.log:** None. No `console.log` in `src/`; only `console.error` and `console.warn` (intentional error reporting).
- **Commented-out code blocks:** **Fixed.** Removed commented-out import in `src/lib/gemini-server.ts` (line 1: old `GoogleGenerativeAI` import).
- **Unresolved TODO / FIXME:** None found in `src/`.

### Regressions

- **Logic contradicting existing patterns:** None identified.
- **Incorrect use of Astro directives:** No unnecessary `client:only` identified. Current `client:only` usage: `AdminFooterButton`, `AdminDashboard`, `TrainerRoute`, `WorkoutEditor` (+ AppProvider), `GeneratedExerciseDetail` — all auth-dependent or client-only routing/editor UIs where SSR is not used. No change required for this report.

---

## Summary

| Check                     | Status | Notes                                                                  |
| ------------------------- | ------ | ---------------------------------------------------------------------- |
| Secret leakage            | OK     | No non-PUBLIC env in client; server-only modules not in client bundle. |
| Islands (Node modules)    | OK     | No `fs`/`path` in client islands.                                      |
| Exposed secrets           | OK     | None.                                                                  |
| Sensitive data in console | OK     | None.                                                                  |
| console.log               | OK     | None in src.                                                           |
| Commented-out code        | Fixed  | Removed in `src/lib/gemini-server.ts`.                                 |
| TODO/FIXME                | OK     | None.                                                                  |
| Logic regressions         | OK     | None.                                                                  |
| Astro directives          | OK     | client:only usage appropriate.                                         |

---

**Fixes applied this run**

- Removed commented-out line in `src/lib/gemini-server.ts` (old SDK import).

_Generated from Astro Pre-PR Checklist boundaries and @git (diff) review guidelines._
