# Programs App — Monorepo Integration Review

This document describes how the Programs app (Astro) fits into the Workout Generator monorepo and what was done (or is recommended) to wire it in.

---

## Review of `apps/programs`

### What It Is

- **Stack:** Astro 5 (SSR), React 19, Tailwind, Supabase, Express (custom server for production), PWA (Vite PWA).
- **Adapters:** Vercel when `VERCEL=1`, otherwise Node (`@astrojs/node`, standalone).
- **Dev:** `astro dev` on port **3006** (from `package.json` and `astro.config.mjs`).
- **Build:** `astro build` → output in **`dist/`** (SSR entry at `dist/server/entry.mjs`). Production run is `node server.js` (Express wrapping that handler).
- **Env:** Loads `.env` and `.env.local` via `dotenv` in the Astro config; uses `PUBLIC_SITE_URL`, `PORT`, `VERCEL`, `NODE_ENV`, etc.

### Layout

- `src/` with Astro + React components, types, contexts, PWA.
- Custom `server.js` for production (Express + compression, serves Astro’s handler).
- Scripts: copy-favicon, check-env, db-push, security scan, Vitest.
- **Package name** in `package.json` is `"ai-fit-copilot"` (folder is `programs`).

### Compatibility With the Monorepo

- Build output is `dist/`, which matches Turbo’s existing `outputs` for `build` (`dist/**` in `turbo.json`).
- Port 3006 doesn’t clash with main-web (3007) or admin-dash (3008).
- Root `workspaces` is `["apps/*", "packages/*"]`, so `apps/programs` is already a workspace and will get a single install from the root.

---

## How to Wire It In

### 1. Workspace (Already Done)

- `apps/programs` is already included via `apps/*`. From the **repo root**, run:
  - `npm install`
- So all workspaces (including `programs`) get dependencies; you can remove `apps/programs/node_modules` and rely on the root install if you want a clean workspace.

### 2. Package Name (Optional but Useful)

- In `apps/programs/package.json`, consider changing `"name": "ai-fit-copilot"` to `"name": "programs"` so:
  - `npm run dev --workspace=programs` and Turbo filters like `--filter=programs` match the folder name and docs.

### 3. Turbo

- No change required. `turbo.json` already has:
  - `build.outputs` including `dist/**` (covers Astro).
  - `dev` as persistent with no cache.
- From root, `turbo run build` will build `programs`; `turbo run dev` will run all apps that have a `dev` script (including programs).

### 4. Root Scripts

- In the **root** `package.json`, add a convenience script for the Astro app, e.g.:
  - `"dev:programs": "turbo run dev --filter=programs"`
  - (If you keep the name `ai-fit-copilot`, use `--filter=ai-fit-copilot`.)

### 5. Ports and Running

- **Dev:** From root, `npm run dev:programs` or `npm run dev` (all apps); from app dir, `cd apps/programs && npm run dev` → http://localhost:3006.
- **Production:** `cd apps/programs && npm run build && npm run start` (server.js uses `PORT` or 8080 in prod / 3002 locally; dev is 3006).

### 6. Env for Programs

- Keep using `apps/programs/.env` and `apps/programs/.env.local` (and any `.env.example` you add). The Astro config already loads them from the app directory. No need to wire root-level env for programs unless you later decide to share vars.

### 7. Docs

- Update **COMMANDS.md** (at repo root) to include the programs app:
  - Table row: **programs** (Astro), port **3006**, root command `npm run dev:programs`, and “from app dir” `cd apps/programs && npm run dev`.
  - Optionally note that `astro-site` (if it still exists) is separate and that the in-repo Astro app is `apps/programs`.

### 8. Shared Packages (Optional Later)

- `packages/ui` exists; the Astro app doesn’t depend on it yet. You can later add `"@repo/ui": "workspace:*"` (or whatever the package name is) to `apps/programs/package.json` if you want to share UI. Not required to “wire in” the app.

### 9. Scripts That Assume “Standalone” App

- **prebuild** (optional Rollup Linux binary): fine in a workspace.
- **prepare / husky:** If the root also uses husky, you can leave programs’ prepare as-is (runs in that workspace) or remove it and rely on root husky only.
- **copy:favicon**, **check-env**, **db-push**, **security:scan:** All path-based; keep them in `apps/programs` and they’ll run relative to that app.

---

## Summary Checklist

| Item         | Action                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------- |
| Workspace    | Already included via `apps/*`; run `npm install` at root.                                         |
| Turbo        | No change; `dist/**` already in build outputs.                                                    |
| Root script  | Add `dev:programs` (or `dev:astro`) with `turbo run dev --filter=programs` (or `ai-fit-copilot`). |
| Package name | Optionally set `"name": "programs"` in `apps/programs/package.json`.                              |
| Port         | 3006; no conflict.                                                                                |
| Env          | Use `apps/programs/.env` and `.env.local` as today.                                               |
| COMMANDS.md  | Document programs, port 3006, and how to run from root and from `apps/programs`.                  |

After that, the Astro app is wired in: root install and root-level `npm run dev` or `npm run dev:programs` will include it, and builds will be cached by Turbo with `dist/` as the build output.
