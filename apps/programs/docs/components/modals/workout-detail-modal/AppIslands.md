# AppIslands — WorkoutDetailModal integration

**File:** `src/components/react/AppIslands.tsx`  
**Relevant state:** `selectedArtist` (`Artist | null`). When non-null, `WorkoutDetailModal` is shown.

---

## How the modal is opened

- WorkoutDetailModal is used when the user selects a workout from any page that mounts **AppWrapper** (and thus AppIslands): home (`/`), `/workouts`, `/wod`, `/tabata`, `/complexes`. Those pages (or sections on home) dispatch a **`selectWorkout`** custom event with the Artist; AppIslands listens and sets `setSelectedArtist(workout)`.
- When `selectedArtist` is non-null, `workout={selectedArtist}` is passed to WorkoutDetailModal and it renders. Clicking an exercise in the modal triggers `onSelectExercise` (handleSelectExercise), which opens ExerciseDetailModal.
- **Program detail** (`/programs/[id]`) does not mount AppWrapper; there, WorkoutDetailModal is owned by ActiveProgramView or ProgramSalesView, not AppIslands.

---

## Props passed from AppIslands

| Prop               | Value                           | Notes                                                                             |
| ------------------ | ------------------------------- | --------------------------------------------------------------------------------- |
| `workout`          | `selectedArtist`                | The currently selected workout (Artist).                                          |
| `onClose`          | `() => setSelectedArtist(null)` | Clears selection and closes the modal.                                            |
| `onLogWorkout`     | `() => setShowLogModal(true)`   | Opens `LogWorkoutModal` (same session, `selectedArtist` is passed there).         |
| `onSelectExercise` | `handleSelectExercise`          | Opens exercise detail (e.g. `ExerciseDetailModal`) for the clicked exercise name. |
| `onOpenPlayer`     | **not passed**                  | No “Start workout” button in the main app flow.                                   |

---

## Related behavior in AppIslands

- **Escape key:** Global listener in AppIslands calls `setSelectedArtist(null)` on Escape, which closes the modal.
- **Approved exercises:** When `selectedArtist?.workoutDetail` is set, AppIslands fetches approved exercises and builds maps used by `handleSelectExercise` so the exercise detail modal can show published exercise data when an exercise card is clicked from this workout.
- **LogWorkoutModal:** Shares `selectedArtist`; user logs the same workout that is currently shown in `WorkoutDetailModal`.
