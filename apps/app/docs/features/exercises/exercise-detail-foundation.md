# Exercise Detail Foundation — Contract and Workflows

**Source of truth for in-context exercise detail:** `onSelectExercise(exerciseName)` and **ExerciseDetailModal**. Any flow that shows exercise detail inside a workout/wod/tabata (or program workout) uses this contract.

---

## 1. Contract

- **`onSelectExercise(exerciseName: string) => void`** — Called when the user picks an exercise (e.g. from WorkoutDetailModal). The **parent** is responsible for resolving the exercise data (override → approved → static, or approved → warmup → static in program context) and opening the detail view.
- **ExerciseDetailModal** — Receives `exercise`, `onClose`, `extendedBiomechanics`, `exerciseSlug`. It is the single UI for in-context exercise detail (images, Deployment Steps, Additional Tactical Data, View full page). The parent resolves and passes these props; the container (e.g. WorkoutDetailModal) does not own exercise data and does not render ExerciseDetailModal.

Containers that list exercises (e.g. WorkoutDetailModal) only call `onSelectExercise(name)`; they do not render ExerciseDetailModal.

---

## 2. Consumers (Workouts, WODs, Tabata)

All three use the same path via **AppIslands**:

- Page or section dispatches **`selectWorkout`** with an **Artist** (from WORKOUTS, WOD, or TABATA).
- AppIslands sets `selectedArtist` and renders **WorkoutDetailModal** with `onSelectExercise={handleSelectExercise}`.
- User clicks an exercise in the modal → **handleSelectExercise(name)** → AppIslands resolves (override → approved → static) and renders **ExerciseDetailModal** with the same four props.

---

## 3. Workflows

### 3.1 Workouts: Exercise → Workout

- **Container:** Workout (Artist from `data/workouts.ts` or home Workouts section).
- **Flow:** User opens a workout (selectWorkout) → WorkoutDetailModal shows phases and exercise names → user clicks exercise → `onSelectExercise(name)` → parent (AppIslands) resolves and opens ExerciseDetailModal.
- **Resolution:** No overrides (static workouts). Approved list then getExerciseDetails.
- **Entry points:** [WorkoutsIndexContent](src/components/react/public/WorkoutsIndexContent.tsx) (/workouts), [WorkoutCards](src/components/react/WorkoutCards.tsx) (home). Both dispatch selectWorkout; AppIslands provides the single exercise-detail path.

### 3.2 WODs: Exercise → WOD

- **Container:** WOD (Artist from Firestore published WODs or `data/wod.ts`).
- **Flow:** Same sequence: selectWorkout → WorkoutDetailModal → onSelectExercise(name) → ExerciseDetailModal.
- **WOD-specific:** AppIslands may apply `exerciseOverrides` for that Artist (published WODs only) before approved/static resolution.
- **Entry points:** [WODIndexContent](src/components/react/public/WODIndexContent.tsx) (/wod), [WODCards](src/components/react/WODCards.tsx) (home).

### 3.3 Tabata: Exercise → Tabata

- **Container:** Tabata (Artist from `data/tabata.ts`).
- **Flow:** Same sequence: selectWorkout → WorkoutDetailModal → onSelectExercise(name) → ExerciseDetailModal.
- **Resolution:** No overrides. Approved list then getExerciseDetails.
- **Entry points:** [TabataIndexContent](src/components/react/public/TabataIndexContent.tsx) (/tabata), [TabataCards](src/components/react/TabataCards.tsx) (home).

---

## 4. Out of scope / Future

### Complexes

**Complexes** will use their own full workflow later. They currently share the same selectWorkout/AppIslands path but are not part of the “exercise → workout/wod/tabata” workflow set. No change to Complexes in this foundation.

### Programs (next phase)

**Programs** follow **exercise → workout → program**. The “workout” in a program (Mission Parameters) already uses the same foundation: WorkoutDetailModal with `onSelectExercise` and ExerciseDetailModal (in ActiveProgramView and ProgramSalesView). The next phase will implement/refine the program workflow around this; program workouts will continue to use onSelectExercise + ExerciseDetailModal as the exercise-detail unit.

---

## 5. Related docs

- [exercises.md](exercises.md) — Canonical source, resolution table, data flow.
- [ExerciseDetailModal](../../components/modals/workout-detail-modal/exercise-detail-modal/ExerciseDetailModal.md) — Props and integration.
- [WorkoutDetailModal](../../components/modals/workout-detail-modal/WorkoutDetailModal.md) — Container that calls onSelectExercise.
- [AppIslands](../../components/modals/workout-detail-modal/AppIslands.md) — How WorkoutDetailModal and exercise detail are wired for workout/wod/tabata flows.
