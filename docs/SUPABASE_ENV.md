# Supabase Environment Variables

**All env var names below work.** The codebase accepts `SUPABASE_URL`, `VITE_SUPABASE_URL`, and `PUBLIC_SUPABASE_URL` (and equivalent for anon key). Use whichever you have; no need to duplicate.

## Required for Auth / Account Page

| Variable | Purpose | Where |
|----------|---------|-------|
| `SUPABASE_URL` or `VITE_SUPABASE_URL` or `PUBLIC_SUPABASE_URL` | Supabase project URL | Client + server |
| `SUPABASE_ANON_KEY` or `VITE_SUPABASE_ANON_KEY` or `PUBLIC_SUPABASE_ANON_KEY` | Anon (public) key | Client + server |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only) | Server / API routes |

## Vercel Setup (Production)

Set env vars in **each Vercel project** that builds/deploys an app that uses Supabase:

- **Root / Main** (hiitworkouttimer.com) – if it builds anything that uses Supabase
- **App** (interval-timers-accounts.vercel.app) – **required** for `/account` and auth

### Minimum required in each project

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon JWT from Dashboard → API>
```

Or use the `VITE_` / `PUBLIC_` variants; all are supported.

### Apply to

- Production
- Preview (if you use preview branches with Supabase)

## Local (.env / .env.local)

Copy from `.env.example` or set:

```
SUPABASE_URL=https://dgxoyhkqdxarewmanbrq.supabase.co
VITE_SUPABASE_URL=https://dgxoyhkqdxarewmanbrq.supabase.co
SUPABASE_ANON_KEY=<your anon key>
VITE_SUPABASE_ANON_KEY=<your anon key>
```

## How It Works

- **Vite** only exposes `VITE_*` to the client by default; `SUPABASE_URL` is not.
- **astro.config.mjs** injects `SUPABASE_URL` and `SUPABASE_ANON_KEY` from `process.env` into the client build via `define`.
- Any of `SUPABASE_*`, `VITE_SUPABASE_*`, or `PUBLIC_SUPABASE_*` work for URL and anon key.
