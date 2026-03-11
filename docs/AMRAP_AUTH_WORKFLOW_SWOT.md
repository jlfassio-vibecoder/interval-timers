# SWOT Analysis: Login/Create Account Workflow — AMRAP With Friends

**Scope:** Authentication flow on the AMRAP With Friends page (`/with-friends`)

**Components:** `AuthModal`, `AmrapWithFriendsPage`, `AmrapAuthContext`, `AccountLink`, Supabase Auth

**Date:** March 11, 2025

---

## Strengths

| Area | Description |
|------|-------------|
| **Low-friction core flow** | Create and join sessions require no account. Users can try the product immediately. |
| **Clear value proposition** | Copy explains why to create an account: *"Create an account to schedule further out and track your AMRAP sessions."* |
| **Contextual CTA** | "Create account" appears in "Schedule for later" when the user hits the 1-week limit, tying the CTA to a concrete need. |
| **Unified modal** | Single `AuthModal` handles both sign-in and sign-up with a toggle; no separate routes or pages. |
| **Error handling** | Auth errors are handled for invalid credentials, unconfirmed email, and generic cases. Friendly messages (e.g. "Wrong email or password") avoid raw Supabase errors. |
| **Accessibility** | Modal uses `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and Escape key to close. |
| **Session persistence** | `AmrapAuthContext` syncs with Supabase `onAuthStateChange`; user/ session/profile stay in sync. |
| **Permission model** | `hasFullAccess` (trial/purchase) gates scheduling limits (1 week vs 52 weeks) without blocking core use. |
| **Cross-origin support** | `AccountLink` passes tokens via URL hash in dev when AMRAP and Account app run on different origins. |
| **Configurable redirect** | Post-login redirect via `VITE_ACCOUNT_REDIRECT_URL` supports dev (e.g. `localhost:3006`) and production. |

---

## Weaknesses

| Area | Description |
|------|-------------|
| **Post-login redirect** | Login always redirects to `/account`, pulling users away from AMRAP. Users who login to schedule may expect to stay on the AMRAP page. |
| **`alert()` for confirmation** | Sign-up success uses `alert('Check your email for the confirmation link!')`, which feels dated and blocks interaction. |
| **No password guidance** | No client-side validation or guidance (length, strength). Supabase errors may be opaque if password rules are strict. |
| **Hidden upgrade path** | "Create account" in Schedule for later is only visible when user chooses "Schedule for later". The 1-week limit is not surfaced until then. |
| **Email confirmation landing** | Supabase confirmation links redirect per project settings. If configured for the programs app, users may land there instead of AMRAP. |
| **Different handoff approaches** | `AccountLink` uses token-in-hash in dev; `AuthModal` uses simple redirect. Two distinct patterns for the same flow. |
| **No "Remember me"** | No explicit UX for session persistence; behavior depends on Supabase + storage strategy. |
| **No password visibility toggle** | Password field has no show/hide control; common expectation in modern auth UIs. |

---

## Opportunities

| Area | Description |
|------|-------------|
| **Shared auth package** | Extract `@interval-timers/auth-ui` (or similar) so AMRAP, Tabata, EMOM, etc. all use the same AuthModal. Standardize auth across the monorepo. |
| **Account entry-point card** | Pass `?from=amrap` (or app id) on redirect; account page shows a card for the app the user signed in from, with "Continue" or "Return" CTA. |
| **Account as app management hub** | Reframe `/account` as the landing to manage all apps; app launcher + HUD link; clear "Manage workouts" → HUD. |
| **Stay on AMRAP after login** | Add an optional `returnUrl` so users who log in from AMRAP can be sent back after auth instead of always going to `/account`. |
| **Replace `alert()` with in-modal success** | Show a success state in the modal (e.g. “Check your email…”) instead of `alert()`, then auto-close or show a close button. |
| **Proactive scheduling CTA** | Surface the upgrade path earlier (e.g. banner: “Create an account to schedule sessions up to a year in advance”) before users hit the limit. |
| **Client-side password rules** | Add real-time hints (length, complexity) to reduce Supabase rejections and improve clarity. |
| **Magic link / OAuth** | Add “Sign in with Google” or magic link to reduce friction and support users who prefer passwordless auth. |
| **Inline success messaging** | Use toast/notification component instead of blocking alerts for success states. |
| **Unify handoff logic** | Standardize how AMRAP hands off to the Account app (redirect vs token-in-hash) for dev and prod. |
| **Password visibility toggle** | Add show/hide for the password field to improve usability on mobile. |
| **Post-confirmation redirect** | Align Supabase redirect URLs with AMRAP so confirmed users land on `/with-friends` when appropriate. |

---

## Threats

| Area | Description |
|------|-------------|
| **Supabase config drift** | Redirect URLs, email templates, and confirmation links in Supabase must match AMRAP’s entry points or users may be routed incorrectly. |
| **Env misconfiguration** | Missing or incorrect `VITE_ACCOUNT_REDIRECT_URL` / `VITE_HUD_REDIRECT_URL` can send users to the wrong app or `/account` on the wrong origin. |
| **Dev vs prod divergence** | Token-in-hash handoff is dev-only; prod assumes same-origin. Multi-origin prod (e.g. `amrap.example.com` vs `app.example.com`) would need cookie domain or equivalent setup. |
| **Profile creation race** | Sign-up triggers profile creation (likely via DB trigger). Delays or failures could cause `hasFullAccess` / profile lookups to fail immediately after sign-up. |
| **Unconfirmed email login attempts** | Users who try to log in before confirming get a specific error, but the flow doesn’t offer resend or clear next steps. |
| **Competing AuthModals** | `AuthModal` is used in `AmrapWithFriendsPage`, `AmrapSessionPage`, and `AmrapInterval`. Shared state or props could lead to inconsistent behavior across pages. |
| **Cookie domain setup** | `VITE_AUTH_COOKIE_DOMAIN` is optional; cross-subdomain auth in production depends on correct configuration. |

---

## Integration with Centralized User Management (`apps/app`)

Users can enter through any of **17+ apps** in the monorepo (AMRAP, Tabata, EMOM, Wingate, Gibala, Timmons, etc.). The system balances:

1. **User intent:** Create an account and stay in the app they're using
2. **Centralization:** Single user management, profile, and subscription across all apps

### Current Architecture

| Layer | Responsibility | Location |
|-------|----------------|----------|
| **Auth provider** | Supabase Auth (email/password, sessions) | Shared; same project for all apps |
| **Profile store** | `public.profiles` (id, email, full_name, role, purchased_index, amrap_trial_ends_at) | Shared; `auth.users` → trigger creates row |
| **Account hub** | Programs, HUD, workout logs, subscriptions, app launcher | `apps/app` at `/account` |
| **Timer apps** | Standalone SPAs; AMRAP has its own AuthModal + AmrapAuthContext | `apps/amrap`, `apps/tabata`, etc. |

### How AMRAP Integrates with `apps/app`

1. **Same Supabase project** — AMRAP and `apps/app` use the same Supabase URL and anon key. One sign-up creates one user and one profile.

2. **Post-login redirect** — AMRAP's AuthModal always redirects to `/account` (or `VITE_ACCOUNT_REDIRECT_URL`) after successful sign-in. Users leave AMRAP and land on the central account page.

3. **AccountLink** — "My Account" and "Account" links send users to `/account`. In dev (cross-origin), tokens are passed via URL hash; `AppContext` in `apps/app` restores the session from the hash on load.

4. **Session sharing** — Same-origin deployment: localStorage is shared, so no handoff. Cross-origin (subdomains): `PUBLIC_AUTH_COOKIE_DOMAIN` / `VITE_AUTH_COOKIE_DOMAIN` shares cookies across `*.hiitworkouttimer.com`.

5. **Profile data** — `AmrapAuthContext` fetches `amrap_trial_ends_at`, `purchased_index` from `profiles` for AMRAP-specific logic. `AppContext` fetches full profile for programs, HUD, workout logs.

6. **Logout propagation** — `handleLogout` in AppContext redirects to `VITE_AMRAP_LOGOUT_URL` to clear the timer app's session when logging out from the hub.

### Multi-App Reality

| App | Auth surface | Redirects to |
|-----|--------------|--------------|
| **AMRAP** | AuthModal (login/create) in 3 places: With Friends page, Session page, Interval page | Always `/account` |
| **apps/app** | AuthModal in AppIslands; used by Programs, HUD, WorkoutPlanBuilder, Admin | Stays in app (or `/trainer` for trainers) |
| **Tabata, EMOM, Wingate, etc.** | No AuthModal; no in-app auth | Landing links to `/account`; users must go there to sign in |

Only **AMRAP** and **apps/app** host auth UI. The other timer apps rely on users navigating to `/account` (from the landing page or nav) to log in. They have no local "Log in" or "Create account" flow.

### Tension: Stay in App vs. Central Hub

| User expectation | Current behavior | Gap |
|------------------|------------------|-----|
| "I'm in AMRAP, I'll create an account and keep scheduling" | Redirected to `/account` after login | User is pulled away; must click back to AMRAP or use Account launcher |
| "I'm in Tabata, I want to log in" | No in-app auth; must go to `/account` | Extra navigation; no seamless flow |
| "One account for all my timers" | ✅ Same profile, same Supabase; works | — |
| "I paid for AMRAP; does it work in Programs?" | `purchased_index` / `amrap_trial_ends_at` in shared profile | Entitlements are centralized; AMRAP reads them |

### Target Architecture: Standardized Auth & Account Hub

Auth and the account experience should be standardized across the monorepo. The following is the target state.

#### 1. Shared Auth Component

- **Extract** a shared auth package (e.g. `@interval-timers/auth-ui` or `packages/auth-ui`) used by all apps.
- **Standardize** login/create account flow: same modal, same validation, same error handling, same redirect behavior.
- **Adopters:** AMRAP, Tabata, EMOM, Wingate, Gibala, Timmons, etc.—any app that needs "Log in" or "Create account."
- **Benefits:** One implementation to maintain; consistent UX; any timer app can offer in-app auth without duplication.

#### 2. Account Page as App Management Landing

- **Purpose:** Central landing page for users to manage all their apps.
- **Entry-point card:** When a user signs in from a specific app (e.g. AMRAP), the account page displays a **prominent card for that app**—e.g. "You signed in from AMRAP. Continue to your session" or "Return to AMRAP" with a clear CTA. This acknowledges where they came from and offers a quick return path.
- **App launcher:** Grid of all apps (AMRAP, Tabata, Daily Warm-Up, Programs, etc.) so users can jump to any timer or feature.
- **Single place** to see and access everything tied to their account.

#### 3. HUD as Workout Management Hub

- **Role:** The HUD (Heads Up Display) is where users manage workouts from **all apps**.
- **Content:** Today's workouts, schedule, recent progress, history—aggregated from AMRAP, Programs, and other sources.
- **Account → HUD link:** The account page should link clearly to the HUD (e.g. "Manage your workouts" or "Open HUD") so users understand that the HUD is the central place for workout management across apps.

#### Flow Summary

| Step | User action | Result |
|------|-------------|--------|
| 1 | Signs in from any app (AMRAP, Tabata, etc.) | Shared auth component; redirect to `/account` with `?from=amrap` (or similar) |
| 2 | Lands on account page | Sees entry-point card for AMRAP (or whichever app they came from); app launcher; HUD link |
| 3 | Wants to manage workouts | Clicks "Open HUD" → HUD shows today, schedule, history from all apps |
| 4 | Wants to use another app | Clicks app card in launcher → navigates to that app |

### Recommendation: Balanced Model

- **Keep** central profile and subscription in `apps/app` / Supabase. One source of truth.
- **Extract** shared auth component for the monorepo; deprecate app-specific AuthModals in favor of the shared one.
- **Update** account page: entry-point card + app launcher + HUD link.
- **Clarify** in UX: "Create an account to unlock features across all your timers" and "Manage all your workouts in the HUD."

---

## Summary

The AMRAP With Friends auth flow keeps core actions (create, join) account-free and uses a single modal for login/signup with clear value messaging. Main weaknesses are the hard redirect to `/account` after login, use of `alert()` for sign-up success, and limited guidance for password and upgrade limits. Opportunities center on shared auth standardization, account page as app management hub, and improved feedback. Threats are mostly configuration-related: Supabase redirects, env vars, and dev vs prod handoff differences.

**Integration:** AMRAP shares Supabase Auth and `profiles` with `apps/app`. Login always sends users to the central account page. Other timer apps (Tabata, EMOM, etc.) have no in-app auth and depend on users reaching `/account` from the landing page or nav.

**Target state:** (1) Extract a shared auth component (`@interval-timers/auth-ui`) for all apps. (2) Account page displays an entry-point card for the app the user signed in from, plus an app launcher and HUD link. (3) HUD is the central place to manage workouts from all apps. The account page becomes the landing for managing all apps; the HUD becomes the workout management hub.
