# Admin analytics — metrics glossary & API reference

This document describes the **trainer/admin analytics** surfaced in the Astro app (`apps/app`) and the **data sources** behind each metric. Use it as the single glossary so product, growth, and engineering align on definitions (including work leading to the [Active Growth Engine](../ACTIVE_GROWTH_ENGINE_ROADMAP.md)).

**Primary UI:** Admin route **Analytics** → [`AnalyticsView`](../apps/app/src/components/react/admin/views/AnalyticsView.tsx).

**Auth:** All `/api/admin/analytics/*` routes require a verified **trainer or admin** session (see [`verifyTrainerOrAdminRequest`](../apps/app/src/lib/supabase/admin/auth.ts)).

---

## Data stores (Supabase `public`)

| Table / object | Role |
|----------------|------|
| `web_events` | Page views and acquisition dimensions (path, referrer, UTM, session). |
| `analytics_events` | Product funnel events (`event_name`, `user_id`, `session_id`, `properties`, `app_id`). |
| `errors_frontend` | Client-reported errors (message, page). |
| `profiles` | User profile row keyed by `auth.users` id; includes `created_at`, `trial_ends_at`, `purchased_index` for monetization summaries. **`purchased_index`:** `0` Athlete ($9.99), `1` Host ($24.99), `2` Pro ($49.99 list), `3` Studio ($199.99 list), `4` Coach Pro legacy ($199), `5` Studio Pro ($299.99 list — align with Stripe) — see DB `COMMENT ON COLUMN profiles.purchased_index` and [`pricing.ts`](../apps/app/src/data/pricing.ts). |
| `profile_billing_snapshot` | Optional billing metrics keyed by `profile_id` → `profiles.id` (see migration [`20260333000000_profile_billing_snapshot.sql`](../supabase/migrations/20260333000000_profile_billing_snapshot.sql)). Populated by webhooks/jobs when available. Columns include `active_client_count` (Pro roster for overage), `ai_credits_consumed` (optional usage KPI), `studio_location_id` / `studio_location_count` (location story). **NULL = unknown**; admin MRR still uses list prices. |
| `get_acquisition_stats(days)` | RPC returning acquisition rollups without scanning all `web_events` in Node. |
| `get_retention_cohort_stats(days, granularity, max_periods)` | RPC returning cohort retention matrix (see [Retention & cohorts](#retention--cohorts)). |
| `get_monetization_funnel_stats(days)` | RPC returning monetization funnel step counts, user/session conversion rates, median inter-step seconds (see [Monetization funnel](#monetization-funnel-phase-p2)). |
| `get_minimal_onboarding_dropoff(days)` | RPC returning minimal onboarding funnel rows for admin (see [Minimal onboarding](#minimal-onboarding-phase-p3)). |
| `get_admin_analytics_overview(days)` | Exact `analytics_events` totals and `COUNT(DISTINCT user_id)` in window (Phase P6). |
| `get_auth_funnel_visit_count(days)` | Distinct `web_events` visitors (`COALESCE(user_id, session_id)`) in window (Phase P6). |
| `get_auth_funnel_activation_stats(days)` | First-action distinct users, TTFKA buckets, sign-ins by day, OAuth/email from event `properties` (Phase P6). |
| `get_engagement_dau_series(days)` | DAU-by-day series plus WAU/MAU/stickiness from union of `analytics_events` + `web_events` (UTC days; Phase P6). |
| `get_engagement_web_session_stats(days)` | `web_events` `page_view` sessions: duration and pages per session (Phase P6). |
| `get_funnel_hub_launch_stats(days)` | Hub launch event totals and distinct `user_id` (logged-in only; Phase P6). |
| `get_feature_activity_daily(days, max_days, event_names[])` | Per-day counts per `event_name` for feature sparklines (Phase P6). |
| `get_errors_frontend_rollups(days, top_pages, top_messages)` | Quality aggregates without loading all error rows (Phase P6). |
| `stripe_processed_webhook_events` | Stripe webhook idempotency (`stripe_event_id` PK); written by app server only. |

Anonymous **Universal Activity Hub** traffic can post funnel rows via [`/api/analytics/hub-funnel`](../apps/app/src/pages/api/analytics/hub-funnel.ts) with `user_id` null; those sessions do not contribute to **user-level** retention (which requires `user_id`).

---

## HTTP API routes

| Method | Path | Summary |
|--------|------|---------|
| GET | `/api/admin/analytics/overview` | Total `analytics_events` count; exact distinct `user_id` via `get_admin_analytics_overview`. |
| GET | `/api/admin/analytics/acquisition` | Unique visitors, referrers, UTM, landing pages, device/geo (via `get_acquisition_stats` RPC). |
| GET | `/api/admin/analytics/auth-funnel` | Sign-ups/sign-ins by day, funnel counts, OAuth vs email, TTFKA, minimal onboarding drop-off (`get_minimal_onboarding_dropoff`). |
| GET | `/api/admin/analytics/engagement` | DAU/WAU/MAU, sessions, feature activity (catalog rollups, WoW, trends), `app_id` 7d breakdown, power-user buckets. |
| GET | `/api/admin/analytics/retention` | Cohort retention matrix (`days`, `granularity=week|month`, `maxPeriods`). |
| GET | `/api/admin/analytics/monetization` | Paid/trial counts, trial conversion, TTFC, MRR/ARPU/LTV from `profiles` + optional `profile_billing_snapshot` (see [Estimated MRR](#estimated-mrr-monetization-kpis)). |
| GET | `/api/admin/analytics/monetization-funnel` | Descriptive funnel: pricing view → checkout click → Stripe `checkout.session.completed` (`get_monetization_funnel_stats`). |
| GET | `/api/admin/analytics/quality` | Frontend errors by page and over time. |
| GET | `/api/admin/analytics/hub-paste` | Universal Activity Hub paste/handoff stats (used by **APP Analytics** view). |

**Related (not under `/analytics/`):** `GET /api/admin/funnel-stats` — activation funnel counts for **Activation Funnel** view.

---

## Retention & cohorts (Phase P1)

**Canonical signup timestamp for cohort assignment:** **`profiles.created_at`**, bucketed in **UTC** by calendar **week** or **month** (`date_trunc`). This matches monetization cohort windows that already filter by `profiles.created_at`. It may **differ** from the `account_signup_complete` analytics event if that event was never sent or arrived late.

**Cohort window:** Users included are those whose **profile** was created between `now() - days` and `now()` (same `days` query parameter as the rest of the Analytics page).

**Active (per period):** A user counts as active in period **k** if they have **at least one** row in `analytics_events` **or** `web_events` whose timestamp falls in the **calendar** week or month aligned to **cohort start + k periods**, and **`user_id` is not null**.

**Retention rate:** `activeCount / cohortSize` for that cohort row and period offset. Period **0** is the signup week/month itself.

**Implementation:** [`get_retention_cohort_stats`](../supabase/migrations/20260327120000_retention_cohort_stats_rpc.sql); client module [`analytics-retention.ts`](../apps/app/src/lib/supabase/admin/analytics-retention.ts).

---

## Monetization funnel (Phase P2)

**Canonical events** (in `analytics_events`):

| `event_name` | Source | Notes |
|--------------|--------|--------|
| `monetization_pricing_viewed` | Client | Home `#pricing` section visible (`MonetizationPricingTracker`). Properties: `surface: home_pricing`. |
| `monetization_checkout_started` | Client | Tier CTA click before redirect to Stripe. Properties: `plan_id` (e.g. `athlete`), `purchased_index` (0–3 for public tiers), optional `cta_host`. |
| `monetization_checkout_completed` | Server | [`POST /api/stripe/webhook`](../apps/app/src/pages/api/stripe/webhook.ts) on `checkout.session.completed`. **Not** in client `FUNNEL_EVENTS`. `app_id`: `stripe_webhook`. Properties include `stripe_event_id`, `checkout_session_id`, `customer_id`, `payment_status`, etc. |

**Linking Stripe → user:** Set Checkout **`client_reference_id`** to the Supabase auth user UUID, or **`metadata.supabase_user_id`** / **`metadata.user_id`** (UUID). Otherwise `user_id` on the completed event is null (aggregate funnel still works; user-level conversion to “completed” will undercount).

**Plan id → `purchased_index`:** [`purchasedIndexForPlanId`](../apps/app/src/data/pricing.ts) matches public [`pricing.ts`](../apps/app/src/data/pricing.ts) landing tiers (Athlete=0 … Studio=3). Indices **4** (Coach Pro legacy) and **5** (Studio Pro) are for subscribers set via billing / admin reconciliation, not necessarily a public pricing card.

**Implementation:** Migration [`20260328140000_monetization_funnel_stats_rpc.sql`](../supabase/migrations/20260328140000_monetization_funnel_stats_rpc.sql); [`analytics-monetization-funnel.ts`](../apps/app/src/lib/supabase/admin/analytics-monetization-funnel.ts); admin UI under **Monetization** in [`AnalyticsView.tsx`](../apps/app/src/components/react/admin/views/AnalyticsView.tsx).

---

## Estimated MRR (monetization KPIs)

**Source:** [`getMonetizationStats`](../apps/app/src/lib/supabase/admin/analytics-monetization.ts) (`GET /api/admin/analytics/monetization`).

- **`listPriceMrr`:** Σ over tiers: `(subscriber count for purchased_index k) × (list price for k)` from the same tier matrix as `PLAN_METADATA` / DB comment.
- **`proOverageMrr`:** For each profile with `purchased_index = 2` (Pro), if `profile_billing_snapshot.active_client_count` is **non-null**, add `max(0, active_client_count - 30) × $1.00`. Profiles with no snapshot row or NULL count contribute **$0** overage (conservative).
- **`estimatedMrr`:** `listPriceMrr + proOverageMrr`. **ARPU** uses `estimatedMrr / activePaidCount`.
- **Studio multi-location** and **AI credit overage** are **not** in MRR until product defines invoice rules; snapshot columns exist for future wiring.
- **Fallback:** Before billing sync populates snapshots, behavior matches **list price × subscriber count** only.

---

## Minimal onboarding (Phase P3)

**Surface:** [`/account/onboarding/minimal`](../apps/app/src/components/react/MinimalOnboardingPage.tsx) (logged-in users).

**Canonical events** (client `FUNNEL_EVENTS` → `analytics_events`):

| `event_name` | When |
|--------------|------|
| `minimal_onboarding_viewed` | Once per visit when the signed-in user lands on the page. |
| `minimal_onboarding_baseline_saved` | After `updateActivityLevel` succeeds. |
| `minimal_onboarding_goals_saved` | After `updateProfileFitnessGoalRanking` succeeds. |
| `minimal_onboarding_complete` | After optional AMRAP guest claim; before redirect. |

**Properties:** `source` is derived from the `from` query param when present (e.g. `from=amrap` → `source: amrap`); otherwise `direct` (or `app` during SSR-safe fallbacks in helpers).

**Drop-off metrics** (`onboardingDropOff` on `GET /api/admin/analytics/auth-funnel`):

- **Cohort:** Distinct `user_id` with `minimal_onboarding_viewed` in `[now − days, now]`.
- **Rows:** Landed (count = cohort size); then baseline saved, goals saved, and complete. **Completed** counts users in the cohort who also have that milestone event in the **same** window; **dropped** on a row is prior-step eligible minus that row’s completed count. **Conversion from prior** in the UI is `completed / (completed + dropped)` (first row shows an em dash).
- **Legacy gap:** Users who never emit `minimal_onboarding_viewed` in the window (including completions recorded before P3 instrumentation) do not appear in the cohort.

**Implementation:** Migration [`20260328150000_minimal_onboarding_dropoff_rpc.sql`](../supabase/migrations/20260328150000_minimal_onboarding_dropoff_rpc.sql); [`analytics-auth-funnel.ts`](../apps/app/src/lib/supabase/admin/analytics-auth-funnel.ts); **Auth & onboarding** section in [`AnalyticsView.tsx`](../apps/app/src/components/react/admin/views/AnalyticsView.tsx).

---

## Feature activity (Phase P4)

**Purpose:** Group `analytics_events` into **product features** for engagement reporting and future **Feature ROI** work. Single source of truth: [`feature-activity-catalog.ts`](../apps/app/src/lib/admin/feature-activity-catalog.ts) (`FEATURE_ACTIVITY_CATALOG`, `POWER_USER_EVENT_NAMES`, `KNOWN_ANALYTICS_APP_IDS`).

**Per-feature metrics** (Engagement → **Feature activity** in [`AnalyticsView.tsx`](../apps/app/src/components/react/admin/views/AnalyticsView.tsx)):

- **7d / 30d:** Total rows in `analytics_events` whose `event_name` is listed under that feature (including `monetization_checkout_completed`, which is server-only).
- **WoW:** Percent change of **7d** vs the **prior 7 days** (`((current7d - prior7d) / prior7d) * 100`); em dash if `prior7d` is 0.
- **Trend sparkline:** Daily counts over `min(days, 14)` ending today via `get_feature_activity_daily` (exact SQL aggregation).

**Power-user distribution:** Buckets users by how many **power-user** events they fired in the selected `days` window (`POWER_USER_EVENT_NAMES` in the catalog — a subset of funnel events, not the full catalog). Still uses a **capped** row fetch (10k); if the log line `[admin-analytics-cap] engagement power-user events` appears, counts may be truncated.

**`app_id` volume (7d):** Small table of total event rows in the last 7 days for **known** `app_id` values (`app`, `universal_activity_hub`, `amrap`, `tabata`, `daily-warmup`, `stripe_webhook`) plus **`(unset)`** for `app_id IS NULL`. Not exhaustive for arbitrary client strings.

**Implementation:** [`analytics-engagement.ts`](../apps/app/src/lib/supabase/admin/analytics-engagement.ts); `GET /api/admin/analytics/engagement`.

---

## Admin analytics dataset registry (Phase P5)

**Purpose:** A single TypeScript map of **admin analytics surfaces** → **HTTP routes**, **primary Supabase tables**, and **short metric definitions**. It is the lightweight precursor to a future Growth Engine `analytics-datasets` layer and is rendered as the **Dataset index** on the main Analytics page.

**Source:** [`analytics-datasets-registry.ts`](../apps/app/src/lib/admin/analytics-datasets-registry.ts) (`ADMIN_ANALYTICS_DATASETS`).

**Shared date window:** Analytics, **Activation Funnel**, and **APP Analytics** honor `?days=7|30|90` in the URL. Changing the range updates the query string (`replace` navigation) so deep links and cross-links keep the same window. Helper: [`analytics-days.ts`](../apps/app/src/lib/admin/analytics-days.ts).

---

## Instrumentation package

Event allowlist and client helpers: [`packages/analytics/src/track.ts`](../packages/analytics/src/track.ts) (`FUNNEL_EVENTS`, `trackEvent`, `trackPageView`). **`monetization_checkout_completed` is server-only** and is intentionally omitted from `FUNNEL_EVENTS`.

---

## Scalability & aggregation (Phase P6)

**Migrations:** [`20260329100000_admin_analytics_scale_rpcs.sql`](../supabase/migrations/20260329100000_admin_analytics_scale_rpcs.sql), [`20260329101000_admin_analytics_scale_indexes.sql`](../supabase/migrations/20260329101000_admin_analytics_scale_indexes.sql).

| Metric / surface | Exact? | Mechanism |
|------------------|--------|-----------|
| Overview totals & distinct users | Yes | `get_admin_analytics_overview` |
| Auth funnel visit count | Yes | `get_auth_funnel_visit_count` |
| Auth first-action count | Yes | `get_auth_funnel_activation_stats` |
| TTFKA buckets | Yes | SQL: signups with `account_signup_complete` in window → first `timer_session_complete` or `hub_timer_launch_1` at or after that signup time → same-day / 1–2d / 3–7d / 7d+ / never buckets as in admin UI |
| Sign-ins by day; OAuth vs email from events | Yes | Same RPC (`account_login_complete` by UTC day; `properties.method` on signup/login events) |
| DAU / WAU / MAU / stickiness | Yes | `get_engagement_dau_series` (WAU/MAU: distinct users on UTC days with `d >= today_utc - 7` and `- 30`) |
| Session duration & pages | Yes | `get_engagement_web_session_stats` (`page_view` grouped by `COALESCE(session_id, user_id)`) |
| Feature 7d/30d/WoW | Yes | Head `count` queries per catalog (unchanged) |
| Feature trend sparklines | Yes | `get_feature_activity_daily` |
| Hub paste caps | Partial | `distinctSessionsCapped` + `[admin-analytics-cap]` logs when property/session fetches hit limits |
| Power-user histogram | Partial | Capped at 10k rows; see log if truncated |
| Quality errors | Yes | `get_errors_frontend_rollups` |
| Activation funnel hub launches | Yes | `get_funnel_hub_launch_stats` |

**Cap-hit logging:** When a query returns exactly the configured `limit`, the server may log `[admin-analytics-cap] …` in dev or when `PUBLIC_ENABLE_ERROR_LOGGING=true` ([`admin-analytics-cap-warn.ts`](../apps/app/src/lib/admin/admin-analytics-cap-warn.ts)).

**Privacy (precursor):** For future per-user admin drill-through, use [`pseudonymizeAdminUserId`](../apps/app/src/lib/admin/pseudonymize-admin-user-id.ts). Optional env: `ADMIN_ANALYTICS_PSEUDO_PEPPER` (HMAC pepper; without it, a plain SHA-256 slice is used — fine for dev, not ideal for production anonymity).

---

## Caveats (known limitations)

- **`profiles.created_at`** may not match `auth.users.created_at` if the profile row is created asynchronously; document any future migration to auth-based cohorts if needed.
- **Auth sign-ups by day** still paginate `auth.admin.listUsers` in Node; very large user tables may be slow (correct but not yet SQL-offloaded).
- **Scheduled volume alerts** (e.g. cron on daily `count(*)`) are not implemented in-app; use external monitoring if needed.

---

## Related roadmaps

- [PRE_ACTIVE_GROWTH_ENGINE_ANALYTICS_ROADMAP.md](../PRE_ACTIVE_GROWTH_ENGINE_ANALYTICS_ROADMAP.md) — analytics foundation before the Growth Engine.
- [ACTIVE_GROWTH_ENGINE_ROADMAP.md](../ACTIVE_GROWTH_ENGINE_ROADMAP.md) — prescriptive layer (not started in this repo).
