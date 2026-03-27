# Training Log: Week Intensity Charts — Planning

This document captures **where effort and intensity-related data live today**, **gaps that affect accuracy**, and a **concrete implementation plan** for two visuals under the weekly “Week Load” card:

1. **Per-workout bar chart** — each logged session as one bar, **0–100%** on a scale described as “resting heart rate equivalent → max heart rate effort.”
2. **Week timeline (wave) chart** — **intensity across Mon–Sun** to surface training distribution and simple “cycle” patterns.

---

## 1. Where “Effort” (1–10) comes from

| Source | Location | Behavior |
|--------|----------|----------|
| **DB column** | `workout_logs.effort` (integer) | Canonical field on summary/timer logs. Mapped in `mapRowToWorkoutLog` in `apps/app/src/lib/supabase/client/workout-logs.ts`. |
| **Save / update API** | `saveWorkoutLog`, `updateWorkoutLog` in same file | Insert includes `effort`; updates allow changing `effort`, `rating`, `notes`. |
| **Post-session UI (programs hub)** | `LogWorkoutModal.tsx` | Slider **1–10**, labeled “Bio-Stress (Effort)”, default **5**, saved via parent `onSave`. |
| **Calendar / timer events** | `TimerActivityDrawer.tsx` | Loads `metadata.effort`, allows edit; persists updates with effort clamped **1–10**. |
| **Handoff (timers → signed-in user)** | `log-handoff.ts` | Inserts row with **`effort: 5` fixed** — user does not set effort at handoff time unless a later edit flow exists. |
| **Program completions (WorkoutPlayer)** | `fetchUserWorkoutLogsForTraining` → `mapUserWorkoutLogRowToWorkoutLog` | Select does **not** include effort; mapper uses **`effort: 5`, `rating: 3`** always. **These sessions have no real subjective effort today.** |
| **AMRAP backfill rows** | `fetchWorkoutLogsForTraining` (merge from `getAmrapSessionResults`) | Synthetic `WorkoutLog` rows use **`effort: 5`** default. |
| **Workout Summary modal** | `WorkoutSummaryModal.tsx` | Displays **Effort: x/10** from the log; editing effort would require calling `updateWorkoutLog` (verify if already wired — display is present). |

**Takeaway:** The **1/10 in your screenshot** is `WorkoutLog.effort` for rows that actually came from `workout_logs` with user-entered or default values. **Program-tracked sessions and AMRAP fallbacks are mostly “neutral 5” unless enriched later.**

---

## 2. MET and “physiological” estimates today

| Piece | Location | Notes |
|-------|----------|------|
| **Per-session MET + kcal** | `apps/app/src/lib/met/index.ts` — `getWorkoutMetSessionData(log, baseline)` | Returns `{ met, durationMinutes, estimatedKcal }` or `null` if baseline incomplete or `durationSeconds` missing/≤ 0. |
| **MET value** | `inferMETFromWorkout(source, workoutFormat)` | Lookup from **source/format strings** (e.g. Tabata ~8, AMRAP ~7.5, mobility ~3). **Independent of `effort`.** |
| **Baseline gating** | `hasBaselineForMET` / `ProfileBaseline` | Needs **DOB, biological sex, weight, height** (same as BMR path). |
| **Explicit future hook** | Comment in `estimateCalorieBurn` / MET module | States that **`effort` (1–10) could scale MET or kcal** — **not implemented yet.** |
| **Goal-alignment “intensity”** | `apps/app/src/lib/fitness-goal-alignment.ts` | `impliedIntensityFromEffort(effort)` maps **(effort − 1) / 9 → 0–1**. Used for **goal scoring**, not for MET. |
| **Heart rate / reserve** | `apps/app/src/lib/calculations.ts` | `getHeartRateAtIntensity`, `buildPhysiologicalCalibration`, Tanaka max HR, Karvonen if **resting + max** valid. Profile fields: `restingHrBpm`, `maxHrBpm` (see `AppContext` / profile). |

**Takeaway:** You already have **(A)** subjective **effort → 0–1** (`impliedIntensityFromEffort`), **(B)** **MET** from workout type, **(C)** **HR reserve** math if the user filled HR fields. A **single “0–100% intensity”** for charts is a **product + formula decision** that still needs to be defined and coded; the repo does **not** yet expose one canonical `%HRR` per session for the training log.

---

## 3. Weekly data shape (for binding charts)

- **Week model:** `TrainingLogWeek` in `apps/app/src/lib/supabase/client/training-log.ts` — `days[0..6]` Mon–Sun, each `TrainingLogDay` has `logs: WorkoutLog[]`, `minutes`, `plannedMinutes`, etc.
- **Rendering:** `WeekRow.tsx` builds the “Week Load” progress bar + `ActivityDot` grid. A new card should sit **inside the same week card below that strip** (or immediately under `WeekRow` in `TrainingLog.tsx`), receiving **`week`** + **`user`** (or `ProfileBaseline` + HR fields).

---

## 4. Proposed definition: session intensity 0–100%

To match the product language (“resting HR → max effort”), a defensible v1 is:

1. **Effort fraction:** \( f_e = \texttt{impliedIntensityFromEffort}(\texttt{effort}) \) — already **0–1** from 1–10.
2. **MET fraction:** Normalize MET to a 0–1 band (e.g. \( f_m = \mathrm{clamp}_{0}^{1}((\mathrm{MET} - 1) / (\mathrm{MET}_{max} - 1)) \) with `MET_max ≈ 12` for display only), so modality affects the bar even when effort is default 5.
3. **Blend:** \( f = w_e f_e + w_m f_m \) with weights summing to 1 (e.g. **0.6 / 0.4**), then **percent = round(100 × f)**.
4. **Optional HR refinement (when `buildPhysiologicalCalibration` tier is `full`):** map the same \( f \) to **%HRR** using `getHeartRateAtIntensity`, then display **normalized** back to 0–100% for the bar so the axis label stays honest: *“estimated relative intensity (profile-adjusted).”*

