# ProgramSalesView — WorkoutDetailModal integration

**File:** `src/components/react/public/ProgramSalesView.tsx`  
**Relevant state:** `missionParamsWorkout` (`MissionParamsWorkout | null`). When non-null, `WorkoutDetailModal` is shown.

**Context:** Public/sales view: Week 1 is free preview; Weeks 2+ are locked. The modal is used to show mission parameters for a preview workout and to drive sign-in / unlock.

---

## How the modal is opened

- User selects a workout from the Week 1 preview (Deployment Timeline / Deployment Grid).
- The view sets `setMissionParamsWorkout({ workout, workoutIndex })` (no `week` — only the preview week is shown).
- The modal renders with `workout={mapProgramWorkoutToArtist(missionParamsWorkout.workout, options)}`.

---

## Props passed from ProgramSalesView

| Prop               | Value                                                                                    | Notes                                                                                                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workout`          | `mapProgramWorkoutToArtist(missionParamsWorkout.workout, { day, intensity, id, image })` | Builds an `Artist` from the preview workout. `day` is `Session ${workoutIndex + 1}`; `id` is `w1-${workoutIndex}`; `image` is `DEFAULT_WORKOUT_IMAGE`.                                  |
| `onClose`          | `() => setMissionParamsWorkout(null)`                                                    | Clears selection and closes the modal.                                                                                                                                                  |
| `onLogWorkout`     | Close modal and run unlock flow                                                          | Calls `setMissionParamsWorkout(null)` and `handleUnlock()`. “Log Session Data” does not open a logger; it prompts sign-in / purchase to unlock the program.                             |
| `onOpenPlayer`     | **not passed**                                                                           | No “Start workout” button in the sales flow.                                                                                                                                            |
| `onSelectExercise` | Resolve exercise, then open detail                                                       | Same as ActiveProgramView: looks up name in `missionParamsWorkout.workout.warmupBlocks` first, else `getExerciseDetails(name)`. Sets `selectedExercise` so `ExerciseDetailModal` opens. |

---

## Related behavior in ProgramSalesView

- **Unlock flow:** `onLogWorkout` triggers `handleUnlock()` (e.g. POST to `/api/programs/unlock` or redirect to sign-in). The modal is for preview + conversion, not for actually logging a session.
- **ExerciseDetailModal:** This view has its own `ExerciseDetailModal`; `onSelectExercise` sets `selectedExercise` so clicking an exercise card opens exercise detail (warmup instructions or static data).
- **No WorkoutPlayer / LogWorkoutModal:** Sales view does not open WorkoutPlayer or the shared LogWorkoutModal; after unlock the page may reload or navigate so the user gets the full program experience elsewhere.
