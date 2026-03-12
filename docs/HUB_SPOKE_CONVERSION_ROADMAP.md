# Hub-and-Spoke Conversion Workflow — Phased Roadmap

Detailed implementation plan for the reverse-trial conversion model. The landing page and 14 timer apps are the **spokes**; the account app is the **hub**. Conversion weight rests on the handoff from timer → account.

---

## Executive Summary

| Phase | Focus | Timeline | Dependencies |
|-------|--------|----------|--------------|
| **1** | URL contract & handoff payload | 1–2 weeks | None |
| **2** | Contextual unauthenticated view | 1–2 weeks | Phase 1 |
| **3** | Session prefill & immediate TTV | 2–3 weeks | Phase 1, 2; DB schema |
| **4** | SSO & friction reduction | 2–3 weeks | Supabase config |
| **5** | Reverse trial infrastructure | 2 weeks | DB; Phase 3 |
| **6** | Activation analytics & optimization | Ongoing | Phase 5 |

---

## Phase 1: URL Contract & Handoff Payload

**Goal:** Define and implement the timer → account handoff so the hub receives actionable context.

### 1.1 URL parameter specification

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `intent` | string | Yes | User action: `save_session`, `view_stats`, `unlock_schedule`, etc. |
| `source` | string | Yes | Timer app ID: `tabata`, `amrap`, `emom`, `daily-warm-up`, etc. |
| `from` | string | Yes | Same as source; used for entry-point card. Keep for backwards compat. |
| `time` | string | No | Session duration, e.g. `15m` or `900` (seconds) |
| `calories` | number | No | Estimated calories (if computed) |
| `rounds` | number | No | Rounds completed (AMRAP, EMOM) |
| `preset` | string | No | Protocol preset ID for logging |

**Example:** `/account?intent=save_session&source=tabata&from=tabata&time=15m&calories=200`

### 1.2 Spoke implementation

- [ ] **Shared utility:** Create `packages/shared` or `lib/handoff` with `buildAccountRedirectUrl(intent, source, payload)` that appends all params.
- [ ] **AMRAP:** Replace `AccountLink` / `ACCOUNT_REDIRECT_URL` usage for "Save Workout" / "View Stats" flows with the new builder. Pass session duration, rounds, etc. when available.
- [ ] **Tabata:** Add "Save Workout" / "View Stats" CTA in post-session UI; link to account with `intent=save_session&source=tabata&time=X&calories=Y`.
- [ ] **Other timers:** Roll out to EMOM, Daily Warm-Up, Wingate, etc. — at least 3 spokes for Phase 2 validation.
- [ ] **Landing:** Ensure Account link uses `?from=landing`; add `landing` to app registry.

### 1.3 Hub: Parse and store handoff

- [ ] **AccountLanding:** On mount, parse URL params into state: `intent`, `source`, `time`, `calories`, `rounds`, etc.
- [ ] **Session storage:** Persist handoff payload to `sessionStorage` with a short TTL (e.g. 5 min) so it survives redirect after auth. Key: `account_handoff` or `auth_pending_session`.
- [ ] **Cleanup:** Clear handoff from storage after successful processing or on explicit dismiss.

### 1.4 Validation

- [ ] Unit tests for `buildAccountRedirectUrl`.
- [ ] Manual: Click "Save Workout" in Tabata → land on `/account` with params visible; refresh → params persist until auth flow completes.

**Deliverable:** Consistent handoff from spokes to hub; hub can read and persist `intent`, `source`, and session payload.

---

## Phase 2: Contextual Unauthenticated View

**Goal:** Replace generic "Sign in to your account" with a conversion-optimized, contextual message.

### 2.1 Copy matrix

