# Programs App Deployment (Central Hub)

The Programs app is the central account hub for all interval-timer apps. For same-origin auth (unified login/logout), it must be served under the same domain as the main site.

## Two-Project Setup

1. **Main project** (landing + timers): Deploys from repo root, builds `build:deploy`, outputs `apps/landing/dist`. Serves `/`, `/amrap`, etc.
2. **Programs project**: Deploy as a second Vercel project with Root Directory `apps/programs`.

## Programs Project Configuration

1. In Vercel, create a new project from the same repo.
2. Set **Root Directory** to `apps/programs`.
3. Use the default build (or override): `apps/programs/vercel.json` configures install from monorepo root and workspace build.
4. The project will get a URL like `interval-timers-programs-<team>.vercel.app` or your custom domain.

### If the build fails

- **npm workspace warning**: The `installCommand` in `vercel.json` runs `npm ci` from the repo root so all workspace deps resolve.
- **Node version**: `engines` is pinned to `20.x` to avoid auto-upgrade warnings.

## Main Project: Proxy Rewrites

`vercel.json` includes rewrites that proxy Programs routes to the Programs deployment. **Update the destination URL** if your Programs project has a different Vercel URL:

- Search for `interval-timers-programs.vercel.app` in `vercel.json`
- Replace with your actual Programs deployment URL (e.g. from Vercel dashboard)

Example: if your Programs project URL is `https://programs-abc123.vercel.app`, update all rewrites accordingly.

## Same-Origin Result

With proxying, the user stays on your main domain (e.g. `interval-timers.com`). Requests to `/account`, `/programs`, etc. are proxied to the Programs backend. Auth (localStorage) is shared—logout in Programs clears session for all apps.

## Cross-Origin (Dev) Fallback

In local dev, AMRAP (port 5177) and Programs (port 3006) are different origins. AccountLink passes the session via URL hash when navigating to Account. Logout propagation: set `PUBLIC_AMRAP_LOGOUT_URL=http://localhost:5177/amrap/logout` in Programs .env so logout clears AMRAP session too.

## Env for Programs Project

Programs needs Supabase and other env vars. Copy from monorepo root `.env.example` or `apps/programs/.env.example`. Set in Vercel Project → Settings → Environment Variables.
