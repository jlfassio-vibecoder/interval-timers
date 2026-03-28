# Active Growth Engine — product & implementation roadmap

**Working title (admin UI):** **The Active Growth Engine**  
**One-liner:** An AI-assisted command center that turns descriptive analytics into **prioritized, actionable growth directives**—not another wall of tables.

This document describes the **pivot** from “what happened?” to “what should we do next?” It complements existing **`AnalyticsView`** sections (e.g. **Monetization drop-off**, onboarding funnel, monetization KPIs) by defining a **meta-layer**: cross-table reasoning, lead prioritization, and feature ROI framing.

**Companion work:** Instrumentation and funnels (e.g. app monetization events in `analytics_events`) remain the **ground truth**; the Growth Engine **reads** those signals and proposes interventions.

### Project stack (this repo — Supabase only)

This **interval-timers** monorepo uses **Supabase as the sole backend** for auth, profiles, analytics tables, and admin-facing APIs. There is **no Firebase/Firestore** layer for users, subscriptions, or funnel attribution. Align the Growth Engine with:

- **One Supabase project** — see `docs/COMMANDS.md` (§ Supabase, HIIT project) and `supabase/README.md` for schema layout (`public` app-prefixed tables; `amrap` / `shared` for scoped or cross-app data).
- **Identity & joins** — **Supabase Auth** user id (`auth.users` / `profiles`) is the canonical key; funnel rows should use a **`user_id`** compatible with that UUID (no parallel Firebase UID join path).
- **Billing** — If Stripe (or similar) is used, webhooks or the **app server** (`apps/app`, Astro SSR) update **Supabase** subscription/trial fields; reconciliation jobs are secondary, not a second source of truth.

**Format note:** This file is versioned as Markdown in-repo (`ACTIVE_GROWTH_ENGINE_ROADMAP.md`). Export to `.doc` for stakeholders if needed.

## Development schedule status

- **Current phase:** **Not started** — all phases below are **incomplete** in this codebase (begin with the Prerequisite, then Phase A).
- **Last updated:** 2026-03-27
- **Source of truth registry:** `apps/app/src/lib/admin/analytics-datasets-registry.ts`
- **Planned Phase A scope (when started):** route shell, static command center cards, detail-page template, sidebar/navigation wiring, canonical dataset inventory module.

---

## 1. Problem statement

- **Dashboard fatigue:** Teams scan many independent tables (`Monetization drop-off`, `App activity`, retention cohorts, UTM breakdowns) without a single narrative.
- **Latency to action:** High-value segments (reverse-trial expiring, paywall abandoners, high-intent free users) are hard to operationalize into CRM pushes, copy tests, or engineering fixes.
- **Feature investment ambiguity:** Adoption counts alone do not show which behaviors **correlate with conversion** or **reduce churn**.

**Product bet:** A dedicated **Active Growth Engine** page becomes the daily starting point; underlying analytics remain drill-down **detail pages**—one per major table/dataset.

---

## 2. Vision: prescriptive, not only descriptive

| Mode | Question | Typical UI |
|------|-----------|------------|
| Descriptive | What happened? | Tables, charts, filters |
| Diagnostic | Why did it happen? | Breakdowns, cohorts, funnels |
| **Prescriptive (this roadmap)** | **What should we do?** | **Alert cards, scored lists, directives, experiment backlog** |

The engine **aggregates** signals across datasets, applies **rules + optional LLM synthesis**, and outputs **scoped actions** (Marketing / Product / Engineering) with **traceability** back to source metrics.

---

## 3. Page architecture (v1 blueprint)

### 3.1 The Daily Command Center — AI insights & directives

**Placement:** Top of the Active Growth Engine page (first screen).

**UX:** Three **alert cards** (expandable). **Do not rely on a single nightly batch for all three:** bottom-of-funnel and reverse-trial urgency need fresher signals (see §5.2). Admins still get a **daily brief** from batch jobs, plus **real-time or near-real-time** alerts where latency would destroy win-back rate (e.g. checkout abandonment).

