# HUD Progress Zone — behavior, gaps, and roadmap

This document explains why the **Progress** card (`ProgressZone.tsx`) may show no real analytics, and outlines work to align it with the rest of the HUD / Training Log.

## Current implementation (as shipped)

### Shell behavior

- **`ProgressZone`** (`apps/app/src/components/react/hud/ProgressZone.tsx`) renders two **mutually exclusive** UIs:
  - **`!isPaid`**: Copy (“X workouts completed this week”), **placeholder static bars**, optional upgrade CTA. **No live charts** and no calls to chart data loaders in the paid branch.
  - **`isPaid`**: Tab strip **Volume** | **Consistency** | **PRs** with real components:
    - `VolumeChart.tsx` — Recharts area chart, sets per week
    - `ConsistencyHeatmap.tsx` — 52×7 grid of days
    - `PRFeed.tsx` — list of personal records

`isPaid` comes from `AppContext`: `!!user?.isAdmin || purchasedIndex !== null` (see `AppContext.tsx`).

### Planned access model change (reverse trial)

Product direction: **Progress Zone analytics should be available to all users while reverse trial is active**.  
Implication: current `isPaid` gate in `ProgressZone` (placeholder for unpaid users) was a temporary mismatch with the upcoming model.  
Update status: implementation now uses trial-aware access gating (`paid OR in-trial OR admin`) for Progress analytics.

### Data sources (critical)

All three tabs now fetch from **`apps/app/src/lib/supabase/client/progress-analytics.ts`**. Data source behavior is:

| Tab           | Query / logic |
|---------------|----------------|
| **Volume**    | `getVolumeByWeek`: sums **minutes per week** from merged logs (`workout_logs`, `user_workout_logs`, AMRAP), excluding Readiness rows. |
| **Consistency** | `getWorkoutDates`: merged distinct dates from `workout_logs`, `user_workout_logs`, and AMRAP results (Readiness excluded). |
| **PRs**       | `getPersonalRecords`: scans `exercises` for **completed** sets with **`actualWeight` > 0**, tracking max weight per exercise over time. |

### What the Training Log uses instead

`fetchWorkoutLogsForTraining` (`workout-logs.ts`) merges:

- **`workout_logs`** — summary/timer/handoff rows (effort, duration, etc.; generally **no** per-set JSON in this path for analytics here)
- **`user_workout_logs`** — program sessions (same table as Progress Zone)
- **AMRAP session results** — synthetic `WorkoutLog` rows

**Quick stats** and **Training Log preview** use this **merged** list. **Progress Zone does not.**

---

## Why “no stats” appears (troubleshooting)

Use this order:

1. **No analytics access (post-trial unpaid state)**  
   Placeholder + upgrade message render by design. Trial-active and paid/admin users should see live charts.

2. **`isPaid` is true but tabs show empty copy**  
   - **Volume**: “Log your first workout to see trends” when **no week has `setsCount > 0`** (no completed sets in `user_workout_logs` in the window).  
   - **Consistency**: “Log workouts to see your consistency” when **`user_workout_logs` returns no rows** in the date range.  
   - **PRs**: “No PRs yet…” when no qualifying weighted, completed sets exist.

3. **User logs plenty in the Training Log but still sees empty Progress Zone**  
   Very likely: activity lives in **`workout_logs`** and/or **AMRAP**, not in **`user_workout_logs`** with structured exercise/set data. The app **shows** those sessions in the log; **Progress Zone analytics ignore them today**. This is the main **product/data gap**, not a random bug.

4. **RLS / network errors**  
   Charts now render a small inline error state when analytics fetch fails. Check browser network tab and Supabase logs in dev.

---

## Roadmap — complete Progress Zone

### Phase 0 — Access parity for reverse trial (highest priority)

Goal: expose Progress analytics to all users until trial expiry.

- [ ] Replace direct `isPaid` UI gating in `ProgressZone` with a new access flag (e.g. `hasProgressAccess`) that resolves true for:
  - active reverse-trial users,
  - paid users,
  - admins.
