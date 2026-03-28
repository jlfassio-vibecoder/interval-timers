# Pre Active Growth Engine — Analytics Dashboard & Instrumentation Roadmap

**Purpose:** Define what to **design, instrument, and ship in admin analytics** *before* [`ACTIVE_GROWTH_ENGINE_ROADMAP.md`](ACTIVE_GROWTH_ENGINE_ROADMAP.md). The Growth Engine is a **prescriptive meta-layer**; it needs a **complete descriptive foundation**: trusted tables, event contracts, and admin UI that answer “what happened?” per funnel stage.

**Principle:** If a metric is not **visible and explainable** in the main analytics experience (`AnalyticsView` and its APIs), do not expect the Growth Engine to **score, alert, or narrate** it reliably.

**Last updated:** 2026-03-28 (P2 monetization funnel shipped)  
**Primary UI target:** `apps/app/src/components/react/admin/views/AnalyticsView.tsx`  
**Companion admin views today:** `FunnelView.tsx` (activation funnel), `AppAnalyticsView.tsx` (Universal Activity Hub paste/handoff).

---

## 1. What to build first (dashboard shape)

Implement a **full-funnel descriptive dashboard** aligned with standard product analytics practice:

| Layer | Question | In this repo (target) |
|--------|-----------|------------------------|
| **Acquisition** | Where do users come from? | Already strong: `web_events` + acquisition API (UTM, referrers, landing pages, device/geo). |
| **Activation** | Do they reach “first value”? | Partially: timer/handoff funnel in `FunnelView` + auth funnel in `AnalyticsView`; unify narrative and coverage. |
| **Engagement** | Do they return and use core features? | Partially: DAU/WAU/MAU, sessions, feature adoption from `analytics_events`; needs **product-specific depth** (e.g. programs, HUD, AMRAP) as you define “key events.” |
| **Retention** | Do cohorts come back? | **Shipped:** cohort matrix + `get_retention_cohort_stats` RPC; see **Retention & cohorts** in `AnalyticsView` and [`docs/ADMIN_ANALYTICS.md`](docs/ADMIN_ANALYTICS.md). |
| **Monetization** | Trial → paywall → purchase? | **Partial:** KPIs from `profiles` + optional `profile_billing_snapshot` (Pro overage when populated), **Phase P2** funnel (`monetization_*` events, Stripe webhook completion row). **UTM/tier breakdown** in funnel UI deferred; billing **sync** into snapshot still future. |
| **Quality** | What breaks the experience? | Good start: `errors_frontend` surfaced in **Quality & reliability**. Extend with **monetization-path** errors when those flows exist. |

**Recommendation:** Treat **`AnalyticsView`** as the **single hub** for executive analytics: either **embed** or **deep-link** Funnel + APP Hub sections so growth and product leads do not hunt three routes for one story.

---

## 2. Current state (codebase inventory)

Grounded in the repo as of this roadmap:

### 2.1 Data stores

| Store | Role | Migrations / notes |
|--------|------|---------------------|
| `public.web_events` | Page views, acquisition dimensions | `supabase/migrations/20250317000000_web_events.sql`, RPC for rollups |
| `public.analytics_events` | Product & funnel events (`event_name`, `user_id`, `session_id`, `properties`, `app_id`) | `20250314000000_analytics_events.sql` |
| `public.errors_frontend` | Client error reporting | Used by `analytics-quality.ts` |
| `public.profiles` | Trial end, plan index (`trial_ends_at`, `purchased_index` 0–5 — see DB comment) | Monetization **KPIs** in `analytics-monetization.ts` — list-price MRR + optional Pro overage via `profile_billing_snapshot` |
| `public.profile_billing_snapshot` | Optional per-profile billing metrics (active clients, AI usage, studio location) | Populated by billing sync when available; see `docs/ADMIN_ANALYTICS.md` §Estimated MRR |

