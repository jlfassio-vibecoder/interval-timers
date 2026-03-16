# Admin Analytics Tab — File List for Migration

Use this list to copy and migrate the **Admin Analytics** tab into another Astro project that is otherwise identical (same Supabase, admin auth, and routing structure). Paths are relative to this repo.

---

## 1. UI and routing

| File | Purpose |
|------|--------|
| `apps/app/src/components/react/admin/views/AnalyticsView.tsx` | Analytics dashboard: overview, acquisition, auth funnel, engagement, monetization, quality sections and charts |
| `apps/app/src/components/react/admin/AdminDashboard.tsx` | Add route `path="analytics" element={<AnalyticsView />}` and ensure `AnalyticsView` import |
| `apps/app/src/lib/admin/navigation.ts` | Add nav item `{ path: '/analytics', label: 'Analytics', icon: BarChart2 }` (or ensure it exists) |

---

## 2. API routes (GET, admin-protected)

| File | Purpose |
|------|--------|
| `apps/app/src/pages/api/admin/analytics/overview.ts` | Overview: total events, distinct users |
| `apps/app/src/pages/api/admin/analytics/acquisition.ts` | Acquisition: visitors, referrers, UTM, landing pages, device/browser, geo |
| `apps/app/src/pages/api/admin/analytics/auth-funnel.ts` | Auth funnel: sign-ins/sign-ups by day, funnel, OAuth vs email, TTFKA |
| `apps/app/src/pages/api/admin/analytics/engagement.ts` | Engagement: DAU/WAU/MAU, stickiness, sessions, feature adoption, power-user distribution |
| `apps/app/src/pages/api/admin/analytics/monetization.ts` | Monetization: paid by plan, trial conversion, TTFC, MRR/ARPU/LTV |
| `apps/app/src/pages/api/admin/analytics/quality.ts` | Quality: frontend errors by page, top errors, time series |

---

## 3. Server-side lib (Supabase admin analytics)

| File | Purpose |
|------|--------|
| `apps/app/src/lib/supabase/admin/analytics-overview.ts` | Overview from `analytics_events` |
| `apps/app/src/lib/supabase/admin/analytics-acquisition.ts` | Acquisition from `web_events` + RPC `get_acquisition_stats`; uses `ua-parser-js` |
| `apps/app/src/lib/supabase/admin/analytics-auth-funnel.ts` | Auth funnel: Auth admin API + `analytics_events` + `web_events` |
| `apps/app/src/lib/supabase/admin/analytics-engagement.ts` | Engagement from `analytics_events` and `web_events` |
| `apps/app/src/lib/supabase/admin/analytics-monetization.ts` | Monetization from `profiles` (purchased_index, trial_ends_at) and `user_programs` |
| `apps/app/src/lib/supabase/admin/analytics-quality.ts` | Quality from `errors_frontend` |

**Dependencies of these lib files (must exist in target project):**

- `apps/app/src/lib/supabase/server.ts` — `getSupabaseServer()`
- `apps/app/src/lib/supabase/admin/auth.ts` — `verifyTrainerOrAdminRequest()` (used by all 6 API routes)

---

## 4. Supabase migrations (root and app)

Run these in the **target** project’s Supabase (or ensure equivalent schema exists).

| File | Purpose |
|------|--------|
| `supabase/migrations/20250314000000_analytics_events.sql` | Table `analytics_events` (event_name, user_id, timestamp, etc.) |
| `supabase/migrations/20250314000002_analytics_events_rls_tighten.sql` | RLS for `analytics_events` (if used) |
| `supabase/migrations/20250317000000_web_events.sql` | Table `web_events` (page_view, path, referrer, UTM, user_agent, etc.) |
| `supabase/migrations/20250317000001_acquisition_stats_rpc.sql` | RPC `get_acquisition_stats(p_days)` for acquisition aggregation |
| `supabase/migrations/20250318000000_errors_frontend.sql` | Table `errors_frontend` (for quality tab) |

**Schema the target project must already have (or add):**

