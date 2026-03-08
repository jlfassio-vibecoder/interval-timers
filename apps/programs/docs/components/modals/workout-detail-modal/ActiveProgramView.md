# ActiveProgramView — WorkoutDetailModal integration

**File:** `src/components/react/public/ActiveProgramView.tsx`  
**Relevant state:** `missionParamsWorkout` (`MissionParamsWorkout | null`). When non-null, `WorkoutDetailModal` is shown.

---

## How the modal is opened

- User selects a workout from the program (e.g. Deployment Timeline / Deployment Grid).
- The view sets `setMissionParamsWorkout({ week, workout, workoutIndex })`.
- The modal renders with `workout={mapProgramWorkoutToArtist(missionParamsWorkout.workout, options)}`.

---

## Props passed from ActiveProgramView

| Prop               | Value                                                                                    | Notes                                                                                                                                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workout`          | `mapProgramWorkoutToArtist(missionParamsWorkout.workout, { day, intensity, id, image })` | Builds an `Artist` from the program schedule workout. `day` is `Session ${workoutIndex + 1}`; `id` is `week-${weekNumber}-${workoutIndex}`; `image` is `DEFAULT_WORKOUT_IMAGE`.                                      |
| `onClose`          | `() => setMissionParamsWorkout(null)`                                                    | Clears mission-params selection and closes the modal.                                                                                                                                                                |
| `onLogWorkout`     | Sets `activeWorkout` and closes modal                                                    | Calls `setActiveWorkout({ week, workout, workoutIndex })` and `setMissionParamsWorkout(null)`. Opening the log flow is handled by the active workout state (e.g. WorkoutPlayer).                                     |
| `onOpenPlayer`     | Sets `activeWorkout` and closes modal                                                    | Same as `onLogWorkout`: `setActiveWorkout({ week, workout, workoutIndex })` and `setMissionParamsWorkout(null)`. The “Start workout” button is shown and opens `WorkoutPlayer`.                                      |
| `onSelectExercise` | Resolve exercise, then open detail                                                       | Looks up the name in `missionParamsWorkout.workout.warmupBlocks` first; if found, uses that block’s instructions. Otherwise uses `getExerciseDetails(name)`. Sets `selectedExercise` so `ExerciseDetailModal` opens. |

---

## Related behavior in ActiveProgramView

- **WorkoutPlayer:** After “Log Session Data” or “Start workout”, `activeWorkout` is set and `WorkoutPlayer` renders on top (same program/session context). Closing the modal and opening the player happen together.
- **ExerciseDetailModal:** This view has its own `ExerciseDetailModal`; `onSelectExercise` sets `selectedExercise` so clicking an exercise card in the modal opens exercise detail (warmup instructions or static exercise data).
- **No LogWorkoutModal:** This flow does not open the shared `LogWorkoutModal`; logging is handled via `WorkoutPlayer` when the user completes or logs the workout there.
