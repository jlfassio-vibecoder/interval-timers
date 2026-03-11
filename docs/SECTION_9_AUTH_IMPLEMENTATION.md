# Section 9: Authentication and Same-Origin

Implementation guide for Blueprint §9 (Authentication and Same-Origin) in the interval-timers monorepo.

---

## Current Architecture

### Same-Origin (Current)

The deployment uses a **merged build + proxy** model:

- **Main** (hiitworkouttimer.com): Serves landing + timer apps from a single output
- **App** (interval-timers-accounts.vercel.app): Proxied via rewrites (e.g. `/account` → App)
- **Timer apps**: Copied into `apps/landing/dist` (e.g. `/amrap`, `/tabata-timer`)

Everything is served under **hiitworkouttimer.com**, so it is **same-origin**:

- `localStorage` is shared across `/`, `/account`, `/amrap`, etc.
- Supabase session (stored in localStorage by default) is visible to all apps
- No cookie domain configuration needed for auth to work

### Cross-Origin Scenario (Blueprint §9)

If you deploy apps on **separate origins** (e.g. subdomains or standalone timer URLs):

- `app.hiitworkouttimer.com` (hub)
- `hiitworkouttimer.com` (landing)
- `amrap.hiitworkouttimer.com` or `amrap-xxx.vercel.app` (AMRAP timer)

Then `localStorage` is **not** shared. Users would appear logged out when moving between apps. **This is now supported:** set `PUBLIC_AUTH_COOKIE_DOMAIN=.hiitworkouttimer.com` and both the main Supabase session and the admin `sb-access-token` cookie will use cross-subdomain storage.

---

## Implemented Changes

### 1. Auth Cookie Domain (`auth-cookie.ts`)

The `sb-access-token` cookie (used for server-side admin route verification) supports a configurable domain.

**Environment variable:** `PUBLIC_AUTH_COOKIE_DOMAIN` (App) or `VITE_AUTH_COOKIE_DOMAIN` (AMRAP)

**Example (production):**

```env
PUBLIC_AUTH_COOKIE_DOMAIN=.hiitworkouttimer.com
```

**Domain format:** Use a leading dot (e.g. `.hiitworkouttimer.com`) so the cookie is readable by all subdomains. In development, a console warning appears if the domain is set without the leading dot.

**When to set:** Leave **unset** for same-origin (current merged setup) or localhost. Set only when using subdomains.

### 2. Supabase Client (Cookie-Based When Domain Set)

`supabase-instance.ts` (App) and `supabase.ts` (AMRAP) conditionally use `createBrowserClient` from `@supabase/ssr` when `PUBLIC_AUTH_COOKIE_DOMAIN` / `VITE_AUTH_COOKIE_DOMAIN` is set:

- **Unset:** `createClient` (localStorage) – same-origin behavior, no changes.
- **Set:** `createBrowserClient` with `cookieOptions.domain` – session stored in cookies, shared across subdomains.

When the domain is set but does not start with `.`, a dev-only console warning is logged.

---

## Supabase Redirect URLs

In Supabase Dashboard → Authentication → URL Configuration → Redirect URLs, add all origins where users may land after login. Copy-paste ready list:

```
https://hiitworkouttimer.com/**
https://app.hiitworkouttimer.com/**
https://amrap.hiitworkouttimer.com/**
http://localhost:4321/**
http://localhost:5173/**
http://localhost:5177/**
```

| URL | Purpose |
|-----|---------|
| `https://hiitworkouttimer.com/**` | Production (merged) |
| `https://app.hiitworkouttimer.com/**` | Hub (if using subdomain) |
| `https://amrap.hiitworkouttimer.com/**` | AMRAP (if standalone) |
| `http://localhost:4321/**` | App dev |
| `http://localhost:5173/**` | Landing dev |
| `http://localhost:5177/**` | AMRAP dev |

---

## Subdomain Model (Implemented)

To enable cross-subdomain auth:

1. Set the env var in Vercel (and local `.env` for testing):
   ```env
   PUBLIC_AUTH_COOKIE_DOMAIN=.hiitworkouttimer.com
   ```
   For AMRAP: `VITE_AUTH_COOKIE_DOMAIN=.hiitworkouttimer.com`

2. Add redirect URLs in Supabase Dashboard (see above).

3. Verify: Log in at `app.hiitworkouttimer.com`, then navigate to `amrap.hiitworkouttimer.com` – the user should still be logged in.

---

## Security Note

Use a specific root domain only (e.g. `.hiitworkouttimer.com`). **Do not** use overly broad domains like `.com` – that would allow the cookie to be sent to unrelated sites. The leading dot (`.yourdomain.com`) is required for subdomain sharing.

---

## URL Hash Handoff (Existing)

For cross-origin AMRAP → App, `AppContext` already handles URL hash handoff:

```ts
// apps/app/src/contexts/AppContext.tsx
const hash = window.location.hash;
const params = new URLSearchParams(hash.slice(1));
const accessToken = params.get('access_token');
const refreshToken = params.get('refresh_token');
if (accessToken && refreshToken) {
  await supabase.auth.setSession({ access_token, refresh_token });
}
```

When redirecting from AMRAP to the App with tokens in the hash, the App restores the session. This complements cookie-based sharing when both apps use the same Supabase project.

---

## Checklist

- [x] `auth-cookie.ts` supports optional `PUBLIC_AUTH_COOKIE_DOMAIN`
- [x] `@supabase/ssr` installed; `createBrowserClient` used when domain is set (App + AMRAP)
- [ ] Supabase redirect URLs include all deployed origins (manual step in Dashboard)
- [ ] Set `PUBLIC_AUTH_COOKIE_DOMAIN=.hiitworkouttimer.com` in production when using subdomains

---

## References

- [Blueprint §9](./BLUEPRINT_VERCEL_MONOREPO.md#9-authentication-and-same-origin)
- [Supabase Sessions](https://supabase.com/docs/guides/auth/sessions)
- [Supabase SSR (`@supabase/ssr`)](https://github.com/supabase/ssr)
- [DEPLOYMENT_AUDIT.md](./DEPLOYMENT_AUDIT.md) – current architecture
