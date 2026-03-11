# Roadmap: Auth Standardization & Account Page Refactor

Phased plan to standardize auth across the monorepo and rebuild the account page as the app management landing. Based on [AMRAP_AUTH_WORKFLOW_SWOT.md](./AMRAP_AUTH_WORKFLOW_SWOT.md).

**Context:** The account page is currently broken and unusable. This refactor does **not** require backward compatibility; we can ship a clean replacement.

---

## Goals

1. **Shared auth** — One auth UI package used by all apps (AMRAP, app, Tabata, EMOM, etc.); same modal, validation, errors, redirect behavior.
2. **Account page as hub** — Rebuild `/account` as the landing to manage all apps: entry-point card for the app the user signed in from, app launcher, and clear link to the HUD.
3. **HUD as workout hub** — Account page links clearly to the HUD so users manage workouts from all apps in one place.
4. **Entry-point awareness** — Redirect to `/account?from=<appId>` so the account page can show a “Return to [App]” card.

---

## Out of Scope (Later)

- Magic link / OAuth (e.g. Sign in with Google)
- Backward-compatible migration of existing account URLs
- Per-app subscription or paywall UI (profile/entitlements stay as-is)

---

## Phase 1: Shared Auth Package

**Goal:** Create a single auth UI package; one implementation for login/signup used by all apps.

### 1.1 Create package

- [ ] Add `packages/auth-ui` (or `@interval-timers/auth-ui` in workspace).
- [ ] Package depends only on React and Supabase client (peer or direct). No app-specific code.
- [ ] Export: `AuthModal` component and optionally a small `useAuthRedirect` helper for building redirect URLs.

### 1.2 AuthModal API

- [ ] Props: `isOpen`, `onClose`, `defaultSignUp?`, `redirectBaseUrl` (e.g. `/account` or full account URL), `returnUrl?` (optional stay-in-app return), `fromAppId?` (e.g. `amrap`, `tabata`) for `?from=` on redirect.
- [ ] On successful sign-in: redirect to `redirectBaseUrl` with `?from=${fromAppId}` (and `returnUrl` in query if provided).
- [ ] On successful sign-up: no redirect (user unconfirmed); show **in-modal success** (“Check your email…”) and a close button. Remove `alert()`.

### 1.3 UX parity and improvements

- [ ] Same error handling as current AMRAP modal: “Wrong email or password”, “Please confirm your email…”, generic message fallback.
- [ ] Accessibility: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, Escape to close.
- [ ] Add password visibility toggle (show/hide).
- [ ] Optional: client-side password hints (length/complexity) to reduce Supabase rejections.

### 1.4 Sign-up payload

- [ ] `signUp` options: `data: { full_name, role: 'client' }` to match existing profile trigger. No behavior change for backend.

### 1.5 Documentation

- [ ] README in package: how to use in Vite vs Astro apps, env vars (`VITE_ACCOUNT_REDIRECT_URL` or equivalent), `redirectBaseUrl` and `fromAppId` usage.

**Deliverable:** A package that any app can import and render; redirects to account URL with `?from=` and optional `returnUrl`.

---

## Phase 2: Rebuild Account Page

**Goal:** Replace the broken account experience with the new design. No compatibility with old account behavior.

### 2.1 Route and shell

- [ ] Ensure `/account` is served by the app (existing route); replace the current account page component with the new implementation.
- [ ] Unauthenticated: show a clear “Sign in to your account” state and open the shared AuthModal (from Phase 1). No redirect to `?signin=1` if we can open modal directly from account page.

### 2.2 Entry-point card

- [ ] Read `from` (or `fromAppId`) from URL query, e.g. `?from=amrap`.
- [ ] If present, render a **prominent card** at the top: e.g. “You signed in from AMRAP” with a CTA “Continue to AMRAP” / “Return to AMRAP” linking to the app’s path (e.g. `/amrap` or `/with-friends`).
- [ ] If absent, show a generic welcome card or omit; no broken state.

### 2.3 App launcher

- [ ] Define a **single app registry** (id, name, path, short description) used for the launcher and for entry-point card copy. e.g. `{ id: 'amrap', name: 'AMRAP', path: '/amrap', description: 'With Friends' }`.
- [ ] Render a grid of app cards from the registry (AMRAP, Tabata, Daily Warm-Up, Programs, etc.) so users can jump to any app.
- [ ] Style consistent with existing design system (e.g. cards, hover states).

### 2.4 HUD link

- [ ] Add a clear primary or secondary CTA: “Manage your workouts” or “Open HUD” that opens the HUD (existing HUD entry point in the app).
- [ ] Short line of copy: e.g. “Manage workouts and schedule from all your apps in one place.”

### 2.5 Logged-in layout

- [ ] Hero/header: “Your Account” and one line describing the page as the place to manage all apps.
- [ ] Order: entry-point card (if `?from=`) → HUD CTA → app launcher. Or: entry-point card → app launcher → HUD section.
- [ ] Remove or replace any broken feed/legacy content that doesn’t work.

**Deliverable:** Account page that works for logged-in users (entry-point card, app launcher, HUD link) and shows sign-in for guests.

