# Deployment Configuration Audit

**Date:** March 10, 2026  
**Purpose:** Document current architecture, compare to Vercel’s standard monorepo pattern, and identify deviations and extra complexity.

---

## Executive Summary

The repo uses a **hybrid** deployment model: one main Vercel project that merges many apps into a single output, plus a **separate** App Vercel project that is reached via **cross-project proxy rewrites**. That differs from the usual Vercel monorepo approach (separate projects per app, each with its own URL) and adds extra configuration and failure modes.

---

## 1. Current Architecture

### 1.1 Vercel Projects (Configured)

| Project | Root Directory | Build | Output | Domain |
|--------|----------------|-------|--------|--------|
| **Main** (hiitworkouttimer.com) | Repo root (empty) | `npm run build:deploy` | `apps/landing/dist` | hiitworkouttimer.com |
| **App** | `apps/app` | `npm run build --workspace=app` | Astro server output | interval-timers-accounts.vercel.app |

### 1.2 Main Project: Merged Build

The main project does **not** follow the “one app = one project” pattern. Instead:

1. **`build:deploy`** (from root `package.json`):
   - Builds `landing` (Vite/React)
   - Builds 13+ standalone timer apps (daily-warmup, tabata, amrap, lactate-threshold, etc.)
   - Runs `copy-standalone-apps-to-dist.cjs`, which copies each app’s `dist` into `apps/landing/dist`:
     - `apps/amrap/dist` → `apps/landing/dist/amrap`
     - `apps/daily-warmup/dist` → `apps/landing/dist/daily-warm-up`
     - etc.

2. **Output:** Single `apps/landing/dist` containing:
   - Landing at `/`
   - `/amrap/`, `/tabata-timer/`, `/lactate-threshold/`, etc. from copied app builds

3. **`vercel.json` (root)** contains:
   - ~25 **external rewrites** to `https://interval-timers-accounts.vercel.app` for `/account`, `/programs`, `/challenges`, etc.
   - ~35 **internal rewrites** to `apps/landing/dist` for timer apps and catch-all

### 1.3 App Project: Separate App + Proxy

- **Separate Vercel project** with Root Directory `apps/app`
- Astro SSR app with its own build and deploy
- **Not** served directly under hiitworkouttimer.com
- Reached **only** through rewrites from the main project

### 1.4 Request Flow for `/account`

1. User requests `https://hiitworkouttimer.com/account`
2. Main project matches rewrite:  
   `"source": "/account"` → `"destination": "https://interval-timers-accounts.vercel.app/account"`
3. Vercel proxies the request to the App deployment
4. App handles the request; response is proxied back
5. URL stays `hiitworkouttimer.com/account`

**Failure points:**
- App deployment 500 (e.g. SSR error) → user sees “Internal server error”
- App URL wrong in `vercel.json` → 404 DEPLOYMENT_NOT_FOUND
- App static assets (`/_astro/*`, `/site.webmanifest`) requested from main domain → no rewrite, main serves its own static files → MIME/404 issues

---

## 2. Standard Vercel Monorepo Pattern