**Card slots (fixed taxonomy for v1):**

1. **Top conversion opportunity (Marketing)** — segments with high value realization + impending paywall / trial deadline + no purchase.
2. **Top UX friction (Product)** — divergence between “value” events (e.g. workouts generated) and “completion” or “return” events; funnel step regression vs baseline.
3. **Top revenue / reliability leak (Engineering)** — checkout failures, client errors on monetization paths, webhook or provisioning anomalies (when instrumented).

**Each card must include:**

- **Signal** (metric + time window + threshold)
- **Evidence** (links to underlying detail pages / queries)
- **Recommended action** (one primary, optional alternates)
- **Owner** (Marketing | Product | Engineering) and **severity** (P0–P3)

**Non-goal for v1:** Fully autonomous execution (no auto-sending pushes without human approval).

---

### 3.2 The conversion pipeline — who to target

**UX:** Sortable, filterable **pipeline table** with a computed **Lead score (1–100)**.

**Inputs (examples; bind to actual admin data sources as they exist):**

- **Time to first key action** (from funnel / app activity)
- **App activity** (frequency, recency, depth—e.g. sessions started vs completed; bind to your rollup)
- **Monetization history** (paywall touches, checkout started, server-verified return success, subscription activated)
- **Growth / trial state** — must come from a **single enumerated field** on the user record used for admin + scoring (see §9 and **Prerequisite: growth state machine** below), not recomputed ad hoc in every job.

**Columns (v1 target):**

| Column | Notes |
|--------|--------|
| User | Pseudonymized display + internal id; avoid raw PII in default view |
| Lead score | Transparent scoring version + top 3 drivers (tooltip) |
| Trial status | Phase, days remaining, or post-trial free |
| AI conversion insight | Short “why” string; must cite feature IDs / event names used |
| Recommended messaging trigger | Template key + channel (email, push, in-app) |

**Guardrails:**

- **Explainability:** Score breakdown stored as structured JSON for audit (“+20 high workout volume”, “+15 paywall abandon <24h”).
- **Privacy:** Role-based access; export/logging policies aligned with existing admin auth.

---

### 3.3 Feature ROI matrix — what to improve

**UX:** **2×2 matrix**: Adoption (high/low) × Conversion correlation (high/low/unknown) **plus** a summary table.

**Data:**

- **Adoption:** 30-day (or 7-day) active usage of feature flags / events from **app activity** rollups (or equivalent).
- **Correlation:** Statistical or heuristic phase-1 (e.g. “upgraded within 7d of first use” vs control cohort); upgrade to proper models later.

**Table columns (v1 target):**

| Feature | Adoption | Correlates to upgrade? | AI product directive |
|---------|----------|------------------------|----------------------|
| … | High / Med / Low | Strong / Weak / Unknown | Single prioritized recommendation |

**Directives** should map to **instrumentation gaps** when correlation is Unknown (“add event X before claiming ROI”).

---

### 3.4 Messaging & UI optimization engine

**UX:** “Feedback loop” panel: **active experiments** + **suggested copy / UI tests** queue.

**Inputs:**

- **UTM breakdown** and **top landing pages** (intent segments)
- **Retention cohorts** (early churn vs sticky users)
- **First-key-action timing** (slow paths → churn)

**Outputs:**

- Suggested **message variants** (stored as drafts; human approve)
- Suggested **UI experiments** (hypothesis, metric, primary page)

---

## 4. Detail pages: one per analytics table (feeds the engine)

**Principle:** The Growth Engine **does not replace** deep tables; it **summarizes** them. Each major **`AnalyticsView`** block (or logical grouping) gets a **dedicated detail route** that:

1. Shows the **full table/chart** with filters, date range, exports.
2. Surfaces **definitions** (metric glossary, event names, data source).
3. Exposes **structured summary** (JSON or API) for the batch job / LLM context builder.

**Suggested initial detail page map (iterate as sections exist):**

