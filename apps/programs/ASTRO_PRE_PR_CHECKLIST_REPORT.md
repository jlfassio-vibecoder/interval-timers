# Astro Pre-PR Checklist Report

**Run date:** 2026-02-27

**Scope:** Astro boundaries (secret leakage, islands check) and @git (diff) review guidelines (security, cruft, regressions).

---

## Astro Boundaries

### Secret leakage

- **Server-only logic / non-PUBLIC env:** Verified safe.
  - **`src/lib/gemini-server.ts`** uses `GEMINI_API_KEY` (no `PUBLIC_`). The module is imported only from `src/pages/api/*` (server-only). Not bundled for client.
  - **`src/lib/supabase/server.ts`** uses `PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PUBLIC_SUPABASE_ANON_KEY`. Imported only from server libs (`lib/supabase/admin/*`, `lib/supabase/public/*`) and Astro pages/API routes. No React client component imports server or these modules.
  - **API routes** use `RUNWAYML_API_SECRET`, `GEMINI_API_KEY`, `GOOGLE_PROJECT_ID`, `GOOGLE_LOCATION` only in `src/pages/api/*`. Server-only.
  - **Client-bound code** (`src/lib/supabase/client.ts`, React components) uses only `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, or built-ins (`import.meta.env.DEV`, `import.meta.env.PROD`, `import.meta.env.SITE`). No secrets sent to the client.
- **`<script>` in Astro:** Only `BaseLayout.astro` uses a `<script>` (pwa); it uses only `import.meta.env.DEV` and `console.warn`. No secrets.

**Verdict:** No server-only logic or non-PUBLIC env vars are passed into client scripts or React islands.

### Islands check

- **Node-only modules in `client:load` / `client:visible` components:** None.
  - Grep for `from ['"](fs|path|node:)` in `src/components` returned no matches.
  - `fs`/`path`/Node APIs are used only in server code (e.g. `src/lib/supabase/server.ts`, `src/lib/polyfills/dirname.ts`, API routes).

**Verdict:** No client island relies on Node-only modules.

---

## @git (diff) Review Guidelines

_(Flag only: security, cruft, regressions.)_

### Security

- **Exposed API keys or secrets:** None. No `import.meta.env` usage without `PUBLIC_` is sent to the client. Secrets are confined to API routes and server-only modules.
- **Sensitive data or full DB objects logged to console:** None. Existing `console.error`/`console.warn` in src log error messages or stack traces; no full DB rows or secrets logged.

**Verdict:** No security issues flagged.

### Cruft

- **Leftover `console.log`:** None. No `console.log` in `src/`.
- **Commented-out code blocks:** No large commented-out blocks identified in the diff. Normal JSDoc and single-line comments are present; no action.
- **Unresolved TODO / FIXME:** None found in `src/` (grep for `TODO|FIXME|XXX`).

**Note:** Several client components use `console.error` or `console.warn` without an `import.meta.env.DEV` guard (e.g. `ChallengeGeneratorModal`, `ProgramGeneratorModal`, `AdminExerciseDetailWrapper`, `ExerciseImageCarousel`, `AppIslands`). These log error objects or short messages only, not sensitive data. Optional follow-up: wrap in `if (import.meta.env.DEV)` to avoid production noise.

**Verdict:** No blocking cruft; optional cleanup for console in client components.

### Regressions

- **Logic contradicting existing patterns in the file:** None identified.
- **Incorrect use of Astro directives:** No unnecessary `client:only` found. Current `client:only` usage (AdminDashboard, TrainerRoute, WorkoutEditor, GeneratedExerciseDetail, AdminFooterButton) is for auth-dependent or client-only UIs where SSR is not used. `client:load` and `client:visible` are used appropriately.

**Verdict:** No regressions flagged.

---

## Summary Table

| Check                      | Status | Notes                                                                  |
| -------------------------- | ------ | ---------------------------------------------------------------------- |
| Secret leakage             | OK     | No non-PUBLIC env in client; server-only modules not in client bundle. |
| Islands (Node modules)     | OK     | No `fs`/`path` in client islands.                                      |
| Exposed API keys / secrets | OK     | None.                                                                  |
| Sensitive data in console  | OK     | None.                                                                  |
| Leftover console.log       | OK     | None in src.                                                           |
| Commented-out code blocks  | OK     | No large blocks identified.                                            |
| TODO / FIXME               | OK     | None in src.                                                           |
| Logic regressions          | OK     | None identified.                                                       |
| Astro directives           | OK     | client:load / client:visible / client:only used appropriately.         |

---

## Verdict

**PRE-PR CHECKLIST: PASS**

- Astro boundaries (secret leakage, islands check) are satisfied.
- Security, cruft, and regression checks show no blocking issues.
- Optional: guard client-side `console.error`/`console.warn` with `import.meta.env.DEV` to reduce production log noise.
