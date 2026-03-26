# Training Log: displaying MET / energy calculations

Design for surfacing **how numbers are derived** in `WorkoutSummaryModal.tsx` and `TrainingLogAnalytics.tsx`, aligned with `@/lib/met` (BMR, TAM, TDEE, session MET estimate).

## Goals

- **Transparency:** Users see what is measured (log fields) vs. what is **estimated** (physics-style models).
- **Consistency:** One shared mental model: profile baseline → BMR/TAM/TDE E; per workout → MET × weight × time (optional effort scaling later).
- **Graceful degradation:** If `hasBaselineForMET` is false, show the same nudge pattern as `TrainingLog.tsx` (link to `/account/profile`) instead of fake precision.

## Source of truth (today)

| Concept                 | Implementation                                        | Notes                                                                                          |
| ----------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| BMR                     | `computeBMR`                                          | Mifflin–St Jeor; needs DOB, sex, weight, height.                                               |
| TAM                     | `resolveTotalActiveMultiplier`                        | Stored `total_active_multiplier`, or lifestyle + workout, or legacy `activity_level_baseline`. |
| TDEE                    | `computeTDEE`                                         | `BMR × TAM`. Daily context, not a single session.                                              |
| Session MET             | `inferMETFromWorkout(source, workoutFormat)`          | Coarse table (`MET_VALUES` + string heuristics).                                               |
| Session kcal (estimate) | `estimateCalorieBurn(met, weightKg, durationMinutes)` | `MET × weight_kg × (min/60)`.                                                                  |
| Logged kcal             | `WorkoutLog.calories`                                 | Optional; may come from devices or manual entry.                                               |
| Effort                  | `WorkoutLog.effort` (1–10)                            | Documented as RPE-like; **not** yet applied in `estimateCalorieBurn`.                          |

## Non-goals (this design pass)

- Persisting per-log `met_estimate` in the database (optional follow-up).
- Replacing MET table with exercise-level compendium values.
- Showing medical claims; copy should stay **estimate** / **for reference**.

---

## 1. Workout summary modal

**File:** `apps/app/src/components/react/training-log/WorkoutSummaryModal.tsx`

**Current behavior:** Duration, date, effort, rating, intensity, focus, notes — no energy line.

### 1.1 Data requirements

- Extend props (preferred): `profileBaseline: ProfileBaseline | null` **or** consume `useAppContext().user` mapped to `ProfileBaseline` inside the modal (keeps call sites simple; modal stays a leaf).
- Reuse `hasBaselineForMET`, `inferMETFromWorkout`, `estimateCalorieBurn`, and optionally `resolveTotalActiveMultiplier` / `computeTDEE` only if we show a **single-line daily context** (see below).

### 1.2 UI blocks (recommended order)

1. **Existing grid** (unchanged order of factual log fields).
2. **Energy estimate** (new section), only if `hasBaselineForMET(baseline)`:
   - **Headline:** `Estimated burn` — **N kcal** (rounded to nearest integer).
   - **Subline:** `Based on ~X MET · Y min · your profile weight` (X = `inferMETFromWorkout`, Y = duration in minutes from `durationSeconds`).
   - **If `workout.calories` is set:** show two lines — `Logged: N kcal` and `Estimated: M kcal` with short note: _Estimates use typical intensity for this format; logged values override for your records._
3. **“How this is calculated”** — collapsible `<details>` or chevron disclosure (mobile-friendly):
   - Formula text: _kcal ≈ MET × body weight (kg) × (duration in hours)_.
   - MET source: _Format-based default (e.g. HIIT ~8 MET). Not a lab measurement._
   - Effort: _Effort 1–10 is shown above; optional future use to adjust the estimate._

### 1.3 Baseline missing

- Replace energy block with compact CTA matching Training Log nudge: link to `/account/profile` to unlock estimates.

### 1.4 Optional: TDEE snippet