**Note:** [`ACTIVE_GROWTH_ENGINE_ROADMAP.md`](ACTIVE_GROWTH_ENGINE_ROADMAP.md) refers to `analytics_funnel_events` for monetization sequencing. **This codebase uses `analytics_events` only** for funnel-style rows. Either extend `analytics_events` with a strict **monetization event namespace** or add a dedicated table/RPC later; the **event names and server write paths** matter more than the table name.

### 2.2 Client / server instrumentation

- **Allowlisted events:** `packages/analytics/src/track.ts` — `FUNNEL_EVENTS` (insert via Supabase client).
- **Hub (no auth):** `apps/app/src/pages/api/analytics/hub-funnel.ts` posts into `analytics_events` with `user_id: null`, fixed `app_id: universal_activity_hub` — good for anonymous funnel, **weak for per-user monetization/lead scoring** until **identity stitching** (e.g. link session → user on login).
- **Page views:** `trackPageView` → `/api/analytics/page-view` → `web_events`.

### 2.3 Admin APIs backing `AnalyticsView`

| Endpoint | Server module |
|----------|----------------|
| `/api/admin/analytics/overview` | `analytics-overview.ts` |
| `/api/admin/analytics/acquisition` | `analytics-acquisition.ts` |
| `/api/admin/analytics/auth-funnel` | `analytics-auth-funnel.ts` |
| `/api/admin/analytics/engagement` | `analytics-engagement.ts` |
| `/api/admin/analytics/monetization` | `analytics-monetization.ts` |
| `/api/admin/analytics/quality` | `analytics-quality.ts` |
| `/api/admin/analytics/hub-paste` | `hub-paste-stats.ts` (used by **App Analytics**, not main `AnalyticsView`) |
| `/api/admin/funnel-stats` | `funnel-stats.ts` (used by **Funnel** view) |

### 2.4 Known limitations (fix as part of this roadmap)

- **Auth funnel “visit” vs “sign-up”:** Addressed in **Phase P6** via `get_auth_funnel_visit_count` and related RPCs (see `docs/ADMIN_ANALYTICS.md` §Scalability).
- **TTFKA / first key events:** Addressed in **Phase P6** via `get_auth_funnel_activation_stats` (per-user first key after signup).
- **Overview “distinct users”:** Addressed in **Phase P6** via `get_admin_analytics_overview`.
- **`onboardingDropOff`:** Populated via `get_minimal_onboarding_dropoff` and minimal onboarding client events (Phase P3).
- **Monetization:** No **paywall / checkout / subscription activated** events in `FUNNEL_EVENTS`; Growth Engine scenarios (abandonment, real-time alerts) **cannot** fire without this layer (plus optional Stripe webhook writes to Supabase).

---

## 3. Prerequisites for the Active Growth Engine

These align with [`ACTIVE_GROWTH_ENGINE_ROADMAP.md`](ACTIVE_GROWTH_ENGINE_ROADMAP.md) **Prerequisite** and data plane:

1. **`growth_state` (or equivalent) on `profiles`** — single enum for trial / subscriber / churned, kept in sync via app + billing webhooks (not only reconciliation).
2. **Monetization funnel events** — at minimum (names illustrative; standardize in one doc):
   - paywall or upgrade prompt viewed  
   - checkout / subscription intent started  
   - server-verified success / subscription active  
   Use **`user_id`** = Supabase auth UUID whenever the user is logged in.
3. **Identity stitching** — for anonymous hub/session flows, define how `session_id` maps to `user_id` after login so downstream **lead scoring** and **drop-off** are per-user.
4. **Retention cohorts** — weekly/monthly cohort tables or RPCs from `analytics_events` + `profiles.created_at` (or signup event) so the Growth Engine can cite **return rates**, not only DAU.

Until (1)–(4) exist, keep the Growth Engine roadmap **paused** or scoped to **rules that only use data you already trust** (e.g. acquisition + errors).

---

## 4. Phased delivery — analytics before Growth Engine

