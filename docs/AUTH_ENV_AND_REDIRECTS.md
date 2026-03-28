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

3. **Roster invite landing and Mission Control (trainer/host client & friend invites):**
   - **Primary:** branded public landing built from `buildRosterInviteAcceptUrl`:
     - **Default:** token in the query string, e.g.  
       `https://app.hiitworkouttimer.com/welcome`  
       `https://app.hiitworkouttimer.com/welcome**` (if your Supabase project allows `**` wildcards)  
       List concrete URLs with `?invite=` if your project does not wildcard query strings.
     - **Studio vanity (Phase 3):** when the inviter’s profile has a `studio_id` and that studio has a slug, links use `/s/{studioSlug}/i/{token}`. Add allowlisted patterns on the **hub** origin, e.g.  
       `https://app.hiitworkouttimer.com/s/**`  
       (or explicit prefixes such as `https://app.hiitworkouttimer.com/s/` if your project does not support `**` under `/s/`).  
       Dev: `http://localhost:3006/s/**` or `http://localhost:3006/s/` as needed.  
       If these paths are missing, magic-link `redirectTo` may be rejected and users can lose the invite token (same failure mode as missing `/welcome`).
   - **Legacy / staff:** direct roster URL still works for Mission Control staff, e.g.  
     `https://app.hiitworkouttimer.com/trainer/roster` and the same `**` pattern if supported.
   - Local dev: `http://localhost:3006/welcome`, `http://localhost:3006/trainer/roster`, and wildcard/port variants if supported.
   - Supabase passes `redirectTo` from `inviteUserByEmail` / magic links; if the exact URL is not allowlisted, Auth falls back to **Site URL** and the `?invite=` token may be lost.

