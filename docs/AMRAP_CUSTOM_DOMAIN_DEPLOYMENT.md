# AMRAP Custom Domain Deployment

Deploy the AMRAP app at a custom URL (e.g. **https://amrapwithfriends.com**) as a standalone Vercel project while keeping integration with the hub (HUD, account, landing). The app supports two deployment modes:

- **Merged deploy**: AMRAP at `example.com/amrap` (default; built with `build:deploy`, copied into landing dist).
- **Custom domain**: AMRAP at root on its own domain (e.g. `amrapwithfriends.com`).

---

## 1. AMRAP app env vars (custom domain)

Set these in the **AMRAP** Vercel project (or `.env` for local test):

| Variable | Value |
|----------|--------|
| `VITE_AMRAP_BASE` | `/` (root; required for custom domain) |
| `VITE_ACCOUNT_REDIRECT_URL` | Full account URL, e.g. `https://app.hiitworkouttimer.com/account` or `https://interval-timers-accounts.vercel.app/account` |
| `VITE_HUD_REDIRECT_URL` | Same as account URL (used for "View in History") |
| `VITE_AGORA_TOKEN_BASE_URL` | Origin that serves `/api/agora-token`, e.g. `https://interval-timers-accounts.vercel.app` |
| `VITE_SUPABASE_URL` | (existing) |
| `VITE_SUPABASE_ANON_KEY` | (existing) |
| `VITE_AGORA_APP_ID` | (existing) |

See [apps/amrap/.env.example](apps/amrap/.env.example) for comments.

---

## 2. Supabase Auth redirect URLs

In **Supabase Dashboard → Authentication → URL Configuration**:

- **Site URL**: `https://amrapwithfriends.com` (or your custom domain).
- **Redirect URLs**: Add:
  - `https://amrapwithfriends.com`
  - `https://amrapwithfriends.com/**`

Keep existing redirect URLs for the hub/account app.

---

## 3. Agora token API (CORS)

The `/api/agora-token` endpoint is served by the hub/accounts project. For AMRAP on a custom domain to fetch tokens:

- On the project that serves `/api/agora-token` (e.g. interval-timers-accounts), set **AGORA_TOKEN_ALLOWED_ORIGINS** to include the custom domain:
  - `https://amrapwithfriends.com` (comma-separated if you have multiple origins).

If unset, the API may allow all origins (`*`); restrict in production.

---

## 4. Hub app env (optional)

So that HUD and app launcher links open AMRAP on the custom domain:

- In the **hub/app** Vercel project (or `apps/app/.env`):
  - **PUBLIC_AMRAP_BASE_URL** = `https://amrapwithfriends.com`

When set, `getAmrapSessionUrl()` and `getAppLaunchUrl()` for AMRAP use this base. When unset, links use same-origin `/amrap/...`.

See [apps/app/.env.example](apps/app/.env.example).

---

## 5. Vercel project for AMRAP (custom domain)

1. Create a new Vercel project (or use existing AMRAP project).
2. **Root Directory**: `apps/amrap`.
3. **Framework Preset**: Vite.
4. **Build Command**: From repo root, use `npm run build -w amrap` (or configure Install Command to run from root so workspaces resolve). If Root is repo root, use `npm run build -w amrap` and **Output Directory**: `apps/amrap/dist`.
5. **Output Directory**: `dist` (if Root is `apps/amrap`).
6. **Environment variables**: Add all from section 1 (Production and Preview as needed).
7. **Custom domain**: Add `amrapwithfriends.com` (and `www.amrapwithfriends.com` if desired) in Project → Settings → Domains.

Ensure the build runs in a context where `npm install` and `npm run build -w amrap` see the monorepo (e.g. Root Directory = repo root with Build Command overriding to `npm run build -w amrap` and Output Directory = `apps/amrap/dist`).

---

## 6. Testing locally

- **Simulate custom-domain base path**: In `apps/amrap`, set `VITE_AMRAP_BASE=/` and run `npm run dev -w amrap`. App is at `http://localhost:5177/` (root).
- **Simulate hub linking to custom domain**: In `apps/app`, set `PUBLIC_AMRAP_BASE_URL=https://amrapwithfriends.com` and run the app; HUD "View session" / "Do Again" and app launcher "AMRAP" should point to that base.

---

## 7. Local dev with hub (avoid white screen / 404s)

When you open AMRAP **via the hub** at `http://localhost:3006/amrap/` (e.g. `npm run dev:amrap:video`), the AMRAP app must be built and served with **base `/amrap/`**. If `VITE_AMRAP_BASE=/` is set in `apps/amrap/.env` or the environment, the app will request assets at the root (`/assets/...`, `/vite.svg`). The hub only serves AMRAP under `/amrap/`, so those requests 404 and you get a white screen.

**Fix:** For local development with the hub, **leave `VITE_AMRAP_BASE` unset** (or set `VITE_AMRAP_BASE=/amrap`) in `apps/amrap`. Only set `VITE_AMRAP_BASE=/` when building the standalone deploy for the custom domain (e.g. in the AMRAP Vercel project env).

---

## 8. Merged deploy (unchanged)

- `npm run build:deploy` still builds AMRAP with default base (`/amrap`) and copies it into `apps/landing/dist/amrap`.
- No env change is required for the merged deploy; hiitworkouttimer.com/amrap continues to work.

---

## 9. Code references

- AMRAP base path: [apps/amrap/vite.config.ts](apps/amrap/vite.config.ts) (`base`), [apps/amrap/src/main.tsx](apps/amrap/src/main.tsx) (`basename`).
- Account/HUD redirects: [apps/amrap/src/lib/account-redirect-url.ts](apps/amrap/src/lib/account-redirect-url.ts).
- Agora token base: [apps/amrap/src/lib/agora.ts](apps/amrap/src/lib/agora.ts).
- Hub AMRAP URLs: [apps/app/src/lib/amrap-urls.ts](apps/app/src/lib/amrap-urls.ts) (`getAmrapSessionUrl`), [apps/app/src/lib/app-registry.ts](apps/app/src/lib/app-registry.ts) (`getAppLaunchUrl`).
