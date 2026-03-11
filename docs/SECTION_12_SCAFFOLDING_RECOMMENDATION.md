# Section 12: Automating New Timer App Creation

**Implemented.** Run `npm run generate:timer` or `node scripts/generate-timer-app.cjs`. Template: `apps/.template-timer/`. Script: `scripts/generate-timer-app.cjs`.

Recommendation for automating the Blueprint §12 checklist so adding a new timer is a single command instead of a manual 6-step process.

---

## Recommendation: **Option A — Custom Node Script**

Use a **custom Node script** (`npm run generate:timer`) rather than Plop.js.

### Why Option A

| Factor | Custom script | Plop.js |
|--------|----------------|---------|
| **Scope** | Your checklist touches 4–6 distinct places (app dir, root package.json, copy script, root vercel.json, optionally protocolPaths/types). A single script can own all of this with explicit logic. | Plop can do it via multiple generators and custom actions, but you’d still write the same logic; the “framework” doesn’t reduce work for this one-off generator. |
| **Dependencies** | Zero new deps. Plain Node + `fs`/`path`; prompts via `readline` or a small prompt helper. | Adds Plop and possibly inquirer; one more thing to upgrade and reason about. |
| **Transparency** | One file (e.g. `scripts/generate-timer-app.cjs`): copy template, replace placeholders, patch root package.json, copy script, vercel.json. Easy to read and change. | Logic is spread across plopfile, templates, and actions; newcomers must learn Plop’s API. |
| **Edge cases** | Your copy script already has a special case (`workspace` for master-clock). A script can prompt for “URL path” vs “workspace name” and handle future nesting without a new abstraction. | Same logic would be custom code inside Plop actions. |
| **Turbo filter** | `build:deploy` uses a long `--filter=...` list. Script can append the new workspace name to that string and write back. | Doable with a custom “append to file” action; no simpler with Plop. |

Plop is a better fit when you have **many** generator types (new package, API route, component, etc.) and want one framework for all. For a single “new timer app” generator, a dedicated script is simpler and keeps the repo dependency-free.

---

## What the Script Should Do

1. **Prompt** (CLI or env):
   - **Workspace name** (e.g. `murph`) — used for `apps/<name>`, package name, and root scripts.
   - **URL path** (e.g. `murph-timer`) — used for Vite `base`, copy script `dest`, and vercel rewrites. Default: same as workspace name.
   - **Include in merged deploy?** (default: yes) — if yes, update copy script, root `vercel.json` rewrites, and `build:deploy` turbo filter.

2. **Scaffold app**
   - Copy from **`apps/.template-timer/`** (a minimal timer app, e.g. cloned from emom) into **`apps/<workspace-name>/`**.
   - Replace placeholders in the new app:
     - `package.json`: `name` = workspace name.
     - `vite.config.ts`: `base: '/<url-path>/'`, `server.port` (e.g. next free or derived).
     - `index.html`: `<title>` (e.g. “Murph Timer” from “murph”).
     - Any template files that reference the app name or base path.

3. **Wire the monorepo**
   - **Root `package.json`:** Add `dev:<workspace>` and `build:<workspace>`; if merged, append `--filter=<workspace>` to the `build:deploy` script.
   - **`scripts/copy-standalone-apps-to-dist.cjs`:** If merged, add `{ src: '<workspace>', dest: '<url-path>' }` to the `copies` array (order: before the closing `];` so rewrites stay consistent).
   - **Root `vercel.json`:** If merged, add rewrites for `/<url-path>`, `/<url-path>/`, and `/<url-path>/(.*)` (and optionally `/<url-path>/assets/(.*)` if you use a shared pattern).

4. **Output**
   - Print: “Created `apps/<name>/`. Next steps: …” (see below).

---

## What Stays Manual (By Design)

- **Vercel project** — Create project in dashboard and set Root Directory to `apps/<name>`, or rely on merged deploy.
- **Env vars** — Set in Vercel (or use Shared Env Vars per Section 10) if the app needs Supabase etc.
- **Landing grid (optional)** — Only if this timer is a **new protocol** that should appear on the landing page:
  - Add to `IntervalTimerPage` in `packages/types/src/protocols.ts`.
  - Add to `INTERVAL_TIMER_PROTOCOLS` and any accent map in `packages/timer-core`.
  - Add to `PROTOCOL_TO_PATH` in `apps/landing/src/lib/protocolPaths.ts`.
  - Add redirect in root `vercel.json` for `?protocol=...` if desired.

The script does **not** modify `protocolPaths.ts` or `IntervalTimerPage` so that “new app, same protocol” (e.g. a variant) doesn’t force type changes; “new protocol” remains an explicit, rare edit.

---

## Template Contents: `apps/.template-timer/`

- Start from a minimal app (e.g. **emom**): `package.json`, `vite.config.ts`, `index.html`, `tsconfig*.json`, `postcss.config.js`, `tailwind.config.js`, `eslint.config.js`, `vercel.json`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, a single component under `src/components/`, `public/` placeholders.
- Use placeholders the script will replace:
  - `{{WORKSPACE_NAME}}` (e.g. `emom`) → new name
  - `{{BASE_PATH}}` (e.g. `/emom-timer/`) → new base path with leading/trailing slashes
  - `{{TITLE}}` (e.g. `EMOM Timer`) → human-readable title
  - `{{PORT}}` (optional) — next free port or fixed offset to avoid clashes.

Keep the template minimal so the generated app builds and runs; the developer then swaps in protocol-specific UI/logic.

---

## Script Location and Invocation

- **File:** `scripts/generate-timer-app.cjs` (CommonJS so it runs with plain `node` and no `"type": "module"` requirement).
- **Invocation:** `node scripts/generate-timer-app.cjs` or `npm run generate:timer` (add script to root `package.json`).
- **Prompts:** Use Node `readline` for interactivity, or accept args like `--name=murph --path=murph-timer --merged`.

---

## Summary

- **Use Option A:** one custom Node script and a single `apps/.template-timer/` template.
- **Automate:** scaffold app, root scripts, copy script, and (optionally) vercel rewrites + turbo filter.
- **Leave manual:** Vercel project creation, env vars, and any landing-grid/protocol type changes for when they’re needed.
- **Result:** Adding a new merged timer becomes a single command and a short list of follow-ups instead of a 15-minute, error-prone checklist.
