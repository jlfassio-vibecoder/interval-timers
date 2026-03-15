# Admin Analytics Tab — Phased Roadmap

This roadmap adds an **Analytics** tab to the admin dashboard and builds out high-value analytics in phases, aligned with the Supabase-backed design (acquisition, activation, engagement, retention, monetization). It builds on the existing **Funnel** tab and **analytics_events** table.

**Current state**
- Admin nav: [apps/app/src/lib/admin/navigation.ts](apps/app/src/lib/admin/navigation.ts) — add Analytics item.
- Routes: [apps/app/src/components/react/admin/AdminDashboard.tsx](apps/app/src/components/react/admin/AdminDashboard.tsx) — add `/analytics` → AnalyticsView.
- Funnel: [apps/app/src/components/react/admin/views/FunnelView.tsx](apps/app/src/components/react/admin/views/FunnelView.tsx) + [apps/app/src/lib/supabase/admin/funnel-stats.ts](apps/app/src/lib/supabase/admin/funnel-stats.ts) + GET `/api/admin/funnel-stats`.
- Events: `public.analytics_events` (event_name, user_id, session_id, timestamp, properties jsonb, app_id) — [supabase/migrations/20250314000000_analytics_events.sql](supabase/migrations/20250314000000_analytics_events.sql).

---

## Phase 0: Analytics tab and shell (quick win)

**Goal:** Add the Analytics tab and a single-page shell so the rest of the work has a home.

**Deliverables**
- **Nav:** In `navigation.ts`, add `{ path: '/analytics', label: 'Analytics', icon: BarChart3 }` (or similar from lucide-react). Place after Funnel.
- **Route:** In `AdminDashboard.tsx`, add `Route path="analytics" element={<AnalyticsView />}` and create `AnalyticsView.tsx` under `views/`.
- **AnalyticsView:** Simple layout: title “Analytics”, date-range selector (e.g. last 7 / 30 / 90 days), and placeholder sections for the phase titles below (Acquisition, Auth & onboarding, Engagement, etc.) with “Coming soon” or one simple KPI (e.g. total events in range from `analytics_events`) to prove the API works.
- **API:** Optional: GET `/api/admin/analytics/overview` that returns a minimal payload (e.g. event count in range, distinct users) so the page is data-driven from day one.

**Outcome:** Admins see an Analytics tab and a shell page; no new schema yet.

---

## Phase 1: Acquisition and traffic (foundation)

**Goal:** Unique visitors, referrers/UTM, landing pages, device/browser, and geo.

**Schema**
- **New table:** `web_events` (or extend usage of `analytics_events` with a clear event_name + properties contract).
  - Suggested columns: `id`, `event_name` (e.g. `page_view`), `session_id`, `user_id` (nullable), `path`, `referrer`, `utm_source`, `utm_medium`, `utm_campaign`, `user_agent`, `ip_country` (or geo in properties), `occurred_at`, `properties` jsonb.
- Indexes: `(occurred_at)`, `(user_id, occurred_at)`, optionally `(session_id, occurred_at)`.

**Implementation**
- Migration: create `web_events` (or add columns/event types to existing pipeline).
- Client: lightweight analytics client that sends `page_view` (and optionally `session_start` / `session_end`) with path, referrer, UTM, user_agent; server or Edge Function can add geo from IP if desired.
- API: e.g. GET `/api/admin/analytics/acquisition` that returns:
  - Unique visitors by day/week/month (count distinct session_id or user_id).
  - Top referrers and UTM breakdown (source, medium, campaign).
  - Top landing pages (first path per session).
  - Device/OS/browser mix (parse user_agent or store in properties).
  - Geographic distribution (country/region from ip_country or properties).
- **AnalyticsView:** Add an “Acquisition & traffic” section with charts/cards for the above (e.g. time series of unique visitors, tables for referrers and landing pages).

**Outcome:** Acquisition and traffic KPIs visible in the Analytics tab.

---

## Phase 2: Auth and onboarding funnel (deepen funnel)

**Goal:** Sign-ins/sign-ups by day, conversion funnel (visit → sign_up → email_confirmed → first_action), OAuth vs email mix, time-to-first-key-action, onboarding drop-offs.