| Detail page | Primary data | Feeds into |
|-------------|--------------|------------|
| Monetization drop-off | `analytics_events` (app purchase funnel) | Revenue leak card, lead scoring (abandon recency) |
| Onboarding drop-off | `analytics_events` | Friction card, first-action timing |
| App activity | App activity rollup (existing admin query) | Feature matrix, friction narrative |
| Retention cohorts | Cohort queries | Messaging engine, trial urgency |
| Monetization candidates | Supabase-backed candidates query or admin API | Conversion pipeline, marketing card |
| Monetization (Phase 5) | Supabase `profiles` / program KPIs | Strategic context; avoid double-counting with funnel tables |
| UTM / landing pages | Attribution tables | Messaging & UI optimization |
| Interventions & outcomes | `intervention_logs` (+ joins to funnels / subscription state) | §7 efficacy metrics, Phase G “what worked” narratives |

**Routing sketch:** `/admin/analytics/growth-engine` (command center) + `/admin/analytics/details/:datasetKey` (or Astro dynamic routes under admin).

---

## 5. System architecture (implementation)

### 5.1 Data plane

- **Source of truth:** **Supabase** analytics tables + admin APIs (`/api/admin/analytics/*`). Subscription/trial state, **`growth_state`**, and profiles live in **Supabase** (e.g. `public.profiles` or `shared.profiles` per your schema); Stripe (or your billing provider) updates them via **app server webhooks** or trusted jobs—**no parallel Firebase store**.
- **Aggregation jobs (batch):** Scheduled worker (cron, GitHub Action, or edge function) that:
  - Pulls **snapshots** or **incremental** rollups into `growth_engine_snapshots` (new table, optional) **or**
  - Computes on read for v0 (acceptable only at low scale).
- **Intervention log (close the loop):** New table **`intervention_logs`** (name flexible) to measure whether directives actually moved metrics:
  - **Minimum columns:** `id`, `created_at`, `insight_id` (or rule run id), `directive_type`, `channel` (push | email | in_app | experiment | eng_ticket), `subject_type` (`user` | `segment` | `global`), `subject_id` (nullable for segment/global), `action_taken` (enum or short string), `performed_by` (admin user id), optional `metadata` (jsonb: template key, campaign id, experiment id).
  - **Purpose:** Powers §7 **directive follow-through**, **intervention efficacy**, and Phase G narratives (“yesterday’s checkout-abandonment push → N conversions”) by joining to funnel/subscription outcomes.
  - **UI:** Growth Engine or detail pages expose **“Log action”** when team deploys push/email/etc. (human-in-the-loop v1; optional automation later).

### 5.2 Insight plane — two speeds (batch vs real-time)

Reverse trials and checkout abandonment are **time-sensitive**. A **nightly-only** insight job fits cohorts and feature ROI; it is **misaligned** with win-back windows (e.g. user abandons Stripe and the impulse fades long before the next cron).

**Batch (nightly / hourly coarse)** — use for:

- **Feature ROI matrix** rollups and adoption × correlation tables.
- **Lead scoring** full recompute (if expensive) and **daily brief** assembly for Product/Engineering-style cards that do not require sub-hour latency.
- Cohort and retention summaries.

**Event-driven or near-real-time** — use for:

- **Top revenue leak / checkout abandonment:** e.g. `purchase_checkout_session_created` (already written to **`analytics_events`** from app server ingest) **without** `purchase_subscription_activated` or verified **`purchase_return_success`** within **T minutes** (recommended first value: **30**; tune with data).
- **High-urgency reverse-trial windows** (e.g. transition into `trial_expiring_24h`) for Marketing alerts and CRM triggers.

**Implementation patterns** (pick one per environment; all align with the app server → **`analytics_events`** pipeline):