| `intent` | `source` | Headline | Subtext |
|----------|----------|----------|---------|
| `save_session` | tabata | "Incredible work. Save your Tabata session to your permanent record." | "Create your free profile to unlock your HUD and get unrestricted access to all 14 pro timers and lifestyle challenges." |
| `save_session` | amrap | "Well done. Log your AMRAP rounds and track your progress." | Same |
| `save_session` | * | "Save your workout to your permanent record." | Same |
| `view_stats` | * | "View your stats and track your progress." | Same |
| (none) | landing | "Sign in to unlock your profile." | Same |
| (none) | * | "Sign in to your account." | "Log in or create an account to manage your apps and workouts." |

### 2.2 Dynamic hook component

- [ ] **AccountLanding (unauthenticated):** Branch on `intent` + `source` to render the appropriate headline and subtext.
- [ ] **Time/duration insertion:** If `time` exists, insert into copy: "Save your 15-minute Tabata session…"
- [ ] **Source-specific flair:** Optional icon or badge per `source` (e.g. Tabata flame, AMRAP timer).

### 2.3 Value expansion block

- [ ] Add a short value block below the hook: "Create your free profile to unlock:"
  - "Your personal Heads Up Display (HUD)"
  - "All 14 pro timers + lifestyle challenges"
  - "Permanent workout history"
- [ ] Style: bullet list or icon row; keep minimal to reduce scroll.

### 2.4 Loss aversion framing

- [ ] Add one line above CTA: "Don't lose this workout — create your free profile to save it."
- [ ] Or: "Your session is ready to save. Create your free profile to add it to your record."
- [ ] A/B test copy variants later; ship one for MVP.

### 2.5 Auth CTA placement

- [ ] Primary: "Create free profile" (sign-up first) for `intent=save_session`; "Log in" for other intents.
- [ ] Secondary: "Log in" / "Create account" toggle.
- [ ] Ensure AuthModal opens with `fromAppId` = `source` so post-login redirect preserves context.

**Deliverable:** Unauthenticated account page shows contextual headline, value expansion, loss-aversion line, and appropriate auth CTAs.

---

## Phase 3: Session Prefill & Immediate TTV

**Goal:** When the user signs up or logs in from a handoff, their session is *already* logged — no manual entry.

### 3.1 Handoff payload schema

- [ ] Define `HandoffPayload` type: `{ intent, source, time?, calories?, rounds?, preset?, timestamp }`.
- [ ] Validate on hub; reject malformed or stale payloads (e.g. > 30 min).

### 3.2 API / Edge function

- [ ] **Endpoint:** `POST /api/log-handoff` or Supabase Edge Function `log_handoff`.
- [ ] **Input:** `HandoffPayload` + `user_id` (after auth).
- [ ] **Logic:** Map `source` + `preset` to workout type; insert into `workout_logs` or equivalent. Use `time`, `calories`, `rounds` where applicable.
- [ ] **Idempotency:** Hash of `user_id + intent + source + timestamp` to avoid duplicates if user refreshes.

### 3.3 Client flow

- [ ] **After auth success:** Before redirect (or in `onAuthStateChange`), check for `account_handoff` in sessionStorage.
- [ ] If present: call API with payload + `user_id`; clear storage; then proceed to account or HUD.
- [ ] **AuthModal / auth-ui:** Accept optional `onAuthSuccess` callback or emit event; hub listens and triggers prefill.

### 3.4 Dashboard "immediate win"

- [ ] **AccountLanding (authenticated):** If handoff was just processed, show a confirmation: "Your Tabata session has been saved." with link to HUD or workout history.
- [ ] **HUD:** Ensure new log appears in feed without refresh (or with minimal delay).
- [ ] **Fallback:** If API fails, show "We couldn't save your session automatically. You can log it from the HUD." — avoid dead-end.

### 3.5 Workout log schema

- [ ] Verify `workout_logs` (or equivalent) supports: `user_id`, `workout_type`/`source`, `duration`, `calories`, `rounds`, `created_at`.
- [ ] Add migration if needed for new fields.
- [ ] Map `source` → internal workout type (e.g. `tabata` → `Tabata`, `amrap` → `AMRAP`).

