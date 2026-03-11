# Auth Environment Variables and Supabase Redirect URLs

This document covers environment variables for post-login redirects and the Supabase Auth redirect URLs required for deployment.

## Environment Variables

### VITE_ACCOUNT_REDIRECT_URL

Full or relative URL to the account page. Timer apps (AMRAP, Tabata standalone) use this for post-login redirect after signing in or signing up.

- **Dev (cross-origin):** Use full URL, e.g. `http://localhost:3006/account` when the timer app runs on a different port than the programs hub.
- **Prod (same-origin):** Use relative path `/account`, or leave unset to fall back to `VITE_HUD_REDIRECT_URL` or `/account`.

### VITE_HUD_REDIRECT_URL

Fallback when `VITE_ACCOUNT_REDIRECT_URL` is not set. Same semantics as above.

### Summary

| Context        | VITE_ACCOUNT_REDIRECT_URL | Notes                                             |
|----------------|---------------------------|---------------------------------------------------|
| Dev (AMRAP)    | `http://localhost:3006/account` | Programs hub on 3006; AMRAP on 5177 (cross-origin) |
| Prod (same-origin) | `/account` or unset   | Leave empty when all apps share the same origin    |

## Supabase Redirect URLs

Configure these in **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**:

1. **Account page and query variants:**
   - `/account`
   - `/account?from=amrap`
   - `/account?from=tabata`
   - `/account?from=app`
   - (Supabase supports wildcards in some configs; otherwise list common `from` values.)

2. **App origin(s):**
   - Production domain (e.g. `https://your-domain.com`)
   - `http://localhost:3006` (programs hub dev)
   - `http://localhost:5177` (AMRAP dev, when running standalone)

## Token-in-URL Handoff (Dev Only)

In local development, AMRAP runs on a different port (5177) than the programs hub (3006). The browser treats them as different origins, so `localStorage` and cookies are not shared. To preserve the session when navigating from AMRAP to the account page, `AccountLink` passes `access_token` and `refresh_token` in the URL hash.

- **Used only when:** `import.meta.env.DEV` is true and the target is cross-origin (different port).
- **Production:** Same-origin deployment means the session is shared via cookies/localStorage; no handoff is needed.
- **Security:** This flow is intentionally restricted to dev to avoid putting refresh tokens in browser history or JavaScript on production.

## Troubleshooting

**Landing on `/?hud=1` when clicking Account from AMRAP:** Check that `VITE_HUD_REDIRECT_URL` is not set to `http://localhost:3006/?hud=1`. That value is for the HUD button on StandaloneNav pages, not for Account links. Use `VITE_ACCOUNT_REDIRECT_URL=http://localhost:3006/account` in `apps/amrap/.env`, or leave both unset (dev fallback uses the correct URL).