- [ ] Keep upgrade messaging decoupled from chart availability (CTA can still render while charts are visible).
- [ ] Add an explicit expiry path: once trial ends and user is not paid, swap to gated UX.
- [ ] Add temporary in-code note where gating is changed to reference reverse-trial rollout, so future cleanup is clear.
- [ ] Add QA scenarios:
  - unpaid + active trial => live charts visible,
  - unpaid + expired trial => gated placeholder,
  - paid/admin => live charts.

### Phase A — Product clarity (low effort)

- [ ] Add a **short line of helper text** under the paid tabs (or in empty states) that explains: “Progress analytics are based on **program workouts with logged sets**” or “Based on **structured workout logs**,” so users who only use quick log / timers don’t assume the feature is broken.
- [ ] Optionally surface **query errors** (toast or inline) instead of silently treating errors as empty data.

### Phase B — Align data with Training Log (medium effort)

Goal: **same conceptual “sessions” as `fetchWorkoutLogsForTraining`**, where feasible.

- [ ] **Consistency heatmap**  
  - Include **distinct dates** from:
    - `workout_logs` (exclude `workout_name = 'Readiness'`),
    - `user_workout_logs`,
    - AMRAP completion dates (reuse patterns from `getStreakData` or `fetchWorkoutLogsForTraining`).  
  - Reuse or extract a small shared helper so streak / heatmap / training log don’t disagree.

- [ ] **Volume chart**  
  - Define a **single metric** that applies across sources, e.g.:
    - **Option 1**: `user_workout_logs` set counts only (current) + **fallback**: count **sessions** per week from merged logs when set counts are unavailable (e.g. 1 “session” per `workout_logs` row per day).  
    - **Option 2**: minutes per week from merged logs (aligns with Training Log preview) — different chart semantics than “sets.”  
  - Document the chosen definition in the UI.

- [ ] **PR feed**  
  - Only meaningful if **`workout_logs` or other sources** store structured weights. If not, either:
    - keep PRs **program-only** and label clearly, or  
    - extend schema / ingestion so hand-logged PRs can appear (larger scope).

### Phase C — Post-trial gating UX (optional)

- [ ] Replace static placeholder bars with **blurred preview**, **sample data**, or **screenshot** so the value prop is clearer without implying live data (applies only after trial expiry when user has no access).  
- [ ] Or show **read-only aggregate** (e.g. “sessions this week” from public summary) if business rules allow.

### Phase D — Hardening

- [ ] Unit tests for `getVolumeByWeek` / merged date helpers with **mixed** `workout_logs` + `user_workout_logs` fixtures.  
- [ ] Loading states are already present; ensure **tab switches** don’t flash empty before cache (optional `keepMounted` or skeleton).

---

## Files reference

| Area | File |
|------|------|
| Progress card shell | `apps/app/src/components/react/hud/ProgressZone.tsx` |
| Charts | `VolumeChart.tsx`, `ConsistencyHeatmap.tsx`, `PRFeed.tsx` |
| Analytics API | `apps/app/src/lib/supabase/client/progress-analytics.ts` |
| Merged training log | `apps/app/src/lib/supabase/client/workout-logs.ts` (`fetchWorkoutLogsForTraining`) |
| Paid flag | `apps/app/src/contexts/AppContext.tsx` |

---

## Summary

| Question | Answer |
|----------|--------|
| Is the implementation “incomplete”? | **Partially.** Access parity and merged dates/minutes are implemented; PR data remains scoped to structured set/weight logs. |
| Why no stats for a paid user? | Often **no structured program logs**, or **no weighted sets** — not necessarily missing code paths. |
| Fastest fix? | **Phase 0 access update first** (reverse-trial parity), then **merge** heatmap/volume inputs with `workout_logs` / AMRAP for session-level visibility. |

## Auth/account alignment note (Phase 4 follow-up)

When implementing copy updates in [docs/ROADMAP_AUTH_AND_ACCOUNT_REFACTOR.md](./ROADMAP_AUTH_AND_ACCOUNT_REFACTOR.md) Phase 4, align account/HUD messaging with current Progress behavior:

- Account-page and HUD CTA copy should describe Progress as **unified workout analytics in HUD**.
- Upgrade copy should not imply trial-active users are blocked from Progress charts.
- PR section copy should explicitly mention structured set-weight logging scope until broader PR ingestion is added.