1. **Scheduled high-frequency poller** (e.g. every 5–10 min): query recent `purchase_checkout_session_created` rows, verify absence of downstream funnel events or check Stripe session status, enqueue alert / CRM webhook. Often the simplest operationally.
2. **Supabase Edge Function + pg_cron or queue:** on funnel insert or periodic job, evaluate “stale checkout” predicate and write to `growth_realtime_alerts` or call messaging provider (behind feature flag).
3. **Vercel cron / same host as admin:** lightweight worker that reads Supabase only—keeps analytics in one database with no second write path.

**Rule:** Real-time path emits **structured alert records** the Growth Engine UI can show immediately; batch job **merges** them into the next **daily_brief** for narrative consistency. Dedupe by **`stripe_checkout_session_id`** (or equivalent) so the same user is not spammed every poll.

### 5.3 Rules & narrative layers

- **Phase 0 (rules engine):** YAML/TS rules (“if paywall_opened and not checkout_started in 24h and workouts_generated ≥ 3 → candidate”). Deterministic, testable. **Do not implement scoring rules until the growth state machine exists** (§6 Prerequisite).
- **Phase 1 (LLM synthesis):** LLM **only narrates** pre-computed structures; no hallucinated numbers. Prompt includes **verbatim metrics JSON** + **links** to detail pages + optional **`intervention_logs`** outcomes for “what worked yesterday.”
- **Phase 2 (deeper reasoning):** Optional embeddings / retrieval over historical directives and outcomes (measure what worked).

### 5.4 Admin UI plane

- New **Growth Engine** view component (React island in `apps/app` admin, consistent with `AnalyticsView` styling).
- Cards + tables consume **`GET /api/admin/growth-engine/summary`** (new), optionally **`GET /api/admin/growth-engine/alerts/realtime`** for the fast path.

### 5.5 Observability

- Log **insight run id**, **inputs hash**, **rule version**, **model version** (if LLM), **latency**, and whether the run was **batch** vs **realtime**.
- Store **last N** daily briefs for diffing (“what changed since yesterday?”).

---

## 6. Phased delivery

### Prerequisite (before rules engine + lead score) — growth state machine

**Gate:** Do **not** start **Phase C rules** or **Phase D scoring** until this is shipped. **Phase A/Phase B UI scaffolding may proceed in parallel.**

- [ ] Define the **canonical user growth state** as a **single mutually exclusive enum** at all times (extend only with care):

  | State | Meaning (sketch) |
  |-------|------------------|
  | `trial_active` | Reverse trial (or trial) in days 0–N; full premium access per product rules |
  | `trial_expiring_24h` | High-urgency window before trial end (drives Marketing real-time alerts) |
  | `downgraded_free` | Trial ended without conversion; on free tier |
  | `subscriber_active` | Paying / active subscription |
  | `churned` | Operational definition: e.g. inactive 30+ days or account deleted (product-defined) |

- [ ] **Persist** `growth_state` (and optionally `growth_state_updated_at`, `trial_ends_at`) on the **authoritative profile row the Growth Engine reads** — recommended: **Supabase `profiles`** (or adjacent table keyed by stable user id) so admin SQL, lead scoring, and `intervention_logs` joins stay simple.
- [ ] **Keep in sync with product reality:** billing/subscription truth is **Stripe (or your provider) + Supabase**; the **app** or **Stripe webhook** path must **update** `profiles` (including `growth_state`) on subscription/trial transitions (scheduled reconciliation is for drift correction, not the primary definition).
- [ ] Document transitions (state diagram) and who owns each write path (**app** client, Stripe webhook, scheduled reconciler).

### Phase A — Foundation (descriptive → diagnostic glue)

- [ ] Add **Growth Engine** shell route + placeholder cards wired to **static copy**.
- [ ] Inventory every **AnalyticsView** section → **datasetKey** + API + owner.
- [ ] First **detail page** template (reusable layout: filters, glossary, export).

### Phase B — Detail pages & APIs