---

## Phase 3: Wire Apps to Shared Auth and Redirect

**Goal:** Every app that has (or should have) auth uses the shared package and redirects to `/account?from=<appId>`.

### 3.1 apps/app (hub)

- [ ] Replace existing `AuthModal` in AppIslands (or wherever used) with the shared auth package component.
- [ ] Configure: `redirectBaseUrl` = `/account`, `fromAppId` = `app` (or `hub`). After login, redirect to `/account?from=app`.
- [ ] Keep trainer/admin redirect logic: if profile role is trainer/admin, redirect to `/trainer` or admin as today; otherwise `/account?from=app`.
- [ ] Ensure account page uses the same shared AuthModal when unauthenticated (e.g. from AppIslands or embedded in account route).

### 3.2 apps/amrap

- [ ] Remove local `AuthModal`; use shared auth package.
- [ ] Redirect after login: `/account` with `?from=amrap` (use `VITE_ACCOUNT_REDIRECT_URL` + `?from=amrap` when applicable).
- [ ] Optional: when opening auth from “Schedule for later”, pass `returnUrl` so after login user can land back on AMRAP with-friends (if desired; else keep redirect to account).
- [ ] Replace `AccountLink` usage: either use a small link component from the shared package that points to account URL and handles token handoff in dev, or keep a thin local `AccountLink` that links to the same account URL. Ensure “My Account” / “Account” still work.

### 3.3 Other timer apps (at least one)

- [ ] Add shared auth to at least one other timer app (e.g. Tabata): “Log in” / “Create account” in header or nav that opens shared AuthModal and redirects to `/account?from=tabata`.
- [ ] Ensures pattern works for Vite-based timer apps and validates the package contract.

### 3.4 App registry and entry-point copy

- [ ] Ensure app registry (Phase 2) includes every app that can pass `fromAppId` so the account page can resolve names and links for the entry-point card (e.g. `from=amrap` → “AMRAP”, link to `/amrap` or `/with-friends`).

**Deliverable:** AMRAP and app use shared auth; redirects include `?from=`. At least one other timer app offers login that redirects to account with `?from=`.

---

## Phase 4: Config, Env, and Polish

**Goal:** Centralize config, document env, and fix remaining UX issues.

### 4.1 App registry as single source

- [ ] App registry (id, name, path, description) lives in one place (e.g. `apps/app` or a small shared config package). Account page and any app that needs “friendly name” for redirects import or read from it.
- [ ] Add any missing apps so the launcher and entry-point card cover all 17+ apps where appropriate.

### 4.2 Environment and redirect URLs

- [ ] Document in README or `docs/`: `VITE_ACCOUNT_REDIRECT_URL` (and `VITE_HUD_REDIRECT_URL` fallback) for timer apps; account app base URL for same-origin/cross-origin.
- [ ] Supabase Dashboard: redirect URL list includes `/account`, `/account?from=*`, and any app origins. No backward compatibility required; list can be minimal and correct for the new flow.
- [ ] Dev: token-in-URL handoff for cross-origin (AMRAP → account) remains supported; document when it’s used (e.g. dev only).

### 4.3 Remove legacy auth UX

- [ ] Remove any remaining `alert()` for auth success; use in-modal success only.
- [ ] Remove or deprecate duplicate AuthModal implementations once all consumers use the shared package.

### 4.4 HUD and copy

- [ ] Confirm HUD entry point (e.g. nav “You” or “HUD”) and that “Open HUD” / “Manage your workouts” on the account page goes to the right place.
- [ ] Short copy pass: account page hero, entry-point card, HUD CTA, and app launcher labels.

**Deliverable:** Single app registry, documented env and Supabase redirects, no legacy auth alerts, clear HUD link and copy.

---

## Phase Summary

| Phase | Focus | Deliverable |
|-------|--------|-------------|
| **1** | Shared auth package | `packages/auth-ui` with AuthModal; redirect with `?from=` and optional `returnUrl`; no `alert()`. |
| **2** | Account page rebuild | New account page: entry-point card, app launcher, HUD link; works when logged in and shows sign-in when not. |
| **3** | Wire apps to shared auth | app + AMRAP + at least one other timer use shared auth; redirect to `/account?from=<appId>`. |
| **4** | Config and polish | App registry, env/docs, no legacy alerts, HUD copy. |

---

## Dependencies

- **Phase 2** can start in parallel with Phase 1 if the account page is implemented with a placeholder or in-app AuthModal until the package exists; then swap in the shared component in Phase 3.
- **Phase 3** depends on Phase 1 (package exists) and preferably Phase 2 (account page exists so redirects land somewhere correct).
- **Phase 4** can be done incrementally; app registry is needed by Phase 2 for the entry-point card and launcher.

---

## Reference

- [AMRAP_AUTH_WORKFLOW_SWOT.md](./AMRAP_AUTH_WORKFLOW_SWOT.md) — Strengths, weaknesses, opportunities, threats, integration with `apps/app`, and target architecture (shared auth, account hub, HUD as workout hub).
