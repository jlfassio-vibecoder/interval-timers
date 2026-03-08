import { AMRAP_WORKOUT_LIBRARY } from '@/components/interval-timers/amrap-setup-data';

/**
 * Find the workout title from the library by matching the exercises array.
 * Session workout_list stores exercises, not the workout name.
 */
function getWorkoutTitleFromLibrary(workoutList: string[] | undefined): string | null {
  if (!workoutList?.length) return null;
  const normalized = workoutList.map((e) => e?.trim()).filter(Boolean);
  if (normalized.length === 0) return null;

  for (const levelWorkouts of Object.values(AMRAP_WORKOUT_LIBRARY)) {
    for (const option of levelWorkouts) {
      if (
        option.exercises.length === normalized.length &&
        option.exercises.every((ex, i) => ex === normalized[i])
      ) {
        return option.name;
      }
    }
  }
  return null;
}

/**
 * Single source of truth for workout display label: title (from library match or first exercise or "AMRAP") + duration.
 */
export function getWorkoutTitleAndDuration(
  workoutList: string[] | undefined,
  durationMinutes: number
): string {
  const title =
    getWorkoutTitleFromLibrary(workoutList) ?? workoutList?.[0]?.trim() ?? 'AMRAP';
  return `${title} · ${durationMinutes} min`;
}

/** Workout title only (for use where duration is shown separately). */
export function getWorkoutTitle(workoutList: string[] | undefined): string {
  return (
    getWorkoutTitleFromLibrary(workoutList) ?? workoutList?.[0]?.trim() ?? 'AMRAP'
  );
}