- One muted line under the estimate: _Your estimated daily burn (TDEE) is about **Z kcal/day** using your activity profile._
- Use `computeTDEE(baseline)` only when BMR is valid (same gate as MET).
- **Copy guardrail:** Clarify TDEE is **not** added to session kcal (avoid double-counting narrative).

### 1.5 Accessibility

- Disclosure control must be a `<button>` with `aria-expanded`.
- Do not rely on color alone for “logged vs estimated” — use labels.

---

## 2. Training Log analytics

**File:** `apps/app/src/components/react/training-log/TrainingLogAnalytics.tsx`

**Current behavior:** `AnalyticsSummaryCards` (minutes, streak, goal %), weekly volume chart, insights, distributions — all **time- and count-based**.

### 2.1 Principles

- **Analytics aggregates** should use the **same** per-session estimate as the modal (single helper, e.g. `estimateSessionKcalFromLog(log, baseline)` in `lib/met` or `lib/training-log-utils.ts`) so numbers match when a user drills from chart → modal.
- Respect **filters:** totals should be computed from the same `logs` array already fetched via `getTrainingLogLogsForExport` (already filter-aware), not only from `useTrainingLogAnalytics` rollups unless those rollups are extended server-side.

### 2.2 New summary region (below `AnalyticsSummaryCards` or as a fifth card row)

**When `hasBaselineForMET`:**

- **This week (energy):** Sum estimated kcal for sessions in the current week (define “week” consistently with existing analytics Monday boundary — reuse `getWeekMonday` pattern from `training-log-insights.ts` or shared util).
- **This month (energy):** Same, calendar month or rolling 30 days — **pick one** and document in UI microcopy (recommend: **calendar month** to align with existing insight logic in `generateInsights`).
- **Avg per session:** `totalEstimatedKcal / sessionCount` for filtered logs in period.

**When baseline incomplete:**

- Single card: _Complete profile to see estimated calorie burn trends_ + link.

### 2.3 Chart (phase 2, optional)

- **Weekly estimated kcal** line or bar series parallel to `WeeklyVolumeChart` (second axis or small multiples).
- Same `weekKey` buckets as `data.weeklyVolume` — either extend `getTrainingLogAnalytics` return type or derive client-side from `logs` to avoid duplicate SQL paths initially.

### 2.4 Profile context strip

- Subtle banner: _Estimates use weight **X kg** and activity multiplier **TAM Y** (from profile)._
- If weight or TAM changes, next fetch reflects new values — no historical recompute unless we snapshot later (out of scope).

### 2.5 Insights (`generateInsights`)

- Optional new rules (phase 2): e.g. _Estimated burn up/down vs last month_ — only if product wants parity with volume insights; avoid noise if MET table is coarse.

---

## 3. Shared implementation sketch

```text
estimateSessionKcalFromLog(log: WorkoutLog, baseline: ProfileBaseline): number | null
  if (!hasBaselineForMET(baseline) || !log.durationSeconds) return null
  const met = inferMETFromWorkout(log.source, log.workoutFormat)
  const min = log.durationSeconds / 60
  return Math.round(estimateCalorieBurn(met, baseline.weightKg!, min))
```

- **Logged calories:** If `log.calories != null`, analytics might show **both** “sum logged” and “sum estimated” in advanced mode; v1 can show **estimated only** for consistency with the modal headline, and show logged sum only if ≥1 log has calories.

---

## 4. Copy and trust

- Prefer **Estimated** / **about** / **typical intensity** in all user-visible strings.
- Footnote that TDEE and session kcal serve different purposes: TDEE = whole day; session line = **incremental** exercise for that logged duration.

## 5. Testing

- Unit tests: `estimateSessionKcalFromLog` for known log + baseline fixtures; boundary (zero duration, missing weight).
- UI: snapshot or RTL test for modal with and without baseline; analytics card hidden vs shown.

## 6. Open decisions

1. **Effort scaler:** When implemented, apply in **one** place used by modal + analytics.
2. **Logged vs estimated prominence:** If both exist, which is primary in the modal (product choice).
3. **Weekly kcal chart:** Client-derived from `logs` first vs extending Supabase analytics query.
