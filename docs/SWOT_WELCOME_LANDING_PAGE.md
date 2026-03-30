# SWOT analysis: `/welcome` landing experience

**Scope:** The public welcome flow implemented by `WelcomeInviteLanding` / `WelcomeInviteInner`, the `welcome.astro` page shell, supporting APIs (`/api/invitations/preview`, `/api/invitations/accept`, `/api/welcome/trainer-display`), and `WelcomeSchedulePreview`.

**Date:** March 30, 2026

---

## Mitigations implemented (March 2026)

- **Pragmatic SSR for trainer teaser:** [`welcome.astro`](apps/app/src/pages/welcome.astro) calls `getCurrentUserFromRequest` and, when there is no `?invite=` query param, `getTrainerDisplayForWelcomeClient` + `trainerFirstNameForWelcome`, then passes `initialTrainerFirstName` and `ssrSessionUserId` into `WelcomeInviteLanding`. The client only applies those props when `uid === ssrSessionUserId`, then refetches with `activeProgramId` so local “current program” wins after hydration.
- **Unified welcome-back loading:** For logged-in users without an invite token, `showWelcomeBackSkeleton` gates hero subline + schedule region until auth finishes **and** `GET /api/welcome/trainer-display` settles. [`WelcomeWelcomeBackHeroSkeleton`](apps/app/src/components/react/WelcomeWelcomeBackSkeleton.tsx) / [`WelcomeWelcomeBackScheduleSkeleton`](apps/app/src/components/react/WelcomeWelcomeBackSkeleton.tsx) mirror layout so the real [`WelcomeSchedulePreview`](apps/app/src/components/react/WelcomeSchedulePreview.tsx) mounts only after personalization completes; the schedule card still shows its own spinner while calendar data loads.
- **Schedule event-type i18n:** Badge labels use [`welcome-landing-strings.ts`](apps/app/src/lib/welcome-landing-strings.ts) (`scheduleEventProgram`, `scheduleEventAmrap`, `scheduleEventTimer`, `scheduleEventOther`) for EN/ES.
- **Multi-program selection:** [`getWelcomeClientTrainerContext`](apps/app/src/lib/supabase/admin/welcome-trainer.ts) / [`getTrainerDisplayForWelcomeClient`](apps/app/src/lib/supabase/admin/welcome-trainer.ts) accept optional `preferredProgramId` (must match an active enrollment). Ordering otherwise uses `trainer_assigned` → `cohort` → `self`, then newest `created_at`. [`trainer-display`](apps/app/src/pages/api/welcome/trainer-display.ts) reads `?programId=` and returns `firstName`, `studio`, and `activeProgramCount`; the client passes `AppContext`’s `activeProgramId`.
- **Static HTML shell + prefetch ( `/welcome` only):** [`WelcomeStaticShell.astro`](apps/app/src/components/astro/WelcomeStaticShell.astro) renders a fixed hero frame (invite vs logged-in vs missing-token) with variant-**a** copy for crawlers/no-JS; [`WelcomeInviteLanding`](apps/app/src/components/react/WelcomeInviteLanding.tsx) removes `#welcome-static-shell` on mount. [`BaseLayout.astro`](apps/app/src/layouts/BaseLayout.astro) exposes `<slot name="head" />`; `welcome.astro` injects `rel="prefetch"` for `/`.
- **Logged-in studio branding:** [`welcome-trainer.ts`](apps/app/src/lib/supabase/admin/welcome-trainer.ts) resolves the trainer profile’s `studio_id` → `studios` row (same shape as invite preview). Accent, logo, name, and tagline apply on the welcome-back path when no invite preview is shown; SSR props align with the trainer-display API after hydration.
- **Schedule + locale polish:** [`WelcomeSchedulePreview`](apps/app/src/components/react/WelcomeSchedulePreview.tsx) adds a non-empty-state footer link to the app (`cta_open_app` / `schedule_footer`). [`welcome-landing-strings.ts`](apps/app/src/lib/welcome-landing-strings.ts) adds **French** (`fr`) and strings for multi-program hint + full-calendar CTA.

**Residual gaps:** Vanity invite URLs (`/s/{slug}/i/{token}`) still mount React without the Astro static shell. Invite tokens restored only from `sessionStorage` remain invisible to the server. The teaser still uses `trainerFirstNameForWelcome` (first token of display string); usernames and name-order edge cases are unchanged. No in-page program picker beyond copy + `activeProgramId` sync.

---

## Strengths

- **One surface, two jobs:** The same page cleanly supports roster invite acceptance (query param, vanity path `/s/{slug}/i/{token}`, and `sessionStorage` handoff) and a **logged-in “welcome back”** mode with calendar teaser—reducing navigation fragmentation for new and returning clients.

- **Security-aware data access:** Invite previews prefer a scoped `SECURITY DEFINER` RPC (`get_roster_invite_preview_core`) so unauthenticated callers are not forced to broaden RLS or over-select PII; friend invites omit invitee contact in the public JSON shape. Trainer display for the logged-in hero uses **server-side** resolution (`getTrainerDisplayForWelcomeClient` + service client) so the browser does not need to read another user’s `profiles` row under RLS.

