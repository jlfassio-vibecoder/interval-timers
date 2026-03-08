# Workflow Paths Audit: Exercise Details, Exercises, Workouts, WODs, Tabata, Programs

**Date:** 2025-02-03  
**Scope:** Full audit of workflow paths that lead to exercise details, exercises, workouts, WODs, Tabata Workouts, and programs — entry points, data sources, modal vs full-page behavior, and documentation accuracy.

---

## 1. Entry Points and AppWrapper

### Pages that mount AppWrapper (and thus AppIslands)

| Route        | Page                  | Mounts AppWrapper? | Verified |
| ------------ | --------------------- | ------------------ | -------- |
| `/`          | index.astro           | Yes                | Yes      |
| `/workouts`  | workouts/index.astro  | Yes                | Yes      |
| `/wod`       | wod/index.astro       | Yes                | Yes      |
| `/tabata`    | tabata/index.astro    | Yes                | Yes      |
| `/complexes` | complexes/index.astro | Yes                | Yes      |

On these pages, clicking a workout card dispatches `selectWorkout`; AppIslands listens and sets `selectedArtist`, then renders WorkoutDetailModal. Clicking an exercise in the modal triggers `handleSelectExercise` and opens ExerciseDetailModal.

### Pages that do NOT mount AppWrapper

| Route            | Page                  | Mounts AppWrapper? | Exercise detail path                                                                              |
| ---------------- | --------------------- | ------------------ | ------------------------------------------------------------------------------------------------- |
| `/exercises`     | exercises/index.astro | No                 | Full page only: link to `/exercises/[slug]` or `/exercises/[slug]/learn`                          |
| `/learn`         | learn/index.astro     | No                 | Same: ExercisePrescriptionEngine → link to `/exercises/[slug]/learn`                              |
| `/programs`      | programs/index.astro  | No                 | ProgramCatalog only; no WorkoutDetailModal on list page. Links to `/programs/[id]`.               |
| `/programs/[id]` | programs/[id].astro   | No                 | ActiveProgramView or ProgramSalesView owns WorkoutDetailModal + ExerciseDetailModal in-component. |

**Navigation:** Navigation.tsx links to Workouts, Programs, Exercises, Complexes, WOD, Tabata Workouts. Programs and Exercises link to pages without AppWrapper; Workouts, WOD, Tabata, Complexes link to pages with AppWrapper. Behavior is consistent: workout-type pages use global modal stack; exercises and program detail use their own flows.

---

## 2. Workflow Paths to Exercise Details

### Path 1 — From WOD

- **Entry:** User on `/wod` (or home WOD section) → clicks WOD card.
- **Event:** `selectWorkout` with Artist (published WOD from Firestore when available, else static WOD from `wod.ts`).
- **AppIslands:** Sets `selectedArtist`. When `selectedArtist?.workoutDetail` exists, fetches approved exercises and builds exerciseMap, extendedMap, slugMap.
- **Modal:** WorkoutDetailModal opens with `workout={selectedArtist}`.
- **Exercise click:** `handleSelectExercise(exerciseName)`: 1) WOD override (if `exerciseOverrides[exerciseName]`) 2) Approved list (normalized name) 3) getExerciseDetails.
- **Result:** ExerciseDetailModal with exercise, extendedBiomechanics, exerciseSlug when from approved.

**Data source of Artist:** Published WODs from `getPublishedWODs()` (wod/index.astro) when non-empty; else static `WOD` from data/wod.ts. Only published WODs can have `exerciseOverrides`.

### Path 2 — From Workouts

- **Entry:** User on `/workouts` (or home Workouts section) → clicks workout card.
- **Event:** `selectWorkout` with Artist from static `WORKOUTS` (data/workouts.ts).
- **AppIslands:** Same as Path 1; approved list is fetched because `selectedArtist?.workoutDetail` exists (static workouts have workoutDetail).
- **Modal:** WorkoutDetailModal → click exercise → handleSelectExercise (no overrides; approved then static).
- **Result:** ExerciseDetailModal. Canonical data when exercise name matches an approved GeneratedExercise (normalized); otherwise placeholder from getExerciseDetails.

### Path 3 — From Tabata

