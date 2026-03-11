# Section 10: Monorepo Environment Variable Management

Implementation guide for Blueprint §10 (Environment Variables) in the interval-timers monorepo.

---

## Problem

Updating `VITE_SUPABASE_URL` or rotating API keys across 4 Vercel project dashboards is error-prone and creates operational risk.

---

## Solution A: Shared Environment Variables (Vercel Teams)

Use **Vercel Shared Environment Variables** so updates propagate to all linked projects. Requires Vercel Pro or Team plan.

### Setup

1. Go to **Team Settings** → **Environment Variables** in the Vercel dashboard.
2. Create shared variables and link them to projects (Main, App, Landing, AMRAP).
3. Update once; the change applies everywhere the variable is linked.

### Shared Variable Checklist

| Shared Variable             | Link To                   | Environments        |
| --------------------------- | ------------------------- | ------------------- |
| `VITE_SUPABASE_URL`         | Main, App, Landing, AMRAP | Production, Preview |
| `VITE_SUPABASE_ANON_KEY`    | Main, App, Landing, AMRAP | Production, Preview |
| `PUBLIC_SUPABASE_URL`       | App                       | Production, Preview |
| `PUBLIC_SUPABASE_ANON_KEY`  | App                       | Production, Preview |
| `PUBLIC_AUTH_COOKIE_DOMAIN` | App, AMRAP                | Production only     |
| `SUPABASE_SERVICE_ROLE_KEY` | App (if used server-side) | Production, Preview |

**Note:** Main and Landing use `VITE_*` for Vite builds; App uses `PUBLIC_*` for Astro; AMRAP uses `VITE_*`. Link all 4 projects to shared Supabase vars. App uses `PUBLIC_* || VITE_*` fallback.

### Project-Level Overrides

When a project needs a different value, set it at the project level (Settings → Environment Variables). Project-level vars override shared vars for the same key and environment.

---

## Solution B: Local Sync (`vercel env pull`)

Pull environment variables from Vercel into local `.env.local` files for development.

### One-Time Setup: Link Projects

Run `vercel link` in each directory, selecting the matching Vercel project:

| Directory      | Project  |
| -------------- | -------- |
| Repo root      | Main     |
| `apps/app`     | App      |
| `apps/landing` | Landing  |
| `apps/amrap`   | AMRAP    |

### Pull Environment Variables

From repo root:

```bash
npm run env:pull
```

This pulls from all 4 projects into:

- `./.env.local` (Main)
- `apps/app/.env.local` (App)
- `apps/landing/.env.local` (Landing)
- `apps/amrap/.env.local` (AMRAP)

If a project is not linked, the script prints instructions for that directory.

---

## Vercel Projects Reference

| Project  | Root Directory | Purpose                                |
| -------- | -------------- | -------------------------------------- |
| **Main** | Repo root      | Merged build; hiitworkouttimer.com     |
| **App**  | `apps/app`     | Account hub (Astro SSR); proxied       |
| **Landing** | `apps/landing` | Standalone landing/marketing         |
| **AMRAP** | `apps/amrap`   | Standalone AMRAP timer app             |

---

## References

- [Blueprint §10](./BLUEPRINT_VERCEL_MONOREPO.md#10-environment-variables)
- [Vercel Shared Environment Variables](https://vercel.com/docs/environment-variables/shared-environment-variables)
- [Vercel CLI: env pull](https://vercel.com/docs/cli/env)