### Phase P1 — Retention & cohorts (replace placeholder)

- [x] **Schema / SQL:** Cohort definition (e.g. signup week × activity week matrix, or N-day return rate).
- [x] **API:** `GET /api/admin/analytics/retention?days=&cohort=` (or reuse engagement with a dedicated handler).
- [x] **`AnalyticsView`:** Replace `PlaceholderSection` with charts/tables + short metric glossary (how “active” is defined).
- [x] **Events:** Confirm **one canonical “signup cohort” timestamp** (`profiles.created_at` vs `account_signup_complete`).

**Implemented (2026-03-27):** `public.get_retention_cohort_stats` in [`supabase/migrations/20260327120000_retention_cohort_stats_rpc.sql`](supabase/migrations/20260327120000_retention_cohort_stats_rpc.sql); API [`apps/app/src/pages/api/admin/analytics/retention.ts`](apps/app/src/pages/api/admin/analytics/retention.ts); glossary in [`docs/ADMIN_ANALYTICS.md`](docs/ADMIN_ANALYTICS.md).

### Phase P2 — Monetization funnel (descriptive)

**Product & pricing context (2026 HIIT Ecosystem — value-based scaling):**

| Tier | Audience | List price (mo) | `purchased_index` | Notes for analytics / billing |
|------|-----------|-----------------|-------------------|-------------------------------|
| **Athlete** | Solo | $9.99 | `0` | 7-day **calibration** trial before first charge; capped **AI generation credits**. |
| **Host** | Social leader | $24.99 | `1` | Up to **5 Buddies**; private leaderboard; network-effect retention. |
| **Pro** | Independent trainer | $49.99+ | `2` | Base includes **30 client slots**; **+$1/mo per active client** beyond 30 (Stripe/billing must emit usage or invoice line items — **not** in `profiles` today). **Unlimited AI** for Pro/Studio vs capped Athlete. |
| **Studio** | Boutique / multi-coach | $199.99+ | `3` | First **location** baseline; multi-location and enterprise terms in billing. Admin engagement story for gym retention. |
| **Coach Pro (legacy)** | Pre-matrix subscribers | $199 | `4` | Legacy bucket; reconcile via Stripe when possible. |
| **Studio Pro** | Upscale multi-coach / enterprise-lite | $299.99+ | `5` | Distinct Stripe price from Studio; align list price in `PLAN_METADATA` with catalog. |

**Implementation checklist**

- [x] **Instrument** paywall → checkout → success (client + **server** on webhook success); include **tier** / `purchased_index` target in event properties where safe.
- [x] **Extend `FUNNEL_EVENTS`** (or add server-only insert path for trusted events).
- [x] **API + UI:** New section **Monetization funnel** in `AnalyticsView`: step counts, conversion rates, **time-to-step** (median seconds for logged-in users). **Deferred:** breakdown by **tier** and **UTM cohort** (v2).
- [x] **Align** with `profiles` KPIs and **landing** [`pricing.ts`](apps/app/src/data/pricing.ts) so admin sees **one story** (events + subscription state + product copy).
- [x] **Optional schema (when billing supports it):** `profile_billing_snapshot` side table (`active_client_count`, `ai_credits_consumed`, `studio_location_id`, `studio_location_count`) — migrations [`20260333000000_profile_billing_snapshot.sql`](supabase/migrations/20260333000000_profile_billing_snapshot.sql), [`20260333001000_profiles_purchased_index_comment_studio_pro.sql`](supabase/migrations/20260333001000_profiles_purchased_index_comment_studio_pro.sql). Admin MRR adds Pro overage when `active_client_count` is set; otherwise **list price × subscriber count** per tier (indices 0–5 including Coach Pro and Studio Pro).

