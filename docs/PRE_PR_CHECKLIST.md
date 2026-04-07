# Pre-PR Checklist

Use this before opening a PR. Primary app: **`apps/app`** — **Astro** (SSR + islands), **Vite**, **React 19**, **TypeScript**, **Tailwind CSS**.

If your PR changes another workspace (e.g. `apps/amrap`, `packages/*`), run that package’s `lint`, `type-check` / `tsc`, and `test` scripts as well.

---

## Automated checks (run in `apps/app`)

From the repo root, **before every PR** (tests **and** Astro/Vite build):

```bash
cd apps/app && npm run verify:quick && npm run build
```

`verify:quick` runs **ESLint** (`.ts`, `.tsx`, `.astro`), **`tsc --noEmit`**, and **Vitest** (`vitest run`). `build` runs **Astro** + **Vite** production output and catches bundling issues that lint/tsc alone can miss.

Equivalent lint/typecheck/build without tests first: `npm run verify:all` (same as `lint` + `type-check` + `build`). **Do not use `verify:all` alone**—it does not run Vitest; always include **`npm run test`** (e.g. via `verify:quick`) before opening a PR.

| Step            | Command (in `apps/app`) | Notes |
|-----------------|-------------------------|--------|
| Lint            | `npm run lint`          | `eslint . --ext .ts,.tsx,.astro` |
| Typecheck       | `npm run type-check`    | `tsc --noEmit` |
| Tests           | `npm run test`          | Full suite; use `npm run test -- --run <path>` to scope |
| Build (required for PR) | `npm run build` | Astro/Vite; required with `verify:quick` |
| Format (optional) | `npm run format:check` | Prettier on TS/TSX/Astro/JSON/MD/CSS |

`npm run verify:all` is lint + type-check + build only (no tests). A full PR gate is still **`verify:quick && npm run build`**.

Deploy-oriented: `npm run verify:deploy` / `security:scan` — follow team norms.

**Before PR:** **`verify:quick` and `npm run build`** must pass on a clean tree.

---

## Vercel / CI build minutes (`apps/app`)

**Problem:** The **`prebuild`** hook used to run **`npm install --include=optional --force`** before every **`astro build`**. Vercel already runs **`npm install`** in the Install step, so that duplicated work and could add **many minutes per deploy**.

**Fix:** `prebuild` runs [`apps/app/scripts/prebuild-install.mjs`](../apps/app/scripts/prebuild-install.mjs). It **no-ops when `VERCEL=1` or `CI=true`** — Linux builders already get **`@rollup/rollup-linux-x64-gnu`** via **`optionalDependencies`** during the normal install. Locally (without those env vars), it still tries the targeted optional package, then falls back to a full optional install, using **`--no-audit` / `--no-fund`** where applicable.

**Related optimizations already in the app:**

- **Vite:** `build.reportCompressedSize: false` — skips extra gzip/brotli accounting during build (saves CPU on large client graphs).
- **Client chunks:** Heavy deps split into **`vendor-agora`**, **`vendor-recharts`**, and **`vendor-misc`** so caches are more granular (bandwidth / repeat visits); Agora still increases transform/minify time for the client build.
- **Bundle analysis:** `npm run analyze:bundle` in `apps/app` (sets **`ANALYZE=1`**, writes **`dist/client/bundle-stats.html`**).

**Further savings (configuration, not code):**

- Enable **Turborepo Remote Cache** on Vercel (`TURBO_TOKEN`, team/org) so unchanged workspace packages don’t rebuild every time.
- If minutes spike on the **repo root** project, **`build:deploy`** runs **turbo build across many apps**, not only `apps/app` — check which Vercel project’s graph matches your dashboard.

---

## Astro + Vite + React boundaries

### Environment variables

- **Client / island bundles** may only rely on values Astro/Vite expose: prefixes **`PUBLIC_`** (Astro) and **`VITE_`** (Vite). Do not expect other `import.meta.env.*` names to exist in the browser unless documented for server-only code.
- **Secrets and server-only config** (`SUPABASE_SERVICE_ROLE_KEY`, AI keys, etc.) belong in **API routes**, **server** modules, or Astro server code — never in React islands, shared client `lib` used by islands, or inline `<script>` without understanding what gets bundled.
- **`import.meta.env.DEV` / `PROD` / `MODE` / `SSR`** are framework flags, not secrets.

### Node vs browser

- **`src/pages/api/*`**, server-only `lib` (e.g. `getSupabaseServer`), and **`.astro` frontmatter** (server) may use Node APIs (`node:fs`, `path`, `node:crypto`, etc.).
- **Islands** (`client:load`, `client:visible`, etc.) and **client-only** modules they import must **not** import Node-only packages. If you need filesystem or secret config, keep that on the server and call it via `fetch` or Astro Actions.

### Imports and structure

- Use the **`@/`** alias in `apps/app` for app code (`@/components/...`, `@/lib/...`) so resolution matches `tsconfig` / Astro.

### Islands sanity

- Prefer the **minimal client directive** (e.g. `client:load` only where needed). Avoid `client:only` unless the component truly cannot run on the server.
- Do not pass **server-only data** (raw env objects, service-role clients, full DB rows with internal fields) into island props.

---

## @git (diff) review guidelines

Review **changed lines** only. **Do not explain what the code does.** Flag only:

### Security

- Exposed API keys, secrets, or tokens (including `import.meta.env` patterns that could ship non-public config to the client).
- Sensitive or full user/data objects logged to the **browser** console or returned to unauthorized clients.

### Cruft

- Leftover `console.log`, `console.debug`, or `console.info` (unless documented).
- Commented-out blocks that are dead.
- Unresolved `TODO`, `FIXME`, or `HACK` that should be tracked or removed.

### Regressions

- Logic that breaks patterns in the same file or feature without a clear reason.
- TypeScript weakened (`any`, dropped interfaces) without justification.
- **A11y:** removed labels, focus traps, or ARIA on interactive or dialog UI.

---

## Quick checklist (copy into the PR)

**Automation (`apps/app`)**

- [ ] `npm run verify:quick` (or lint + `type-check` + `test`) passes
- [ ] `npm run build` passes (Astro/Vite)

**Boundaries**

- [ ] No secrets; only `PUBLIC_*` / `VITE_*` (plus safe framework flags) relied on in **client** code paths
- [ ] No Node-only imports in **islands** or their client dependency graph
- [ ] `@/` imports for app code

**Review**

- [ ] Diff scanned for: Security · Cruft · Regressions (including a11y)
- [ ] Changes match existing patterns and types