**Schema / data**
- Reuse `analytics_events` for auth-related events: `account_signup_complete`, `account_login_complete`, and add/standardize events like `email_confirmed`, `onboarding_step_complete` (with step name in properties).
- Optional: `user_progress` table (user_id, step, completed_at) for onboarding steps if not fully event-based.
- Auth data: use Supabase Auth (e.g. `auth.users` or admin listUsers) for sign-up/sign-in counts by day; join with events for funnel.

**Implementation**
- Backend: ensure auth and onboarding events are emitted (client or Auth webhooks) and stored in `analytics_events` (and `user_progress` if used).
- API: GET `/api/admin/analytics/auth-funnel` returning:
  - Sign-ins and sign-ups by day.
  - Funnel counts: visit → sign_up → email_confirmed → first_action (e.g. first timer_session_complete or hub_timer_launch_1).
  - OAuth vs email/password mix (from Auth or event properties).
  - TTFKA distribution (time from sign_up to first key event).
  - Drop-off by onboarding step (from user_progress or step events).
- **AnalyticsView:** “Auth & onboarding” section with funnel viz, time series, and OAuth mix.

**Outcome:** Auth and onboarding funnel visible alongside (or linked from) the existing Funnel tab.

---

## Phase 3: Engagement (DAU/WAU/MAU, sessions, feature usage)

**Goal:** DAU/WAU/MAU, stickiness (DAU/MAU), session count and duration, pages per session, feature adoption, power-user distribution.

**Schema / data**
- Sessions: either derive from `web_events` (session_start / session_end) or add a `sessions` table (session_id, user_id, started_at, ended_at, device, geo).
- Use `analytics_events` for “key events” (e.g. timer_session_complete, hub_timer_launch_*, project_created, etc.) with a small, defined list.

**Implementation**
- If not already in Phase 1: emit session_start / session_end; compute session duration and pages-per-session server-side or in a materialized view.
- API: GET `/api/admin/analytics/engagement` returning:
  - DAU / WAU / MAU (distinct user_id per day/week/month).
  - Stickiness (DAU/MAU).
  - Session count and average session duration; pages per session if using page_view.
  - Feature adoption: event counts per key event (last 7/30 days).
  - Power-user curve: distribution of key actions per user (e.g. histogram).
- Optional: materialized view `mv_dau_wau_mau` (or equivalent) refreshed on a schedule for speed.
- **AnalyticsView:** “Engagement” section with DAU/WAU/MAU, stickiness, session stats, feature adoption table, and a simple power-user distribution.

**Outcome:** Engagement KPIs and feature usage visible in Analytics.

---

## Phase 4: Retention and cohorts

**Goal:** Cohort retention (e.g. Week 0–12 by signup week), re-engagement after 7/14/30 days inactive, optional notification impact.

**Schema / data**
- Cohorts: derive from `profiles.created_at` (or auth.users) and first-event dates from `analytics_events`.
- Optional: materialized view for weekly cohorts (e.g. signup_week, week_number, retained_count) refreshed by cron or Edge Function.

**Implementation**
- API: GET `/api/admin/analytics/retention` returning:
  - Cohort retention matrix (e.g. signup week × week 0..12 retention %).
  - Re-engagement rate: % of users inactive 7/14/30 days who had an event in the next 7 days.
- **AnalyticsView:** “Retention & cohorts” section with cohort heatmap and re-engagement metrics.

**Outcome:** Retention and cohort views in Analytics.

---

## Phase 5: Monetization (subscriptions, trials, LTV)

**Goal:** Active subscriptions by plan, MRR, churn, trial conversion, time to convert, ARPU, simple LTV heuristic.

**Schema / data**
- If using Stripe: `billing_events` (webhook payloads or normalized events) and `user_subscriptions` (cached current state: user_id, plan, status, current_period_end, etc.).
- Indexes: `billing_events(user_id, occurred_at)`, `user_subscriptions(user_id, current_status)`.

**Implementation**
- Ingest Stripe webhooks into `billing_events`; maintain `user_subscriptions` for current state.
- API: GET `/api/admin/analytics/monetization` returning:
  - Active subs by plan; MRR; churn/expansion/contraction.
  - Trial conversion rate and time-to-convert.
  - ARPU; simple LTV (e.g. ARPU × avg lifetime months).