- [ ] Implement **detail routes** for top 3 datasets (Monetization drop-off, App activity, Retention).
- [ ] Add **`/api/admin/growth-engine/context`** returning **structured JSON** for each dataset (for jobs and future LLM).
- [ ] Add **`intervention_logs`** migration + **`POST /api/admin/growth-engine/interventions`** (admin-auth) for logging actions.

### Phase C — Rules-based Command Center (split batch + real-time)

- [ ] **Batch:** Nightly (or hourly) job writes **daily_brief** record — Feature ROI inputs, cohort summaries, non-urgent Product/Engineering cards.
- [ ] **Real-time / near-real-time:** Checkout-abandonment detector (§5.2) feeding **alert queue** or equivalent; surface on Growth Engine within minutes, not next morning.
- [ ] Implement **rule pack v1** for the three alert cards, with **explicit** binding: which rules run in **batch** vs **realtime**.
- [ ] UI reads latest **daily_brief** + **live alerts** + shows evidence links to detail pages.

- Marketing reverse-trial urgency rules remain gated until the growth state machine prerequisite ships.

### Phase D — Conversion pipeline & scoring

- [ ] Define **lead score spec v1** (document weights; version in DB) — **`growth_state` is a required input feature**.
- [ ] Pipeline table with **explainability** tooltips.
- [ ] Optional: CSV export for CRM (with audit log).
- Growth-state synchronization may use scheduled reconciliation; prefer **event-driven** app or Stripe webhook updates; ownership of each write path should stay documented.
- **Conversion pipeline user source (this repo):** default to **Supabase `profiles`** joined to **`auth.users`** (no alternate user store). Environment toggles like `GROWTH_PIPELINE_USER_SOURCE` should resolve to **Supabase-only** backends if present.
- **Funnel attribution contract:** Events in **`analytics_events`** should set **`user_id`** to the **Supabase Auth user UUID** when known; optional **`properties`** may hold extra context, but lead scoring and joins should not depend on a non-Supabase id.

### Phase E — Feature ROI matrix

- [ ] Feature → event mapping table (config, not hardcoded).
- [ ] Adoption rollups + **phase-1 correlation** heuristic.
- [ ] Matrix viz + directive column.

### Phase F — Messaging & experiments loop

- [ ] Integrate UTM / landing / cohort summaries into suggestion queue.
- [ ] “Propose experiment” flow (creates draft record; does not auto-launch).
- [ ] Wire **intervention logging** into primary workflows (push/email/experiment launched) so §7 metrics are measurable.

### Phase G — LLM narrative layer (optional)

- [ ] Strict **grounding** prompts (verbatim JSON context + JSON-only model output); post-parse **digit grounding** check (`assertNarrativeDigitsGrounded`).
- [ ] Feature flag: **`GROWTH_ENGINE_NARRATIVE_ENABLED`** — **rules-only** (default) vs **rules + narrative** (requires `GEMINI_API_KEY`).
- [ ] Batch writes optional `summary.narrative` on `daily_brief`; **`GET /api/admin/growth-engine/summary`** exposes `narrative` + `narrativeEnabled`; Growth Engine UI shows executive blurb + per-card **AI narrative** (`<details>`).

**Red-team / QA checklist (numeric fabrication):**

1. With narrative **off**, confirm batch job completes with **no** `llm_narrative_*` metrics and **no** Gemini traffic.
2. With narrative **on** and key set, run batch; confirm `daily_brief.metrics.llm_narrative_status` is `ok` or a documented `skipped` / `error`.
3. Inspect narrative text: any digits should appear in the grounding context (cards, `batchMetrics`, interventions, alert counts) — automated test covers the validator; spot-check for qualitative-only summaries when needed.
4. Temporarily inject a bad mock response with a fabricated large integer and confirm grounding **throws** before persist (unit test: `growth-engine-narrative-grounding.test.ts`).

---

## 7. Success metrics (for the Growth Engine itself)