- **profiles**: columns used by monetization: `purchased_index`, `trial_ends_at` (and any existing profile columns).
- **user_programs**: table used by monetization (e.g. `user_id`, `purchased_at`, `source`).

If the target project uses app-level migrations under `apps/app/supabase/migrations/`, you may have equivalent profiles/user_programs migrations there; ensure those columns/tables exist.

---

## 5. Acquisition data pipeline (optional but recommended)

To populate **Acquisition** and parts of **Engagement**, the target app needs page-view ingestion and (optionally) the shared analytics package.

| File | Purpose |
|------|--------|
| `apps/app/src/pages/api/analytics/page-view.ts` | Public POST endpoint that inserts into `web_events` |
| `packages/analytics/src/track.ts` | `trackPageView()` client helper (and `trackEvent` for funnel) |
| `packages/analytics/src/session.ts` | `getOrCreateSessionId()` used by track |
| `packages/analytics/src/index.ts` | Package exports |
| `packages/analytics/package.json` | Analytics package manifest |

If the target repo already has an `@interval-timers/analytics` (or equivalent) package and a page-view API that writes to `web_events`, you can skip these and just ensure the schema matches.

---

## 6. Quality data pipeline (optional)

To populate the **Quality** section, frontend errors must be sent to `errors_frontend`.

| File | Purpose |
|------|--------|
| `apps/app/src/pages/api/log-frontend-error.ts` | Public POST that inserts into `errors_frontend` |
| `apps/app/src/lib/log-frontend-error.ts` | Client fire-and-forget logger |
| `apps/app/src/components/react/FrontendErrorMonitor.tsx` | Global error / unhandledrejection handlers |

If you don’t need the Quality tab, you can omit these; the Quality API and AnalyticsView already handle missing `errors_frontend` gracefully.

---

## 7. Dependencies and config

**npm (apps/app):**

- `recharts` — charts in AnalyticsView
- `ua-parser-js` — device/browser parsing in `analytics-acquisition.ts`
- `@interval-timers/analytics` (or local workspace package) — if using page-view and event tracking

**TypeScript:**

- `apps/app/src/env.d.ts` — ensure it includes the `ua-parser-js` module declaration (so `UAParser` type is available).

**Admin layout:**

- Admin must be mounted the same way (e.g. `apps/app/src/pages/admin/[...slug].astro` with `AdminDashboard` and `verifyTrainerOrAdminRequest`). The Analytics route is inside `AdminDashboard` under `path="analytics"`.

---

## 8. Optional: tests

| File | Purpose |
|------|--------|
| `apps/app/tests/lib/analytics-engagement-windowing.test.ts` | Unit tests for WAU/MAU date windowing logic |

---

## 9. Checklist summary

- [ ] Copy **AnalyticsView** and add **analytics** route + nav item in AdminDashboard and navigation.
- [ ] Copy all **6 API routes** under `pages/api/admin/analytics/`.
- [ ] Copy all **6 analytics lib files** under `lib/supabase/admin/analytics-*.ts`.
- [ ] Ensure **server.ts** and **admin/auth.ts** exist and are used by the analytics APIs.
- [ ] Apply or verify **Supabase migrations**: analytics_events, web_events, get_acquisition_stats RPC, errors_frontend; profiles + user_programs for monetization.
- [ ] Add **recharts** and **ua-parser-js** to app dependencies; add **ua-parser-js** type declaration if needed.
- [ ] (Optional) Copy **page-view** API and **analytics** package for acquisition/engagement data.
- [ ] (Optional) Copy **log-frontend-error** API + **FrontendErrorMonitor** + **log-frontend-error.ts** for quality data.
- [ ] (Optional) Copy **analytics-engagement-windowing** test.

After migration, the Analytics tab will show Overview from `analytics_events`; Acquisition from `web_events` (and RPC); Auth funnel from Auth + `analytics_events` + `web_events`; Engagement from `analytics_events` + `web_events`; Monetization from `profiles` + `user_programs`; Quality from `errors_frontend` (or empty if not set up).
