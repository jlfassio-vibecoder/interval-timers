# Where the generic warm-up section comes from

This doc maps why the frontend shows a warm-up section even when the Workout Factory has no warmup items for that workout.

## Summary

The **generic warm-up** (section titled "Warmup" with no exercises) is **not** coming from stored data. It is added in code when mapping a workout to the shape used by the detail modal: if the workout has **no** `warmupBlocks`, the mapper still creates a `warmup` phase with `title: 'Warmup'` and `exercises: []`. The modal then shows every phase that has a non-empty title, so the empty "Warmup" phase is displayed.

---

## 1. Workout Factory (admin) — source of truth

- **Where:** [ProgramBlueprintEditor.tsx](src/components/react/admin/ProgramBlueprintEditor.tsx) (programs) and the workout set editor used for Workout Factory sets.
- **Data:** Each workout is a `WorkoutInSet` ([types/ai-workout.ts](src/types/ai-workout.ts)) with optional `warmupBlocks?: WarmupBlock[]`.
- **Behavior:** If you don’t add any “Warmup (exercise name and instructions)” items, `warmupBlocks` is empty or undefined. So in the factory, there is no warm-up section.

---

## 2. Published workout sets → one session = `WorkoutInSet`

- **Where:** Workout sets are loaded from Firestore via [workout-service](src/lib/firebase/public/workout-service.ts). Each session in a set is a `WorkoutInSet`.
- **Shape:** `WorkoutInSet` has `warmupBlocks?: WarmupBlock[]`; it can be missing or `[]` when the factory had no warmup items.

So at this point there is still **no** warm-up in the data when you didn’t add any in the factory.

---

## 3. Mapper: workout → Artist (where the generic warm-up is added)

- **Where:** [map-workout-in-set-to-artist.ts](src/lib/map-workout-in-set-to-artist.ts) — used when opening a workout from the **Workouts** index (set → session → “View”).
- **Relevant code:**

```ts
const warmupBlocks = workout.warmupBlocks ?? [];
const warmup: WorkoutComponent =
  warmupBlocks.length > 0
    ? {
        title: 'Warmup',
        duration: '—',
        exercises: warmupBlocks.map((b) => b.exerciseName),
      }
    : { ...EMPTY_PHASE, title: 'Warmup' };  // ← generic warm-up injected here

const workoutDetail: WorkoutDetail = {
  warmup,   // always present
  main: { ... },
  finisher: { ...EMPTY_PHASE, title: 'Finisher' },
  cooldown: { ...EMPTY_PHASE, title: 'Cooldown' },
};
```

- **Behavior:**
  - If `warmupBlocks.length > 0`: warmup phase is built from real data (title "Warmup", exercise names).
  - If `warmupBlocks` is empty or missing: warmup is set to `{ ...EMPTY_PHASE, title: 'Warmup' }` (i.e. title `"Warmup"`, duration `"—"`, `exercises: []`).

So the **generic warm-up** is created **here**: same structure as other phases, but with no exercises and a fixed title.

(Program workouts use [map-program-workout-to-artist.ts](src/lib/map-program-workout-to-artist.ts), which does the same: empty warmup → `{ ...EMPTY_PHASE, title: 'Warmup' }`.)

---

## 4. WorkoutDetailModal — when a phase is shown

- **Where:** [WorkoutDetailModal.tsx](src/components/react/WorkoutDetailModal.tsx).
- **Phases:** It iterates `WORKOUT_DETAIL_PHASE_KEYS = ['warmup', 'main', 'finisher', 'cooldown']` and decides which phases to render:

```ts
for (const key of WORKOUT_DETAIL_PHASE_KEYS) {
  const blockValue = detail?.[key];
  if (!isWorkoutComponent(blockValue)) continue;
  if (blockValue.exercises.length === 0 && blockValue.title.trim() === '') continue;
  phaseEntries.push({ key, block: blockValue });
}
```

- **Behavior:** A phase is **hidden** only when **both**:
  - `exercises.length === 0`, and
  - `title.trim() === ''`.

For the generic warm-up we have `exercises: []` and `title: 'Warmup'`, so the condition is false and the phase is **not** skipped. So the modal always shows a “Warmup” block for that workout, even when it’s empty.

---

## End-to-end flow

```
Workout Factory (no warmup items)
    → WorkoutInSet.warmupBlocks = [] or undefined
    → Firestore / published set
    → User clicks "View" on session
    → mapWorkoutInSetToArtist(workout, options)
        → warmupBlocks.length === 0
        → warmup = { title: 'Warmup', duration: '—', exercises: [] }  ← generic warm-up
    → Artist.workoutDetail.warmup = that object
    → WorkoutDetailModal(workout)
        → phaseEntries includes warmup (title non-empty)
        → Renders "Warmup" section with 0 exercises
```

So the **generic warm-up section** is:

1. **Introduced in:** [map-workout-in-set-to-artist.ts](src/lib/map-workout-in-set-to-artist.ts) (and [map-program-workout-to-artist.ts](src/lib/map-program-workout-to-artist.ts) for program workouts).
2. **Shown by:** [WorkoutDetailModal.tsx](src/components/react/WorkoutDetailModal.tsx), because it only hides a phase when both `exercises.length === 0` and `title.trim() === ''`.

---

## Optional fix directions

If you want to **stop** showing a warm-up when the factory has no warmup items:

- **Option A (mapper):** When `warmupBlocks.length === 0`, set `warmup.title = ''` (and keep `exercises: []`) so the modal’s existing skip logic hides the phase. You’d keep `WorkoutDetail.warmup` required but allow an “empty” phase that the UI skips.
- **Option B (modal):** Change the skip condition to: hide phase when `blockValue.exercises.length === 0` (ignore title). Then any phase with no exercises would be hidden, including the generic warm-up.

Either way, the source of the generic warm-up is the mapper, not the Workout Factory data.