- **Time-to-first-action** for growth team: median minutes from login to **identified priority** (survey + analytics on page engagement).
- **Directive follow-through rate:** % of P1/P2 directives with a matching **`intervention_logs`** row **and** marked outcome within SLA (define “done”: logged deploy, ticket closed, etc.).
- **Intervention efficacy:** For logged interventions, conversion / return-to-checkout / subscription lift in holdout vs treated (join `intervention_logs` → `analytics_events` / subscription state).
- **Real-time alert latency:** p95 minutes from `purchase_checkout_session_created` to **eligible** abandon alert (target ≪ 18h).
- **Pipeline quality:** uplift in conversion or reactivation among **top decile** lead scores vs control (holdout).
- **Trust:** false-positive rate on alerts (stakeholder downvotes); target downward over time.

---

## 8. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| LLM invents metrics | Numbers only from JSON payload; forbid free-form stats in prompt output schema |
| Duplicate signals (e.g. app UI vs funnel vs `profiles` KPIs) | Document **which KPI answers which question**; label cards clearly |
| PII leakage in insights | Pseudonymize defaults; restrict exports; audit logs |
| Score opacity | Mandatory driver breakdown + score version |
| Over-automation | Human approval for customer-facing actions |
| Nightly-only insights miss checkout win-back | **Two-speed** insight plane (§5.2); dedupe real-time alerts |
| Lead score drift / opacity | Versioned scoring spec + required **`growth_state`** input |
| Cannot prove ROI of AI directives | **`intervention_logs`** + outcome joins (§5.1, §7) |

---

## 9. Open decisions (remaining)

The following are **still** product choices, but **trial/reverse-trial semantics and enum states are no longer “open during build”** — they are **Prerequisite** in §6.

- **Trial length and clock start:** calendar days since `X` event (signup, first workout, feature flag) — document once; drives `trial_active` → `trial_expiring_24h` automation.
- **Churned definition:** exact inactivity window and whether uninstall is observable.
- **`profiles.growth_state` write path:** confirm whether updates come from **`apps/app`**, **Stripe webhooks** (or billing provider), a **Supabase Edge Function**, or **reconciliation job** (prefer event-driven updates; single source of truth in Supabase).
- **Where batch vs realtime jobs run:** same host as admin vs separate worker vs edge (cost vs simplicity).
- **LLM provider & data residency:** align with company policy.

---

## 10. Appendix — mapping to the conceptual examples in the brief

The three alert card examples in the product brief map to **rule templates**:

- **Marketing opportunity:** `reverse_trial_expiry_horizon` + `workouts_generated ≥ N` + `no purchase_subscription_activated` in window.
- **Product friction:** `workouts_generated` vs `workout_completed` ratio vs baseline.
- **Engineering leak:** client error rate on checkout paths or **failed** verified checkout-success validations (when instrumented).

The **conversion pipeline** examples map to **lead score features** + **messaging templates** (loss aversion, win-back, value discovery).

The **Feature ROI matrix** examples map to **feature→event config** + **correlation tier** output.

**Checkout abandonment (real-time path)** maps to **`purchase_checkout_session_created`** in `analytics_events` vs downstream **`purchase_subscription_activated`** / **`purchase_return_success`** (see **`apps/app`** and server instrumentation); the poller or edge job should use the same event names the **Monetization drop-off** detail page documents.

---

*Document status: **ACTIVE** — draft for engineering & growth alignment. All phases are **incomplete** in this repo until checkboxes are marked done.*

## 11. Dataset registry (canonical source)

The canonical Active Growth Engine dataset registry is maintained in:

- `apps/app/src/lib/admin/analytics-datasets-registry.ts`

Use that module as the source of truth for:

- Dataset keys used by `/analytics/details/:datasetKey`
- Dataset labels and API paths shown in Growth Engine detail pages
- Inventory alignment between `AnalyticsView` and upcoming Growth Engine APIs

**Supabase (this repo):** One database project and CLI/MCP setup are documented in **`docs/COMMANDS.md`** (§ Supabase) and **`supabase/README.md`** (schemas `public` / `amrap` / `shared`, migrations).
