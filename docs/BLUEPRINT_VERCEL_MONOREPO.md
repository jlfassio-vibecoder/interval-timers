# Blueprint: Interval Timer Monorepo on Vercel

**Purpose:** Ideal blueprint for a monorepo containing a landing site, multiple standalone timer apps, and a central account hub—deploying to Vercel using standard configuration.

**Audience:** Use when setting up a new project of this type or as a reference for how deployment should be structured.

**References:** [Vercel Monorepos](https://vercel.com/docs/monorepos), [Vercel Project Configuration](https://vercel.com/docs/projects/overview)

---

## 1. Project Type

This blueprint targets:

- **Landing:** Marketing site with protocol links (Vite/React, static)
- **Timer apps:** Standalone SPAs (Vite/React), each a distinct workout protocol (AMRAP, Tabata, etc.)
- **Central hub:** Account management, programs, auth (Astro SSR)
- **Shared packages:** `timer-core`, `timer-ui`, `types` (no deploy)

---

## 2. Repository Structure

```
/
├── apps/
│   ├── landing/           # Marketing + protocol discovery
│   ├── app/               # Account hub, auth, workouts (SSR)
│   ├── amrap/
│   ├── tabata/
│   ├── daily-warmup/
│   ├── lactate-threshold/
│   └── ...                # Other timer apps
├── packages/
│   ├── timer-core/        # Shared timer logic
│   ├── timer-ui/          # Shared timer components
│   ├── timer-sounds/
│   └── types/
├── package.json           # Workspaces, scripts
├── package-lock.json
└── .env.example
```

**Principles:**

- Each app under `apps/` is independently deployable.
- Shared code lives in `packages/`. Apps declare dependencies in `package.json`.
- No deployment-related config at repo root other than workspace definition.

---

## 3. Vercel Projects: Standard Pattern

**Rule:** One Vercel project per deployable app. Each project uses Root Directory to point at its app.

| Vercel Project | Root Directory | Framework | Output |
|----------------|----------------|-----------|--------|
| `landing` | `apps/landing` | Vite | `dist` |
| `app` | `apps/app` | Astro | Server output |
| `amrap` | `apps/amrap` | Vite | `dist` |
| `tabata` | `apps/tabata` | Vite | `dist` |
| ... | ... | ... | ... |

**Setup:**

1. Vercel Dashboard → Add New Project → Import Git repository.
2. For each app: set **Root Directory** to `apps/<app-name>`.
3. Do not use repo root as Root Directory for any project.
4. Let Vercel infer framework from `vercel.json` or auto-detect.

**Benefits:**

- No cross-project proxy rewrites.
- Each app has its own URL (e.g. `amrap-xxx.vercel.app`).
- Vercel skips builds for unchanged projects.
- Independent deployments and rollbacks per app.

---

## 4. Domain Strategy

**Recommended:** Use subdomains so each app maps cleanly to a project.

| App | Domain | Purpose |
|-----|--------|---------|
| Landing + timers | `example.com` | Single domain for marketing + timer paths |
| App (hub) | `app.example.com` | Account, auth, programs |

**Alternative (single domain):** If you need everything on `example.com` without subdomains, use one project that builds and serves landing + timer apps from a single output (see §7). The hub remains a separate project on a subdomain.

---

## 5. Workspace Configuration

**Root `package.json`:**

```json
{
  "name": "interval-timers",
  "private": true,
  "workspaces": [
    "apps/*",
    "apps/bio-sync-sixty/apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "npm run dev -w landing",
    "dev:landing": "npm run dev -w landing",
    "dev:app": "npm run dev -w app",
    "dev:amrap": "npm run dev -w amrap",
    "build:landing": "npm run build -w landing",
    "build:app": "npm run build -w app",
    "build:amrap": "npm run build -w amrap"
  }
}
```

**Per-app scripts:** Each app has `dev` and `build` in its own `package.json`. Root scripts use `-w <workspace>`.

---

## 6. Per-App `vercel.json`

Each app has a `vercel.json` only if it needs overrides. Otherwise Vercel auto-detects.

### 6.1 Vite App (e.g. `apps/amrap`)

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
```

Or rely on auto-detection and omit `vercel.json` if defaults work.

### 6.2 Astro App (e.g. `apps/app`)

```json
{
  "framework": "astro",
  "installCommand": "cd ../.. && npm ci",
  "buildCommand": "npm run build"
}
```

`installCommand` runs from repo root so workspace dependencies resolve.

### 6.3 No Cross-Project Rewrites

Do not put rewrites that proxy to other Vercel projects. Each project is self-contained.

---

## 7. Single-Domain Option: Landing + Timers

If you want `example.com`, `example.com/amrap`, `example.com/tabata` from one domain:

**Option A – Two projects (recommended):**

- **Project 1 (landing):** Root `apps/landing`, builds landing + copies timer app dists into `dist/`. One project serves `/`, `/amrap`, `/tabata`, etc.
- **Project 2 (app):** Root `apps/app`, on `app.example.com`.

**Option B – One project, merged build:**

- Root Directory: `apps/landing` (or repo root with custom build).
- Build: Landing build + all timer builds + copy script merging outputs.
- Output: Single `dist` with subdirs for each timer.
- `vercel.json`: Rewrites for `/amrap` → `/amrap/index.html`, etc.

**Trade-off:** Merged build = one deploy for all timers, no per-app independent deploys.

---

## 8. Shared Packages

- `packages/timer-core`: Timer logic, no build, consumed by apps.
- `packages/timer-ui`: React components, built if needed.
- `packages/types`: Shared types.

**In each app `package.json`:**

```json
{
  "dependencies": {
    "@interval-timers/timer-core": "*",
    "@interval-timers/timer-ui": "*",
    "@interval-timers/types": "*"
  }
}
```

Vercel runs install from the app Root Directory. Ensure `installCommand` runs from repo root when using workspaces:

```json
"installCommand": "cd ../.. && npm ci"
```

Or use Root Directory at repo root and override only `buildCommand` and `outputDirectory` for that app.

---

## 9. Authentication and Same-Origin

**Subdomain model (`app.example.com`):**

- Cookie domain: `.example.com` to share between `example.com` and `app.example.com`.
- Supabase (or similar): Configure redirect URLs for both.
- Cross-origin: Same site via shared root domain.

**Single-domain model (all on `example.com`):**

- No cross-origin; auth and localStorage work naturally.
- Requires merged build or proxy (see §4, §7). Avoid cross-project proxy if possible.

---

## 10. Environment Variables

**Per project in Vercel:** Project → Settings → Environment Variables.

| Variable | Landing | App | AMRAP |
|----------|---------|----------|-------|
| `VITE_SUPABASE_URL` | — | — | ✓ |
| `VITE_SUPABASE_ANON_KEY` | — | — | ✓ |
| `PUBLIC_SUPABASE_URL` | — | ✓ | — |
| `PUBLIC_SUPABASE_ANON_KEY` | — | ✓ | — |

Use `PUBLIC_` for Astro, `VITE_` for Vite. Never commit secrets.

**Related Projects:** For runtime URLs between projects, use [Vercel Related Projects](https://vercel.com/docs/monorepos#how-to-link-projects-together-in-a-monorepo) and `@vercel/related-projects` instead of hardcoding.

---

## 11. Build and Install Commands

**Vite apps (static):**
- `installCommand`: `cd ../.. && npm ci` (if Root Directory is `apps/amrap`)
- `buildCommand`: `npm run build`
- `outputDirectory`: `dist`

**Astro (SSR):**
- `installCommand`: `cd ../.. && npm ci`
- `buildCommand`: `npm run build`
- Framework: Astro; Vercel uses server output automatically.

**Node version:** Pin in each app’s `package.json` if needed:

```json
"engines": {
  "node": "20.x"
}
```

---

## 12. Checklist for New Timer Apps

When adding a new timer app:

1. Create `apps/<name>/` with `package.json`, `vite.config.ts`, source.
2. Add `@interval-timers/timer-core`, `timer-ui`, `types` as dependencies.
3. Add root scripts: `dev:<name>`, `build:<name>`.
4. Create Vercel project → Root Directory `apps/<name>`.
5. If using merged output: Add entry to copy script and rewrites in landing project.
6. Set env vars in the new Vercel project if needed.

---

## 13. Anti-Patterns to Avoid

| Anti-pattern | Preferred approach |
|--------------|--------------------|
| Cross-project proxy rewrites in `vercel.json` | Separate projects with subdomains or merged build |
| Hardcoded URLs for other projects | Related Projects or env vars |
| Repo root as Root Directory for main site | Use `apps/landing` (or specific app dir) |
| Single `vercel.json` at root driving multiple apps | Per-app `vercel.json` in each app directory |
| Install from app dir only when using workspaces | `cd ../.. && npm ci` from repo root |
| Merging outputs without clear ownership | Prefer one project per app; merge only when single-domain is required |

---

## 14. Summary

- **One Vercel project per app**, each with Root Directory set to its app folder.
- **Subdomains** for hub vs marketing (`app.example.com` vs `example.com`).
- **No cross-project proxy rewrites**; use subdomains or a single merged build.
- **Per-app `vercel.json`**; no monolithic root config.
- **Workspace install** from repo root for shared packages.
- **Related Projects** for cross-project URLs instead of hardcoded values.