**Deliverable:** User completes Tabata → clicks "Save Workout" → signs up → lands on account with "Your Tabata session has been saved" + visible in HUD.

---

## Phase 4: SSO & Friction Reduction

**Goal:** Add Google/Apple SSO to maximize conversion; reduce form-field friction.

### 4.1 Supabase auth providers

- [ ] Enable Google and Apple in Supabase Dashboard → Authentication → Providers.
- [ ] Configure OAuth redirect URLs (e.g. `https://hiitworkouttimer.com/account`, `http://localhost:3006/account`).
- [ ] Add provider-specific env vars if needed (Apple Service ID, etc.).

See [SUPABASE_OAUTH_SETUP.md](./SUPABASE_OAUTH_SETUP.md) for detailed steps.

### 4.2 AuthModal SSO buttons

- [x] **auth-ui:** Add "Continue with Google" and "Continue with Apple" buttons above email/password form.
- [x] Use `supabase.auth.signInWithOAuth({ provider: 'google' })` with `redirectTo` = account URL + `?from=` + handoff params.
- [x] Preserve handoff in redirect URL or sessionStorage before OAuth redirect; restore on return.

### 4.3 Handoff preservation across OAuth

- [x] **Before OAuth:** Serialize handoff to `sessionStorage`; include `redirectTo` with `intent`, `source`, etc. in fragment or query.
- [x] **After OAuth redirect:** Supabase adds hash params; hub reads session, checks for handoff in storage, processes prefill, clears storage.
- [x] **Edge case:** User abandons OAuth; handoff stays until TTL or manual clear.

### 4.4 Form field audit

- [x] **Sign-up:** Keep only email, password, (optional) name. Remove any non-essential fields.
- [x] **Placeholder / copy:** "Email" and "Password" only; add "At least 6 characters" for password.
- [x] **Error handling:** Inline, non-blocking; avoid alert/toast for recoverable errors where possible.

**Deliverable:** SSO buttons in AuthModal; handoff survives OAuth round-trip; minimal sign-up form.

---

## Phase 5: Reverse Trial Infrastructure

**Goal:** Surface trial status and drive activation during the 7-day window.

### 5.1 Trial data model

- [ ] **Profile:** Ensure `trial_ends_at` (or equivalent) exists for all users. Set on first sign-up: `trial_ends_at = now() + 7 days`.
- [ ] **Programs / AMRAP:** Extend trial logic to hub if currently only in AMRAP. Single source of truth: `profiles.trial_ends_at`.

### 5.2 Trial banner component

- [ ] **AccountLanding / AppIslands:** When `trial_ends_at` is in the future, show a banner: "Pro Access Unlocked — X days, Y hours remaining."
- [ ] **Style:** Subtle, non-intrusive; sticky top or inline above app launcher. Dismissible? Optional for MVP.
- [ ] **Logic:** `const remaining = trial_ends_at - now()`; format as "6d 23h" or "6 days, 23 hours."

### 5.3 App launcher trial badge

- [ ] **App registry / launcher:** When in trial, show a small "Unlocked" or "Pro" badge on each app card.
- [ ] **Copy:** "All 17 apps fully unlocked during your trial."
- [ ] **Post-trial:** Replace with upgrade CTA or lock icon for gated apps (future phase).

### 5.4 Activation metric schema

- [ ] **New table or columns:** `user_activation_events` or extend `profiles` with `first_hub_timer_launched_at`, `second_hub_timer_launched_at`.
- [ ] **Definition:** "Launched from hub" = user navigated from account/HUD app launcher to a timer, then loaded that timer.
- [ ] **Tracking:** On timer app load, check `document.referrer` or pass `?from_hub=1` when linking from launcher; record server-side or via Supabase function.

### 5.5 Activation milestone events

- [ ] **First timer from hub:** Log `activation_first_timer_at`.
- [ ] **Second timer from hub (within 48h):** Log `activation_second_timer_at`.
- [ ] **Conversion prediction:** Flag users with `activation_second_timer_at` for higher likelihood to convert at trial end (for retention campaigns).