- **AnalyticsView:** “Monetization” section with plan mix, MRR trend, trial conversion, ARPU/LTV.

**Outcome:** Revenue and subscription KPIs in Analytics (only if billing is in scope).

---

## Phase 6: Quality and reliability (errors, latency)

**Goal:** Error rate by endpoint/page, API latency percentiles, failed jobs, frontend error frequency.

**Schema / data**
- `errors_frontend` (message, stack, page, user_id, timestamp) and/or `errors_backend` or reuse a `logs_api` table for server logs.
- Client: small logger that POSTs to `/api/log-frontend-error` (admin or internal only).

**Implementation**
- API: GET `/api/admin/analytics/quality` returning error counts by endpoint/page, p50/p95 latency if you log it, top frontend errors.
- **AnalyticsView:** “Quality & reliability” section with error rates and latency.

**Outcome:** Operational quality visible in Analytics.

---

## Phase 7: Optional extensions

- **Collaboration / network:** Invites, team size, shared objects (if product has these concepts).
- **Search and discovery:** Top queries, zero-result rate, CTR from search (if you have search).
- **Storage and data:** Upload/download volume, bandwidth, largest buckets (if using Supabase Storage heavily).
- **Notifications:** Open/click rates, time-to-open, impact on next-session (if you send emails/push).

Implement only if they map to real product features and you’re already collecting or can collect the underlying data.

---

## Suggested implementation order

| Phase | Focus                     | Depends on        | Effort (rough) |
|-------|---------------------------|-------------------|----------------|
| 0     | Tab + shell               | —                 | Small          |
| 1     | Acquisition & traffic     | —                 | Medium         |
| 2     | Auth & onboarding funnel  | Existing funnel   | Medium         |
| 3     | Engagement                | Phase 1 sessions | Medium         |
| 4     | Retention & cohorts       | Phase 2 + 3      | Medium         |
| 5     | Monetization              | Stripe (if used) | Medium         |
| 6     | Quality & reliability     | —                 | Small–medium   |
| 7     | Extensions                | Product need      | Variable       |

---

## Technical notes

- **RLS:** Keep analytics tables admin/service-role only; no public read. Reuse the same auth pattern as Funnel (e.g. `verifyTrainerOrAdminRequest` on all analytics API routes).
- **Performance:** Use materialized views (e.g. `mv_dau_wau_mau`, `mv_cohort_weekly`) and refresh via cron or Edge Function; keep date ranges and limits on heavy queries.
- **Client:** Reuse or extend the existing analytics client (e.g. `@interval-timers/analytics` / `trackEvent`) for new event types so Analytics and Funnel share the same pipeline.
- **Funnel vs Analytics:** Keep Funnel as the focused “activation funnel” view; Analytics is the broader dashboard. Optionally link from Funnel to Analytics (e.g. “See full analytics”) and from Analytics to Funnel for activation detail.

---

## Quick reference: files to add or touch

| Phase | Files to add or modify |
|-------|-------------------------|
| 0     | `navigation.ts` (nav item), `AdminDashboard.tsx` (route), `views/AnalyticsView.tsx` (new), optional `pages/api/admin/analytics/overview.ts` |
| 1     | Migration `web_events` (or extend events), client page_view sender, `api/admin/analytics/acquisition.ts`, AnalyticsView acquisition section |
| 2     | Auth/onboarding events, optional `user_progress`, `api/admin/analytics/auth-funnel.ts`, AnalyticsView auth section |
| 3     | Session events or table, `api/admin/analytics/engagement.ts`, optional `mv_dau_wau_mau`, AnalyticsView engagement section |
| 4     | Cohort queries or MV, `api/admin/analytics/retention.ts`, AnalyticsView retention section |
| 5     | `billing_events` / `user_subscriptions`, webhook handler, `api/admin/analytics/monetization.ts`, AnalyticsView monetization section |
| 6     | `errors_frontend` (and/or backend logs), `api/log-frontend-error.ts`, `api/admin/analytics/quality.ts`, AnalyticsView quality section |