4. **How to update the hosted allow list (CLI / API vs Dashboard)**  
   - **Dashboard:** Authentication → URL Configuration → Redirect URLs (same strings as above).  
   - **Management API:** `PATCH https://api.supabase.com/v1/projects/<project-ref>/config/auth` with body `{"uri_allow_list":"<comma-separated URLs>"}`. Use a personal access token in `Authorization: Bearer <SUPABASE_ACCESS_TOKEN>` (see [Supabase CLI access token](https://supabase.com/docs/guides/cli/getting-started#access-token)). Merge with the existing `uri_allow_list` from `GET` on the same path so you do not drop entries.  
   - **`supabase config push`** pushes `supabase/config.toml` `[auth]` to the linked project and can change **`site_url`** and other auth settings; use it only when the file intentionally matches production, or prefer Dashboard / targeted PATCH for small allow-list changes.

## Token-in-URL Handoff (Dev Only)

In local development, AMRAP runs on a different port (5177) than the programs hub (3006). The browser treats them as different origins, so `localStorage` and cookies are not shared. To preserve the session when navigating from AMRAP to the account page, `AccountLink` passes `access_token` and `refresh_token` in the URL hash.

- **Used only when:** `import.meta.env.DEV` is true and the target is cross-origin (different port).
- **Production:** Same-origin deployment means the session is shared via cookies/localStorage; no handoff is needed.
- **Security:** This flow is intentionally restricted to dev to avoid putting refresh tokens in browser history or JavaScript on production.

## Troubleshooting

**Landing on `/?hud=1` when clicking Account from AMRAP:** Check that `VITE_HUD_REDIRECT_URL` is not set to `http://localhost:3006/?hud=1`. That value is for the HUD button on StandaloneNav pages, not for Account links. Use `VITE_ACCOUNT_REDIRECT_URL=http://localhost:3006/account` in `apps/amrap/.env`, or leave both unset (dev fallback uses the correct URL).

---

## Roster invites, email verification, and redirect alignment

Runbook for **host/trainer roster invitations**, Supabase **email verification** (`/verify`), and making sure users land where **invite acceptance** can run. The hub serves a **public `/welcome` landing** (Phase 1) for branded first paint and client-safe accept; configuration must still be correct for Auth redirects and cookies.

### Canonical URL roles

| Role | Example | Purpose |
|------|---------|--------|
| **Marketing / apex** | `https://hiitworkouttimer.com` | Often the **Site URL** or where users start; may appear as the **Referer** on Supabase `GET /verify` logs. Alone it does **not** run Mission Control or hub `/api/*` unless that same deployment serves those routes. |
| **App / hub** | `https://app.hiitworkouttimer.com` | Origin that should match **`PUBLIC_APP_URL`** on the **Astro hub** (`apps/app`) deployment: Mission Control, `/api/trainer/*`, `/api/invitations/*`. Roster invite links and Auth **`redirectTo`** are built from `PUBLIC_APP_URL` in code (see `buildRosterInviteAcceptUrl` in `apps/app/src/lib/supabase/admin/roster-invitations.ts`). |

If `PUBLIC_APP_URL` points at a host where you do **not** deploy the hub APIs, invitees get links or redirects that **cannot** attach `sb-access-token` to your API origin, and acceptance endpoints will 401 or never run.

### Hub environment: `PUBLIC_APP_URL` (`apps/app`)

- Set to the **https origin** of the production hub (no trailing slash), e.g. `https://app.hiitworkouttimer.com`.
- **If unset**, server/build code defaults to `https://app.aiworkoutgenerator.com`, which is wrong for hiitworkouttimer.com production.
- **Effect:** Email copy links, `inviteUserByEmail` / `generateLink` **`redirectTo`**, and shared invite URLs all use this base plus either `/welcome?invite=...` or `/s/{slug}/i/{token}` when a studio slug exists (see `buildRosterInviteAcceptUrl`).

### Hub environment: `PUBLIC_AUTH_COOKIE_DOMAIN`

- Optional; set when auth must span **subdomains** of one registrable domain, e.g. `PUBLIC_AUTH_COOKIE_DOMAIN=.hiitworkouttimer.com` (leading dot). Used by `apps/app/src/lib/auth-cookie.ts` so **`sb-access-token`** is sent to sibling hosts under that domain (per browser cookie rules).
- **Matrix (conceptual):**
  - **App only on `app.`:** If users verify or sign in only on `https://app.hiitworkouttimer.com`, cookie **without** a Domain attribute works for that host. Subdomain sharing is unnecessary unless they also hit `https://hiitworkouttimer.com` or `www` with the same session expectation.
  - **Apex + `app.`:** If verification or marketing lands on apex and the hub runs on `app.`, you typically need **`domain=.hiitworkouttimer.com`** so one session cookie is visible on both **only if** both pages run client code that calls `setAuthCookie` (same Supabase project). If apex is a **static** site without your app bundle, users may not get the cookie until they open the app origin—then **`POST /api/invitations/accept-pending`** can still finalize invites once they are signed in on the hub.
- **Limitations:** `Secure` on HTTPS; `SameSite=Lax` on top-level GET navigations; `www` vs apex are different hostnames unless cookie Domain covers the parent; third-party cookie policies do not apply to first-party `sb-access-token` on your own origins.

### Supabase Dashboard checklist

**Authentication → URL configuration**

1. **Redirect URLs** — Include hub roster paths (see [Supabase Redirect URLs](#supabase-redirect-urls) §3). Add every concrete origin you use (production + preview + localhost).
2. **Site URL** — Default redirect when `redirectTo` is missing or rejected. If this is **only** marketing (`https://hiitworkouttimer.com`), users may never hit `/welcome?invite=` unless templates or code always pass an allowlisted `redirectTo`. Prefer **Site URL** = primary **logged-in app entry** if that matches product, or keep marketing as Site URL but ensure **all** Auth emails use an allowlisted app URL as `redirectTo`.
3. After changes, send a **test invite** and confirm the link’s `redirect_to` query points at your hub.

### Verification vs roster row status

- Supabase **`/verify`** (and related Auth callbacks) creates or confirms the **Auth user** only.
- The row in **`roster_invitations`** moves off **`pending`** only when the hub runs:
  - **`POST /api/invitations/accept`** with the invite token (usually from `/welcome?invite=...`; Mission Control staff may still use `/trainer/roster?invite=...`), or
  - **`POST /api/invitations/accept-pending`** while the user is signed in with an email/phone matching the invite (`apps/app/src/pages/api/invitations/accept-pending.ts`), triggered from the client after session establishment.

So **“Confirmed” in the Auth dashboard** does not by itself mean the invite is accepted in Postgres.

### Smoke test (optional)

1. Create a roster invite (Mission Control) to a test email.
2. Complete the email flow (signup / magic link / verify as applicable).
3. Confirm the browser ends on an **allowlisted** URL on the **hub** origin (address bar includes `/welcome?invite=` or `/s/.../i/...` for studio vanity links, or you land on hub and session exists).
4. In DevTools **Network**, look for `GET /api/invitations/preview`, `POST /api/invitations/accept`, or `POST /api/invitations/accept-pending` (200 as applicable).
5. In Supabase **Table Editor**, confirm `roster_invitations.status` is **`accepted`** for that row (or it disappears from the trainer’s pending list).

### Code references

- `buildRosterInviteAcceptUrl` / default base: `apps/app/src/lib/supabase/admin/roster-invitations.ts`
- Public invite preview: `apps/app/src/pages/api/invitations/preview.ts`
- Welcome landing: `apps/app/src/pages/welcome.astro`, `apps/app/src/pages/s/[studioSlug]/i/[token].astro`, `apps/app/src/components/react/WelcomeInviteLanding.tsx`
- Auth email `redirectTo`: `apps/app/src/lib/supabase/admin/roster-invite-delivery.ts`
- Session cookie: `apps/app/src/lib/auth-cookie.ts`
