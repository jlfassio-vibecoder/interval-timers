# App Deployment (Central Hub)

The App is the central account hub for all interval-timer apps. For same-origin auth (unified login/logout), it must be served under the same domain as the main site.

## Two-Project Setup (Required)

You **must** deploy the App as a separate Vercel project. The main site rewrites `/account`, `/programs`, etc. to the App deployment URL. If the App project is missing or the URL is wrong, you get `404 DEPLOYMENT_NOT_FOUND` when visiting `/account` after login.

1. **Main project** (landing + timers): Deploys from repo root, builds `build:deploy`, outputs `apps/landing/dist`. Serves `/`, `/amrap`, etc.
2. **App project**: Deploy as a second Vercel project with Root Directory `apps/app`.

## App Project Configuration

1. In Vercel, create a new project from the same repo.
2. Set **Root Directory** to `apps/app`.
3. Use the default build (or override): `apps/app/vercel.json` configures install from monorepo root and workspace build.
4. The project will get a URL like `interval-timers-accounts-<team>.vercel.app` or your custom domain.

### If the build fails

- **npm workspace warning**: The `installCommand` in `vercel.json` runs `npm ci` from the repo root so all workspace deps resolve.
- **Node version**: `engines` is pinned to `20.x` to avoid auto-upgrade warnings.

## Main Project: Proxy Rewrites

`vercel.json` includes rewrites that proxy App routes to the App deployment. **Update the destination URL** if your App project has a different Vercel URL:

- Search for `interval-timers-accounts.vercel.app` in `vercel.json`
- Replace with your actual App deployment URL (e.g. from Vercel dashboard)

Example: if your App project URL is `https://app-abc123.vercel.app`, update all rewrites accordingly.

## Same-Origin Result

With proxying, the user stays on your main domain (e.g. `interval-timers.com`). Requests to `/account`, `/programs`, etc. are proxied to the App backend. Auth (localStorage) is shared—logout in App clears session for all apps.

## Cross-Origin (Dev) Fallback

In local dev, AMRAP (port 5177) and App (port 3006) are different origins. AccountLink passes the session via URL hash when navigating to Account. Logout propagation: set `PUBLIC_AMRAP_LOGOUT_URL=http://localhost:5177/amrap/logout` in App .env so logout clears AMRAP session too.

## Env for App Project

App needs Supabase and other env vars. Copy from monorepo root `.env.example` or `apps/app/.env.example`. Set in Vercel Project → Settings → Environment Variables.

## Troubleshooting: 404 DEPLOYMENT_NOT_FOUND on /account

**Symptom:** After login, redirect to `https://yourdomain.com/account` returns:

```
404: NOT_FOUND
Code: DEPLOYMENT_NOT_FOUND
```

**Cause:** The main project's `vercel.json` rewrites `/account` to the App deployment URL. That URL either doesn't exist or is incorrect.

**Fix:**

1. **Create the App Vercel project** (if not done):
   - Vercel Dashboard → Add New Project → Import the same Git repo
   - Set **Root Directory** to `apps/app`
   - Deploy

2. **Get the App deployment URL** from the Vercel project (e.g. `https://interval-timers-accounts-<team>.vercel.app` or your custom domain)

3. **Update `vercel.json`** in the repo root: replace all occurrences of `https://interval-timers-accounts.vercel.app` with your actual App deployment URL

4. **Redeploy the main project** so the new rewrites take effect

5. **Verify:** Open `https://<your-app-url>/account` directly — it should load. Then try logging in from AMRAP again.

## Troubleshooting: HTTP 500 on App (interval-timers-accounts.vercel.app)

**Symptom:** The App URL (e.g. `https://interval-timers-accounts.vercel.app` or `https://hiitworkouttimer.com/admin`) returns:

```
This page isn't working
HTTP ERROR 500
```

**Cause:** The App throws in production when Supabase env vars are not set. `src/lib/supabase/supabase-instance.ts` fails fast so auth is never sent to a wrong/missing project.

**Fix:**

1. Open **Vercel** → **App project** (interval-timers-accounts) → **Settings** → **Environment Variables**.
2. Add for **Production** (and **Preview** if you use branch previews):
   - `SUPABASE_URL` = your Supabase project URL (e.g. `https://<project-ref>.supabase.co`)
   - `SUPABASE_ANON_KEY` = anon key from Supabase Dashboard → Project Settings → API
3. **Redeploy** the App project (Deployments → … → Redeploy) so the new env is used.

**If env vars are already set and you still get 500:**

- **Redeploy** again so the build runs with the current env (older builds may have baked in empty values).
- In Vercel → App project → **Deployments** → open the latest deployment → **Functions** or **Runtime Logs**. The logged error (e.g. missing Supabase, or another exception) will show the real cause.
4. See **docs/SUPABASE_ENV.md** for all supported variable names (`VITE_*`, `PUBLIC_*`, etc.).
