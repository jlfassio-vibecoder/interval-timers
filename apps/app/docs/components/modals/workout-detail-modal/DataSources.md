# Data sources for Artist (WorkoutDetailModal)

The `workout` prop passed to `WorkoutDetailModal` is an **Artist** (see `src/types.ts`). Artist data comes from three kinds of sources: static data files, generated WODs (API + Firebase), and program workouts mapped via a helper.

---

## Static data (in-repo)

Predefined `Artist[]` or equivalent used for demos, fallbacks, or the main app grid.

| File                    | Export                                                              | Notes                                                                                           |
| ----------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/data/workouts.ts`  | `WEEK_1_WORKOUTS: Artist[]`, `defaultWorkoutDetails: WorkoutDetail` | Week 1 workouts; other modules spread `defaultWorkoutDetails` for phases.                       |
| `src/data/wod.ts`       | `WOD: Artist[]`                                                     | One Artist per level (beginner / intermediate / advanced); shared `defaultWorkoutDetails`.      |
| `src/data/tabata.ts`    | Tabata-style Artist arrays                                          | Same pattern: id, name, image, description, `workoutDetail` with warmup/main/finisher/cooldown. |
| `src/data/complexes.ts` | Complex-style Artist arrays                                         | Same pattern for complex workouts.                                                              |

All use the full `Artist` shape: `id`, `name`, `genre`, `image`, `day`, `description`, `intensity`, `workoutDetail`. No `exerciseOverrides` in these files. Consumed by AppIslands (e.g. protocol dashboard / grid) and passed through as `selectedArtist` to the modal.

---

## Generated WODs (API + Firebase)

Single-workout generation and persisted WODs that match the Artist + `workoutDetail` contract.

| Source                                                | Role                                               | Artist-like shape                                                                                                                                                                                                                                                       |
| ----------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **WOD API** `src/pages/api/ai/generate-wod.ts`        | Returns a single generated workout (GeneratedWOD). | Response includes `workoutDetail` (from WOD prescriber), plus `name`, `description`, `level`, `genre`, `image`, `day`, etc. Stored in Firebase as a document.                                                                                                           |
| **Firebase** `src/lib/firebase/public/wod-service.ts` | Fetches saved WODs (e.g. approved list).           | `mapDocToWOD()` maps Firestore docs to a serialized shape with `id`, `name`, `genre`, `image`, `day`, `description`, `intensity`, `workoutDetail`, and optional `exerciseOverrides`. Client code (e.g. WOD Engine or app list) can pass this as `workout` to the modal. |

Generated and saved WODs may include `exerciseOverrides` (per-exercise image/instructions). The modal does not read overrides; the parent (e.g. AppIslands) uses them in `onSelectExercise` / exercise detail resolution.

---

## Program workouts (mapper)

Program schedule workouts (AI program or preview data) are not Artists; they are mapped to Artist for the modal.

| Source                                         | Role                                                  | How Artist is built                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`src/lib/map-program-workout-to-artist.ts`** | `mapProgramWorkoutToArtist(workout, options): Artist` | Takes a program schedule workout (`ProgramWorkout`) and options (`day`, `intensity`, `id?`, `image?`). Builds `workoutDetail` from `workout.blocks` (main phase) and `workout.warmupBlocks` (warmup); finisher/cooldown are placeholder phases. Returns a full Artist used by **ActiveProgramView** and **ProgramSalesView** when showing the modal. |

Used whenever the modal is shown in a program context (active program or sales preview). The caller supplies `day` (e.g. `Session ${index + 1}`), `intensity`, `id`, and `image`; the mapper fills name, description, and phased exercises from the program workout.

---

## Summary

| Source type | Files / entry points                                 | Consumed by                                                       |
| ----------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| Static      | `workouts.ts`, `wod.ts`, `tabata.ts`, `complexes.ts` | AppIslands (grid / protocol dashboard).                           |
| Generated   | `generate-wod.ts` (API), `wod-service.ts` (Firebase) | AppIslands or admin WOD flows when showing a saved/generated WOD. |
| Program     | `map-program-workout-to-artist.ts`                   | ActiveProgramView, ProgramSalesView.                              |

All paths end in an object that satisfies the Artist shape (or a serialized variant with the same fields) so `WorkoutDetailModal` can render hero, mission parameters, and phases without knowing the origin.

---

## Tabata Workouts vs WOD vs Workouts

- **Tabata Workouts** (`src/data/tabata.ts`): Static-only. The Tabata index page and home section use the same flow as WOD/Workouts: click card → `selectWorkout` → AppIslands → WorkoutDetailModal → click exercise → ExerciseDetailModal. There is no Firestore-backed "published Tabata" path; all Tabata Artists come from the in-repo array.
- **Workouts** (`src/data/workouts.ts`): Static zone workouts. Same modal flow as Tabata; no `exerciseOverrides`. Exercise resolution uses the approved list (when a workout is selected) then static fallback.
- **WOD**: Can be static (fallback from `wod.ts`) or **published** (Firestore via `wod-service`). Only published WODs may have `exerciseOverrides` (admin-custom or swapped exercises). The `/wod` page uses published WODs when available, else static WOD.