Document the formula in code comments and a short in-UI disclaimer (not medical advice).

**Edge cases:**

- **No duration** → `getWorkoutMetSessionData` is null → use **effort-only** or hide MET term.
- **No MET baseline** → MET term 0 or omit; rely on effort + format priors from `FORMAT_EXPECTED_INTENSITY` (already in goal-alignment) as a weaker signal.
- **Program / AMRAP default effort 5** → bars cluster at mid — **data collection improvements** (below) matter more than chart polish.

---

## 5. Bar chart: “up to 12 workouts”

- **Input:** All `WorkoutLog` in `week.days` (flattened), **after** the same `passesFilters` logic as the grid if charts should respect filters (recommend **yes**).
- **Sort:** Chronological by `date` + stable tie-breaker (`id` or `source`).
- **Label:** Short label per bar — e.g. weekday initial + `workoutName` truncated, or session index “W1…W12”.
- **Empty state:** Copy when 0 sessions in week.
- **Tech:** Recharts `BarChart` (already used in `VolumeChart.tsx`) for consistency.

---

## 6. Wave chart: intensity over Mon–Sun

- **One scalar per day:** e.g. **mean** of session intensities for that day; if **multiple sessions**, alternatives are **max** (stress lens) or **duration-weighted mean** (volume lens). **Recommend duration-weighted mean** for v1:  
  \( \sum_i f_i \cdot \mathrm{minutes}_i / \sum_i \mathrm{minutes}_i \) (skip days with 0 minutes).
- **Visualization:** Horizontal axis = Mon–Sun; line + area under curve (smooth monotone) — Recharts `AreaChart` with `type="monotone"`.
- **Planned-only days:** `plannedMinutes > 0` but no logs — optional ghost marker (out of scope for v1 unless product wants it).

---

## 7. Data & product work to improve accuracy (recommended backlog)

| Priority | Item | Why |
|----------|------|-----|
| P0 | **Persist effort (and optionally rating) on `user_workout_logs`** | Program completions are a large share of volume; today they **always show effort 5**. |
| P0 | **Prompt effort after program session save** (WorkoutPlayer / save path) | Aligns with timer handoff UX. |
| P1 | **AMRAP completion flow:** optional effort capture | Stops default 5 for all AMRAP merges. |
| P1 | **Scale MET (or a derived intensity) by `effort`** in `getWorkoutMetSessionData` or sibling function | Codebase already anticipates this; makes bars reflect subjective load. |
| P2 | **Encourage profile HR fields** in Training Log empty states | Unlocks HR-reserve interpretation and tighter % scale. |
| P2 | **Optional:** store **computed** `intensity_percent` at save time | Faster charts, historical consistency if formula changes (version field). |

---

## 8. Implementation checklist (engineering)

1. **`lib/training-log-session-intensity.ts` (new)**  
   - `estimateSessionIntensityPercent(log, ctx): number | null`  
   - `ctx` = `ProfileBaseline | null` + optional `PhysiologicalCalibration` + constants for weights.  
   - Unit tests: handoff log, program stub, full baseline, missing duration.

2. **`lib/training-log-week-intensity.ts` (new)**  
   - `buildWeekIntensitySeries(week, filters, ctx)` → `{ sessions: { log, percent, label }[]; daily: number[7] }`.

3. **`WeekIntensityCharts.tsx` (new)** under `training-log/`  
   - Props: `week`, `filters`, `profileBaseline`, user HR fields (or pass `user` from context).  
   - Responsive heights; accessible labels.

4. **`WeekRow.tsx` or `TrainingLog.tsx`**  
   - Render the new card **below** the existing Week Load / dots block for the focused week (or each card in the carousel — product choice: **per-week card** is consistent with “this week’s load”).

5. **Copy / disclaimer**  
   - Tooltip or footnote: estimate from logged effort, workout type, and optional profile physiology — not a medical device.

6. **Analytics (optional)**  
   - Event when user expands or views intensity card (if collapsed by default).

---

## 9. Open questions for product

- Should charts **respect the same filters** as the week grid (Type / Format / Duration / Active rest)? **(Recommended: yes.)**
- For days with **many short sessions**, is **duration-weighted** intensity the right default?
- Should **readiness-only** or **zero-duration** logs appear on the bar chart at all?
- Label for Y-axis: **“Estimated intensity”** vs literal **“% max HR”** — literal %HRmax requires HR profile and honest caveats.

---

## 10. File reference quick index

| Topic | File(s) |
|-------|---------|
| `WorkoutLog` type | `apps/app/src/types.ts` |
| Fetch merge + defaults | `apps/app/src/lib/supabase/client/workout-logs.ts` |
| Week aggregation | `apps/app/src/lib/supabase/client/training-log.ts` |
| Week UI | `apps/app/src/components/react/training-log/WeekRow.tsx`, `TrainingLog.tsx` |
| MET / kcal | `apps/app/src/lib/met/index.ts` |
| Effort → 0–1 | `apps/app/src/lib/fitness-goal-alignment.ts` (`impliedIntensityFromEffort`) |
| HR / Karvonen | `apps/app/src/lib/calculations.ts` |
| Energy aggregates pattern | `apps/app/src/lib/training-log-energy-analytics.ts` |
| Recharts example | `apps/app/src/components/react/hud/VolumeChart.tsx` |

---

*Last updated: planning pass aligned with repo state (interval-timers monorepo).*