- **Graceful degradation:** If the trainer-display API fails or returns no enrollment, the hero falls back to the generic calendar subcopy (`heroCopy.subCalendarTeaser`). The API intentionally returns `200` with `firstName: null` on errors to avoid brittle client error UI for a non-critical teaser.

- **Product instrumentation:** Analytics hooks cover `landing_view` (token / path / invite kind), `invite_accept_success`, `calendar_preview_view`, and `cta_open_app` from schedule empty and post-accept surfaces—enough to reason about funnel drop-offs.

- **Localization foundation:** EN/ES/FR strings for landing and schedule copy are centralized (`welcome-landing-strings.ts`), with locale persisted for repeat visits.

- **Schedule preview alignment:** `WelcomeSchedulePreview` reuses the same calendar pipeline as the app (`getUnifiedCalendarEvents`, program load, completion map), so the read-only week view stays consistent with in-app scheduling rather than a one-off mock.

- **Accessible structure (partial):** The schedule card uses a real section heading with `aria-labelledby` (`welcome-schedule-heading`), which helps screen-reader users orient on the “Next 7 days” block.

---

## Weaknesses

- **Client-heavy primary island:** The interactive card is still `client:load`, but `/welcome` now ships a **static hero shell** ahead of the island; vanity paths and deep invite flows remain island-first.

- **Copy and variant coupling:** Hero title/subcopy come from `getWelcomeHeroCopy(heroVariant)` while the personalized trainer line uses a **separate** string (`welcomeLoggedInTrainerTeaser`). Product tone can drift between A/B hero variants and the trainer-personalized branch unless curated together.

- **Cookie/session coupling for APIs:** `authenticateInvitationsApiRequest` expects a bearer token or `sb-access-token` cookie. Any mismatch between how the SPA stores the session and what the browser sends on `fetch(..., { credentials: 'include' })` results in 401s or missing personalization—without a user-visible explanation on the welcome page.

- **“First name” heuristic:** `trainerFirstNameForWelcome` uses the first whitespace-separated token of the resolved display string. That works for `"Jane Doe"` but is less ideal for usernames, mononyms, or locales with different name order conventions.

---

## Opportunities

- **Full static shell or SSR markup:** Render a non-React hero frame and skeleton from Astro so LCP and SEO body text improve beyond serialized props; hint invitation vs welcome-back from URL and cookies.

- **Deeper studio branding for clients:** Invite flow already surfaces studio logo, colors, and tagline when preview includes studio data. Extending consistent branding for **logged-in** clients (e.g., from the same trainer/studio resolution path) could strengthen coach–client continuity.

- **Richer schedule CTA:** The empty state links to `/` with analytics; deep links into **planning** or **today’s workout** (when inferable) could shorten time-to-value.

- **More locales:** Extend `WelcomeLocale` beyond EN/ES for full parity on welcome + schedule strings.

- **Optional disambiguation UI:** If multiple active enrollments remain confusing, a small in-page chooser (only when ambiguous) could complement `activeProgramId` from storage.

- **Prefetch / warm connections:** Optional prefetch of critical app routes or APIs when the welcome page loads could make “Open app to plan” feel instant on repeat visits.

---

## Threats

- **Invite token exposure:** Tokens appear in query strings and vanity paths. Misconfigured referrers, shared screenshots, or browser history could leak tokens; mitigations elsewhere (short-lived invites, hashing server-side) are critical—this page increases the **visibility** of that asset class.

- **Silent failure modes:** Trainer personalization and schedule loading can fail “quietly” (generic copy, empty or error state). Users may assume the product is impersonal or broken rather than experiencing a recoverable network or auth issue—support burden and trust risk.

- **Service-role dependency:** Server routes that bypass RLS for trainer display depend on correct **server key hygiene** and deployment configuration. A misconfigured or leaked service role key is a systemic risk for any feature built this way—not unique to welcome, but concentrated where multiple admin-style reads exist.

- **Auto-accept complexity:** The effect that POSTs `/api/invitations/accept` when a session exists and a token is present must stay correct across race conditions (navigation away, token change, double mount in strict mode). Bugs here could cause confusing partial states or duplicate attempts.

- **Privacy and messaging norms:** Showing a trainer’s name in the hero assumes users are comfortable with that association on a shared device; the page does offer sign-out, but there is no “not you?” copy adjacent to the personalized line.

- **Third-party storage and cookie policies:** `sessionStorage` for invite handoff fails in some private modes (already guarded); broader browser privacy features could affect session cookies or cross-site contexts if the app’s hosting model changes.

---

## Summary

The `/welcome` experience is **architecturally strong** on data access boundaries (RPC + server trainer resolution, scoped invite PII) and **product-strong** on covering invite + post-login calendar context in one place with analytics. **March 2026 updates** added Astro-fed initial trainer props (no-`?invite=` path), a coordinated skeleton for auth-plus-personalization, localized schedule event badges, deterministic multi-program resolution, a static HTML shell + home prefetch on `/welcome`, logged-in studio theming, schedule footer CTA, French copy, and a multi-program hint when `activeProgramCount > 1`. Remaining gaps include **parity static shell on vanity invite URLs**, the **first-name teaser heuristic**, **session/cookie** edge cases without in-UI explanation, and **silent** failure modes for optional personalization.