**Deliverable:** Trial banner, unlocked badges on app launcher, activation events logged for 2-timer-in-48h cohort.

---

## Phase 6: Activation Analytics & Optimization

**Goal:** Measure and optimize the conversion loop.

### 6.1 Funnel events

- [ ] **Spoke:** `timer_session_complete`, `timer_save_click`, `timer_view_stats_click`.
- [ ] **Handoff:** `account_land_handoff` (with `intent`, `source`).
- [ ] **Auth:** `account_signup_start`, `account_signup_complete`, `account_login_complete`.
- [ ] **TTV:** `account_session_prefill_success`, `account_session_prefill_fail`.
- [ ] **Activation:** `hub_timer_launch_1`, `hub_timer_launch_2` (within 48h).

### 6.2 Analytics integration

- [ ] Choose backend: Supabase + `analytics_events` table, or external (PostHog, Mixpanel, etc.).
- [ ] Emit events from hub and spokes; include `user_id` when authenticated, `session_id` when not.
- [ ] Ensure no PII in event payloads unless required and compliant.

### 6.3 Dashboard / reporting

- [ ] **Funnel:** Handoff rate, sign-up rate, prefill success rate, activation rate (2 timers in 48h).
- [ ] **By source:** Conversion by `source` (tabata, amrap, etc.) to prioritize high-performing spokes.
- [ ] **Cohort:** Users who activated vs. didn’t; trial-to-paid conversion by cohort.

### 6.4 A/B testing (later)

- [ ] Copy variants for unauthenticated view (headline, loss aversion).
- [ ] SSO placement (above vs. below form).
- [ ] Trial banner copy and position.

**Deliverable:** Event schema, funnel tracking, basic dashboard, foundation for A/B tests.

---

## Phase Summary

| Phase | Key deliverables | Success metric |
|-------|------------------|----------------|
| **1** | URL contract, handoff builder, spoke CTAs, hub parsing | Handoff params present on account load from spokes |
| **2** | Contextual copy, value block, loss aversion, dynamic CTAs | Reduced bounce on unauthenticated account page |
| **3** | Prefill API, client flow, dashboard confirmation | Session auto-logged after sign-up from handoff |
| **4** | Google/Apple SSO, handoff across OAuth | Higher sign-up completion rate |
| **5** | Trial banner, app badges, activation events | 2-timer-in-48h cohort identifiable |
| **6** | Funnel events, dashboard | Funnel visibility; optimization opportunities |

---

## Dependencies & Prerequisites

- **Supabase:** Auth providers, redirect URLs, `workout_logs` (or equivalent) schema.
- **Monorepo:** Shared packages for `buildAccountRedirectUrl` and optionally handoff types.
- **App registry:** `landing` and all timer IDs for `source` / `from` resolution.
- **Existing:** auth-ui, AccountLanding, app launcher, HUD (per ROADMAP_AUTH_AND_ACCOUNT_REFACTOR.md).

---

## Suggested Execution Order

1. **Phase 1** — Foundation; no DB changes.
2. **Phase 2** — Pure frontend; can ship with Phase 1.
3. **Phase 3** — Requires API + schema; start in parallel with Phase 4.
4. **Phase 4** — SSO can proceed independently.
5. **Phase 5** — Depends on trial model; can overlap with Phase 3/4.
6. **Phase 6** — Instrument as each phase ships; iterate.

---

## References

- [ROADMAP_AUTH_AND_ACCOUNT_REFACTOR.md](./ROADMAP_AUTH_AND_ACCOUNT_REFACTOR.md) — Auth standardization and account page rebuild
- [ACCOUNT_URL_INVESTIGATION.md](./ACCOUNT_URL_INVESTIGATION.md) — Redirect and env configuration
- [app-registry](../../apps/app/src/lib/app-registry.ts) — App IDs for `source` / `from` mapping