- **Entry:** User on `/tabata` (or home Tabata section) → clicks Tabata card.
- **Event:** `selectWorkout` with Artist from static `TABATA` (data/tabata.ts).
- **Flow:** Identical to Path 2. No Firestore-backed Tabata; static only.
- **Result:** Same modal stack; resolution: approved → static.

### Path 4 — From Complexes

- **Entry:** User on `/complexes` (or home Complexes section) → clicks complex card.
- **Event:** `selectWorkout` with Artist from static complexes data.
- **Flow:** Identical to Path 2 and 3.
- **Result:** Same modal stack; resolution: approved → static.

### Path 5 — From Program (active, unlocked)

- **Entry:** User on `/programs/[id]` with access → ActiveProgramView.
- **Workout click:** User clicks a week/workout in Deployment Timeline/Grid → `missionParamsWorkout` set with program schedule workout (has warmupBlocks, blocks).
- **Modal:** WorkoutDetailModal with `workout={mapProgramWorkoutToArtist(missionParamsWorkout.workout, options)}`. No AppIslands on this page.
- **Exercise click:** `onSelectExercise(name)`: 1) Approved list (loaded once on mount via getGeneratedExercises('approved')) 2) Warmup block (missionParamsWorkout.workout.warmupBlocks) 3) getExerciseDetails.
- **Result:** ExerciseDetailModal with same four props. Canonical data and slug when name matches approved; else warmup instructions or placeholder.

### Path 6 — From Program (sales / locked)

- **Entry:** User on `/programs/[id]` without access → ProgramSalesView with program preview.
- **Flow:** Same as Path 5: Mission Parameters (WorkoutDetailModal with mapped Artist), same onSelectExercise resolution (approved → warmup → static). Preview/schedule data is enough to build Artist via mapProgramWorkoutToArtist.
- **Result:** Same ExerciseDetailModal behavior. Unlock CTA shown elsewhere in view.

### Path 7 — From Exercises

- **Entry:** User on `/exercises` or `/learn` → ExercisePrescriptionEngine (filterable list).
- **Exercise click:** Card links to `/exercises/[slug]` or `/exercises/[slug]/learn` (full page navigation). No modal; no AppWrapper dependency.
- **Result:** Full page exercise detail or deep-dive learn page. No ExerciseDetailModal in this flow.

---

## 3. Data Consistency and Edge Cases

### Naming (static vs approved)

- Static workouts (workouts.ts, wod.ts, tabata.ts, complexes.ts) use exercise **names** (e.g. "Air Squats", "Child's Pose to Upward Dog"). The approved list is keyed by **normalized** name (`normalizeExerciseName`: lowercase, trim) in `approved-exercise-maps.ts`.
- **Finding:** Modal gets canonical data only when the static (or program) exercise name, after normalization, matches an approved GeneratedExercise's exerciseName (also normalized). Mismatches (e.g. typo, different wording) fall back to getExerciseDetails placeholder. No automated alignment check; document that static names should align with approved exercise names where canonical content is desired.

### Approved fetch in AppIslands

- Approved exercises are fetched when `selectedArtist?.workoutDetail` is set (useEffect dependency: selectedArtist?.id, selectedArtist?.workoutDetail). So they are loaded for **any** selected Artist (WOD, Workouts, Tabata, Complexes), not only “WOD” in the narrow sense.
- **Finding:** No bug when selectedArtist is from static Workouts/Tabata/Complexes (no Firestore WOD id). The fetch and map build are generic; only the resolution order in handleSelectExercise differs (AppIslands has overrides first; program views have warmup second).

### Program workout warmupBlocks

- ActiveProgramView and ProgramSalesView pass `missionParamsWorkout.workout` (program schedule workout with warmupBlocks) into onSelectExercise. The **displayed** workout in WorkoutDetailModal is the **mapped** Artist from mapProgramWorkoutToArtist (workoutDetail from blocks + warmupBlocks). Resolution uses the same `missionParamsWorkout.workout.warmupBlocks` for block-specific instructions when the exercise name matches a warmup block. **Verified:** Modal receives mapped Artist for display; resolution logic uses the program workout’s warmupBlocks for step 2.

---

## 4. Tabata vs WOD vs Workouts (Documentation)