From [Vercel Monorepos docs](https://vercel.com/docs/monorepos):

> Create a **separate Vercel project for each app** in the monorepo. Each project has:
> - Its own Root Directory (e.g. `apps/web`, `apps/api`)
> - Its own build and output
> - Its own deployment URL

Typical layout:

```
GitHub repo
├── apps/landing     → Vercel project 1 → landing.vercel.app
├── apps/app         → Vercel project 2 → app.vercel.app
├── apps/amrap       → Vercel project 3 → amrap.vercel.app
└── packages/shared  → Shared code (no deploy)
```

Characteristics:
- No cross-project proxy rewrites in codebase
- Custom domains are per project (e.g. hiitworkouttimer.com → landing, account.hiitworkouttimer.com → programs)
- Each app builds and deploys independently

---

## 3. Deviations in This Repo

### 3.1 Merged Output for Timer Apps

**Standard:** One Vercel project per app (e.g. `apps/amrap` → its own project).

**Current:** One main project builds and merges 13+ apps into `apps/landing/dist` via `build:deploy` and `copy-standalone-apps-to-dist.cjs`.

**Reason:** Single domain (`hiitworkouttimer.com`) with paths like `/amrap`, `/tabata-timer`, etc., without 13+ separate projects.

**Trade-off:** One big build; all timers deploy together. No per-app independent deploys.

### 3.2 Cross-Project Proxy for App

**Standard:** Each app has its own project and URL. If you want one domain, use subdomains (e.g. `account.hiitworkouttimer.com`) or a single app that handles all routes.

**Current:** App is a separate project. Main project uses rewrites to proxy `/account`, `/programs`, etc. to that project.

**Reason:** App is Astro SSR; main output is static (Vite). Keeping them separate was likely chosen to support different runtimes.

**Trade-off:** Extra moving parts:
- Hardcoded App URL in `vercel.json`
- Two deployments that must both succeed
- Asset path issues when proxied HTML references `/_astro/*`, `/site.webmanifest`, etc., which the main project doesn’t rewrite

### 3.3 No Subdomains

**Standard:** App could be `account.hiitworkouttimer.com` or `app.hiitworkouttimer.com` → one Vercel project, one domain, no proxy.

**Current:** Same origin (`hiitworkouttimer.com`) for everything, enforced via proxy rewrites.

**Reason:** Same-origin for auth (shared localStorage). With subdomains, you’d need cross-subdomain cookies or another auth strategy.

### 3.4 Configuration Surface

- **Root `vercel.json`:** ~75 lines of rewrites (external and internal)
- **External URL:** Hardcoded `https://interval-timers-accounts.vercel.app`
- **App `vercel.json`:** Custom install (`cd ../.. && npm ci`) and workspace build
- **Main project:** No Root Directory; uses repo root

---

## 4. Variable Inventory

| Variable/Location | Purpose |
|-------------------|---------|
| Root `vercel.json` → `buildCommand` | `npm run build:deploy` |
| Root `vercel.json` → `outputDirectory` | `apps/landing/dist` |
| Root `vercel.json` → 25 rewrites | App proxy URL |
| Root `vercel.json` → ~35 rewrites | Internal paths to merged timer apps |
| `package.json` → `build:deploy` | 14 workspace builds + copy script |
| `scripts/copy-standalone-apps-to-dist.cjs` | Source/target mapping for timer apps |
| `apps/app/vercel.json` | Install and build for App |
| App Vercel project → Root Directory | `apps/app` |
| App deployment URL | Must match root `vercel.json` rewrites |

---

## 5. Why `/account` Fails (Internal Server Error)

Likely causes:

1. **Programs app runtime error**  
   Last observed: `useAppContext must be used within AppProvider` during SSR. A fix (removing `client:load` from AccountLanding) was pushed; if Programs hasn’t redeployed or there’s another error, 500 will persist.

2. **Proxy-only HTML, no asset rewrites**  
   App HTML references `/_astro/*.js` and `/site.webmanifest`. Those requests go to the main domain. Main project has no rewrites for `/_astro/*` or `/site.webmanifest`, so it serves its own static files or catch-all. Result: JS/manifest MIME errors or 404s, even if the initial HTML loads.

3. **Two projects, two deployment chains**  
   Main project and App project deploy separately. App must be healthy for `/account` to work, and its URL must match what’s in `vercel.json`.

---

## 6. Standard-Pattern Alternatives

### Option A: Single Project, Single Build (All Static + Edge)

- Build App as **static** ( prerender)
- Copy App output into main `dist`
- Serve everything from one project
- Pros: One project, one deploy, no cross-project proxy
- Cons: App must be prerenderable (no SSR)

### Option B: Subdomains, Separate Projects

- App: `account.hiitworkouttimer.com` (own Vercel project)
- Main: `hiitworkouttimer.com`
- Pros: Standard monorepo setup; no proxy rewrites
- Cons: Cross-origin auth; need shared cookies or tokens

### Option C: Keep Proxy, Add Asset Rewrites

- Add rewrites in root `vercel.json`:
  - `/_astro/(.*)` → App
  - `/site.webmanifest` → App
  - Other static paths App uses
- Pros: Keeps same-origin; fixes asset loading
- Cons: Possible path clashes if main also uses `/_astro`

### Option D: Merge Programs into Main Build (SSR)

- Use Vercel’s support for mixed outputs (static + serverless)
- Main project build outputs both landing static and App serverless
- Pros: One project; no cross-project proxy
- Cons: Requires non-trivial restructuring; build config becomes more complex

---

## 7. Recommended Next Steps (Audit-Only)

1. **Confirm App deployment status**  
   Ensure the latest main (with the AccountLanding fix) triggered an App deployment and that deployment succeeded.

2. **Capture App logs**  
   In App Vercel project → Logs, reproduce `/account` and inspect runtime errors.

3. **Test App in isolation**  
   Open `https://interval-timers-accounts.vercel.app/account` directly. If it fails, the issue is in App, not in the proxy.

4. **Decide on long-term architecture**  
   Choose among:
   - Current hybrid (proxy + merged timers)
   - Subdomains (standard pattern)
   - Single-project merged output (if App can be static or restructured)

5. **Centralize App URL**  
   If keeping the proxy, consider an env var or Vercel’s [Related Projects](https://vercel.com/docs/monorepos#how-to-link-projects-together-in-a-monorepo) instead of hardcoding the App URL in `vercel.json`.