**Implemented (2026-03-28):** Client [`MonetizationPricingTracker`](apps/app/src/components/react/public/MonetizationPricingTracker.tsx) + [`FUNNEL_EVENTS`](packages/analytics/src/track.ts); webhook [`apps/app/src/pages/api/stripe/webhook.ts`](apps/app/src/pages/api/stripe/webhook.ts) → `monetization_checkout_completed`; RPC + idempotency table [`supabase/migrations/20260328140000_monetization_funnel_stats_rpc.sql`](supabase/migrations/20260328140000_monetization_funnel_stats_rpc.sql); API [`monetization-funnel.ts`](apps/app/src/pages/api/admin/analytics/monetization-funnel.ts); glossary [`docs/ADMIN_ANALYTICS.md`](docs/ADMIN_ANALYTICS.md) §Monetization funnel.

### Phase P3 — Onboarding steps (diagnostic)

- [x] **Emit** structured events for each onboarding screen/step (or reuse `minimal_onboarding_complete` with intermediates).
- [x] **Populate** `onboardingDropOff` in `getAuthFunnelStats` **or** a dedicated endpoint.
- [x] **`AnalyticsView`:** Always show onboarding drop-off when data exists; add drill-down by step.

**Implemented (2026-03-27):** [`MinimalOnboardingPage`](apps/app/src/components/react/MinimalOnboardingPage.tsx) (`minimal_onboarding_viewed`, `_baseline_saved`, `_goals_saved`, `_complete`); RPC [`20260328150000_minimal_onboarding_dropoff_rpc.sql`](supabase/migrations/20260328150000_minimal_onboarding_dropoff_rpc.sql); [`getAuthFunnelStats`](apps/app/src/lib/supabase/admin/analytics-auth-funnel.ts); glossary + conversion column in [`AnalyticsView`](apps/app/src/components/react/admin/views/AnalyticsView.tsx); [`docs/ADMIN_ANALYTICS.md`](docs/ADMIN_ANALYTICS.md) §Minimal onboarding.

### Phase P4 — Product “app activity” depth (feature ROI prep)

- [x] **Curate** a **feature catalog** (event name ↔ product surface) in code or DB config — feeds Growth Engine **Feature ROI** later.
- [x] **Engagement:** Expand `featureAdoption` beyond raw event list: group by feature, add **trend sparklines** or WoW.
- [x] **Optional:** Separate **AMRAP / landing / app** via `app_id` consistently (hub already sets `universal_activity_hub`).

**Implemented (2026-03-27):** [`feature-activity-catalog.ts`](apps/app/src/lib/admin/feature-activity-catalog.ts); [`analytics-engagement.ts`](apps/app/src/lib/supabase/admin/analytics-engagement.ts) (`featureActivity`, `featureActivityTrends`, `eventVolumeByAppId7d`, power-user from `POWER_USER_EVENT_NAMES`); **Feature activity** in [`AnalyticsView`](apps/app/src/components/react/admin/views/AnalyticsView.tsx); [`docs/ADMIN_ANALYTICS.md`](docs/ADMIN_ANALYTICS.md) §Feature activity.

### Phase P5 — Unify admin analytics UX

- [x] **Navigation:** From `AnalyticsView`, link or embed **Activation Funnel** (`FunnelView`) and **APP Analytics** (`AppAnalyticsView`) with shared date range where possible.
- [x] **Dataset registry (lightweight):** A single TS module listing section title, API route, primary table(s), and **metric definitions** — precursor to the Growth Engine’s `analytics-datasets` idea (path may live under `apps/app/src/lib/admin/` until a separate admin app exists).

**Implemented (2026-03-27):** Cross-links + `?days=7|30|90` on Analytics, Funnel, and APP Analytics ([`analytics-days.ts`](apps/app/src/lib/admin/analytics-days.ts)); dataset registry [`analytics-datasets-registry.ts`](apps/app/src/lib/admin/analytics-datasets-registry.ts) + **Dataset index** in [`AnalyticsView`](apps/app/src/components/react/admin/views/AnalyticsView.tsx); [`docs/ADMIN_ANALYTICS.md`](docs/ADMIN_ANALYTICS.md) §Admin analytics dataset registry.