- **Tabata:** Static only (`data/tabata.ts`). Same Artist + WorkoutDetailModal + ExerciseDetailModal flow as WOD/Workouts. No Firestore “published Tabata” path. Documented in DataSources.md (new subsection).
- **Workouts:** Static zone workouts (`data/workouts.ts`). No exerciseOverrides. Documented.
- **WOD:** Can be static (fallback) or published (Firestore). Only published WODs may have exerciseOverrides. Documented in DataSources.md.

---

## 5. Programs End-to-End

- **Program list:** `/programs` → ProgramPrescriptionEngine (ProgramCatalog) → links to `/programs/[id]`. No WorkoutDetailModal on list page. **Verified.**
- **Program detail:** Unlocked → ActiveProgramView (schedule, Mission Parameters, WorkoutPlayer). Locked → ProgramSalesView (preview, Mission Parameters, unlock CTA). Both use same WorkoutDetailModal + ExerciseDetailModal and same resolution (approved → warmup → static). **Verified.**
- **Deployment Timeline / Grid:** ActiveProgramView builds workout list from program.schedule; each card has id like `week-${weekNumber}-${workoutIndex}`. Clicking a card sets missionParamsWorkout (week, workout, workoutIndex); WorkoutDetailModal receives mapProgramWorkoutToArtist(missionParamsWorkout.workout, options). **Verified.**

---

## 6. Documentation Updates Completed

- **exercises.md (Section 3):** Updated “Exercise Resolution — Who Supplies the Data?” table so ActiveProgramView and ProgramSalesView show resolution order “1. Approved list 2. Warmup block 3. getExerciseDetails” and “Gets canonical data? Yes (when name matches approved)” and “Gets slug? Yes”. Added subsection describing resolution logic for ActiveProgramView / ProgramSalesView.
- **DataSources.md:** Added subsection “Tabata Workouts vs WOD vs Workouts” clarifying static Tabata, static Workouts, and WOD (static or published with optional overrides).
- **ExerciseDetailModal.md:** Already stated same component and props for WODs and Workouts; no WOD-only language remaining.
- **AppIslands.md:** Updated “How the modal is opened” to state which pages mount AppWrapper and dispatch selectWorkout; noted that program detail does not use AppIslands.
- **WorkoutDetailModal.md:** Already listed data sources (workouts, wod, tabata, complexes, generated, program) and integration points (AppIslands, ActiveProgramView, ProgramSalesView). No change required.

---

## 7. Optional UX Notes (Audit Only)

- **“View full page” in modal:** Shown only when `exerciseSlug` is set (approved match). On override path (AppIslands), slug is null so link is hidden. On static fallback, slug is null. Consistent across all three parents.
- **Additional Tactical Data:** Button always visible; content or empty state. No regressions observed on any path.
- **URLs and deep-linking:** Program detail is `/programs/[id]`. There is no URL for “workout X inside program” or “exercise Y inside workout”. Recommendation: document as current design; deep-link for specific workout/exercise in program could be a future enhancement.

---

## 8. Summary

| Workflow         | Entry              | Workout/list source      | Exercise detail                       | Data source for exercise     |
| ---------------- | ------------------ | ------------------------ | ------------------------------------- | ---------------------------- |
| WOD              | /, /wod            | Published or static WOD  | Modal (AppIslands)                    | Override → approved → static |
| Workouts         | /, /workouts       | Static WORKOUTS          | Modal (AppIslands)                    | Approved → static            |
| Tabata           | /, /tabata         | Static TABATA            | Modal (AppIslands)                    | Approved → static            |
| Complexes        | /, /complexes      | Static complexes         | Modal (AppIslands)                    | Approved → static            |
| Program (active) | /programs/[id]     | Program schedule         | Modal (ActiveProgramView)             | Approved → warmup → static   |
| Program (sales)  | /programs/[id]     | Program preview          | Modal (ProgramSalesView)              | Approved → warmup → static   |
| Exercises        | /exercises, /learn | Published exercises list | Full page (/exercises/[slug], /learn) | Canonical page fetch         |

All modal paths use the same ExerciseDetailModal component and the same four props. AppWrapper (and thus AppIslands) is used only on home, /workouts, /wod, /tabata, /complexes. Exercises and program detail pages use their own flows without AppWrapper.
