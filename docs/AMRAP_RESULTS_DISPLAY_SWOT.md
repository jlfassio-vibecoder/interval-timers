# SWOT Analysis: AMRAP Results Display

**Scope:** The post-workout results display: ViewResultsModal, Copy results text, finished-state summary in AmrapSessionShell, PostWorkoutRecapModal, and the data shown when sharing/saving results.

**Components:** `ViewResultsModal`, `PostWorkoutRecapModal`, `AmrapSessionShell`, `useSocialAmrap` (copyResults, handleOpenViewResults, finishedActionsSlot)

**Date:** March 13, 2025

---

## Current Behavior Summary

When the workout finishes, users see results in several places:

- **Shell summary:** "You completed X rounds in Y min" (or "Work complete" if 0 rounds)
- **Finished actions:** Done, View in History, View results, Copy results
- **ViewResultsModal:** Displays full results: summary line with optional workout title (e.g. "AMRAP The Metabolic Burner 15 min: 5 rounds"), a Volume block (per-exercise totals: "50 burpees", "75 air squats", etc.), and session URL. Unparseable exercises show "— [name]".
- **PostWorkoutRecapModal:** "You did X rounds in Y min" with Done / View in History / Copy results
- **Copy results:** Copies to clipboard the same format. When volume has more than 6 lines, clipboard uses a compact single-line volume (e.g. "Volume: 50 burpees, 75 air squats, 75 sit-ups, …") to keep paste length manageable.

**Implemented:** Per-exercise volume is computed from `workout_list` and rounds via `workoutResults.ts` (same regex as AmrapExerciseList). Time-based exercises (e.g. "5m run") show "25 min" total; ranges (e.g. "10-12") show "50-60". Workout title (library match or first exercise) is included in the summary when available; long titles are truncated to 30 chars.

---

## Strengths

| Area | Description |
|------|-------------|
| **Clear rounds summary** | Rounds are the primary AMRAP metric: "5 rounds in 15 min" is immediately understandable. Users know how many full circuits they completed. |
| **Consistent copy format** | Same builder produces both modal and copy text. Modal always shows full volume; clipboard uses compact single-line volume when > 6 exercises. |
| **Shareable URL** | The copied text includes the session URL so recipients can view the full leaderboard and session context. |
| **Preview before copy** | ViewResultsModal lets users see exactly what they will copy before sharing. Reduces accidental shares of wrong content. |
| **Multiple exit paths** | Done, View in History, Copy results, and View results give users flexibility in how they want to proceed after finishing. |
| **Copy feedback** | Toast confirms "Copied to clipboard!" or "Failed to copy", improving confidence in the action. |
| **Accessible modal** | ViewResultsModal uses Escape and backdrop click to close; has proper ARIA labels and role="dialog". |
| **Recap modal** | PostWorkoutRecapModal provides a clear "Workout complete!" moment with immediate actions. |

---

## Weaknesses

| Area | Description | Status |
|------|-------------|--------|
| **No volume breakdown** | Results show only rounds, not total reps per exercise. | **Addressed:** Volume block in results and copy. |
| **Rounds-only metric** | Users who care about volume must mentally compute reps × rounds. | **Addressed:** Per-exercise volume displayed. |
| **No workout context in copy** | The copied text did not include the workout name or exercise list. | **Addressed:** Workout title (library or first exercise) in summary; volume lists exercises. |
| **Duplicate result logic** | No single source of truth for the results format. | **Addressed:** `buildResultsText()` in `workoutResults.ts` used by both copy and View Results. |
| **Time-based exercises** | "5m run" could not be expressed as reps. | **Addressed:** Shows "25 min" total for 5m × 5 rounds. |
| **Range reps** | "10-12 reps" had ambiguous volume. | **Addressed:** Parsing shows "50-60" total. |

---

## Opportunities

| Area | Description | Status |
|------|-------------|--------|
| **Full volume display** | Parse `workout_list` and compute total reps per exercise. Display in ViewResultsModal and copy. | **Implemented.** |
| **Centralized results builder** | Extract `buildResultsText(workoutList, rounds, duration, url, options)` used by copy and View Results. | **Implemented.** |
| **Workout context in share** | Include workout name or first exercise in the share text. | **Implemented:** `getWorkoutTitle(workoutList)` in summary; long titles truncated to 30 chars. |
| **Volume in copy format** | Add volume to copy (multi-line or compact). | **Implemented:** Full in modal; compact single-line when > 6 exercises for clipboard. |
| **Time-based volume** | For `\d+m` format, show "25 min" for 5m × 5 rounds. | **Implemented.** |
| **Range handling** | For "10-12 reps", show "50-60 total". | **Implemented.** |

---

## Threats

| Area | Description | Mitigation |
|------|-------------|------------|
| **Format complexity** | Workout strings vary; parsing may fail for edge cases. | Unparseable exercises show "— [name]" in volume block; summary and rounds still shown. |
| **Copy text length** | Full volume for many exercises could make copy very long. | Clipboard uses compact single-line volume when > 6 exercises (first 6 + "…"). |
| **Inconsistent parsing** | Results builder must match AmrapExerciseList regex. | `workoutResults.ts` uses the same `EXERCISE_REGEX` pattern. |
| **Non-participants** | 0 rounds yields 0 volume for all exercises. | Correct behavior; summary shows "0 rounds". |

---

## Recommendations

1. **Add full volume to results.** — **Done.** `workoutResults.ts` computes volume; ViewResultsModal and copy both use it.
2. **Extract results builder.** — **Done.** `buildResultsText()` in `workoutResults.ts`; `getResultsText(opts?)` in useSocialAmrap passes `workoutTitle` and `compact` when `forCopy: true` and volume lines > 6.
3. **Graceful fallbacks.** — **Done.** Unparseable exercises appear as "— [name]" in the volume block.
4. **Keep copy format compact.** — **Done.** Full multi-line volume in modal; compact single-line volume for clipboard when > 6 exercises.