### Phase P6 — Scale & trust

- [x] **Move heavy counts** to **SQL views or RPCs** (pattern already started for acquisition).
- [x] **Document** sampling/limits where they remain; add alerts if event volume exceeds thresholds.
- [x] **Privacy:** Pseudonymized admin display for any user-level drill-through you add before the Growth Engine.

**Implemented (2026-03-27):** Migrations [`20260329100000_admin_analytics_scale_rpcs.sql`](supabase/migrations/20260329100000_admin_analytics_scale_rpcs.sql), [`20260329101000_admin_analytics_scale_indexes.sql`](supabase/migrations/20260329101000_admin_analytics_scale_indexes.sql); TS [`analytics-overview.ts`](apps/app/src/lib/supabase/admin/analytics-overview.ts), [`analytics-auth-funnel.ts`](apps/app/src/lib/supabase/admin/analytics-auth-funnel.ts), [`analytics-engagement.ts`](apps/app/src/lib/supabase/admin/analytics-engagement.ts), [`funnel-stats.ts`](apps/app/src/lib/supabase/admin/funnel-stats.ts), [`analytics-quality.ts`](apps/app/src/lib/supabase/admin/analytics-quality.ts), [`hub-paste-stats.ts`](apps/app/src/lib/supabase/admin/hub-paste-stats.ts); [`admin-analytics-cap-warn.ts`](apps/app/src/lib/admin/admin-analytics-cap-warn.ts), [`pseudonymize-admin-user-id.ts`](apps/app/src/lib/admin/pseudonymize-admin-user-id.ts); [`docs/ADMIN_ANALYTICS.md`](docs/ADMIN_ANALYTICS.md) §Scalability & aggregation; registry updates in [`analytics-datasets-registry.ts`](apps/app/src/lib/admin/analytics-datasets-registry.ts).

---

## 5. Success criteria (“ready for Growth Engine”)

You are ready to start [`ACTIVE_GROWTH_ENGINE_ROADMAP.md`](ACTIVE_GROWTH_ENGINE_ROADMAP.md) when:

1. **Every Growth Engine input** listed in that doc has a **corresponding** admin section or API (or an explicit “not applicable yet” waiver).
2. **Monetization** has **both** state on `profiles` **and** a **time-ordered event trail** for drop-off and abandonment logic.
3. **`growth_state`** is defined, stored, and documented.
4. Stakeholders agree **metric definitions** (single glossary) so rules and LLM layers do not fight ambiguous KPIs.

---

## 6. Quick reference — files to touch

| Area | Files (representative) |
|------|-------------------------|
| Public pricing / Stripe CTAs | `apps/app/src/data/pricing.ts`, `apps/app/.env.example` |
| Event allowlist | `packages/analytics/src/track.ts` |
| Hub ingest | `apps/app/src/pages/api/analytics/hub-funnel.ts` |
| Admin queries | `apps/app/src/lib/supabase/admin/analytics-*.ts`, `funnel-stats.ts`, `hub-paste-stats.ts` |
| Feature ↔ events (P4) | `apps/app/src/lib/admin/feature-activity-catalog.ts` |
| Admin HTTP | `apps/app/src/pages/api/admin/analytics/*.ts` |
| Main dashboard UI | `apps/app/src/components/react/admin/views/AnalyticsView.tsx` |
| Dataset registry (P5) | `apps/app/src/lib/admin/analytics-datasets-registry.ts`, `analytics-days.ts` |
| Related views | `FunnelView.tsx`, `AppAnalyticsView.tsx` |
| DB | `supabase/migrations/*analytics*`, `*web_events*` |

---

*This document is **ACTIVE** for planning. Check off phases as work lands; when P1–P6 exit criteria are met, prioritize [`ACTIVE_GROWTH_ENGINE_ROADMAP.md`](ACTIVE_GROWTH_ENGINE_ROADMAP.md) Prerequisite + Phase A.*
