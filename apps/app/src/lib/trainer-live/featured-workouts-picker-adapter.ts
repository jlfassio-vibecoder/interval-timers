import type { AmrapSavedWorkoutItem } from '@interval-timers/amrap-workout-picker';
import type { TrainerFeaturedLiveWorkoutRow } from '@/hooks/useFeaturedWorkouts';

/** PostgREST sometimes returns one-to-one embeds as a single object or a one-element array. */
function embedWorkoutFromRow(
  row: TrainerFeaturedLiveWorkoutRow
): TrainerFeaturedLiveWorkoutRow['workouts'] {
  const raw = row.workouts as unknown;
  if (raw == null) return null;
  if (Array.isArray(raw)) return (raw[0] as TrainerFeaturedLiveWorkoutRow['workouts']) ?? null;
  return row.workouts;
}

/** Map featured join row (+ embedded `workouts`) to picker list item shape. */
export function featuredRowToSavedWorkoutItem(
  row: TrainerFeaturedLiveWorkoutRow
): AmrapSavedWorkoutItem | null {
  const w = embedWorkoutFromRow(row);
  if (!w) return null;
  const title =
    typeof w.title === 'string' && w.title.trim() ? w.title.trim() : 'Workout';
  return {
    id: w.id,
    title,
    blocks: w.blocks,
    durationMinutes: w.duration_minutes ?? null,
    ...(w.source !== undefined ? { source: w.source } : {}),
  };
}

/**
 * Map featured rows to picker items; if embed is missing, reuse the matching row from the
 * trainer library list (same ids, already filtered by mode in the modal).
 */
export function mapFeaturedRowsToPickerItems(
  rows: TrainerFeaturedLiveWorkoutRow[],
  savedLibraryFallback?: AmrapSavedWorkoutItem[] | null
): AmrapSavedWorkoutItem[] {
  const savedById = new Map((savedLibraryFallback ?? []).map((w) => [w.id, w]));
  const out: AmrapSavedWorkoutItem[] = [];
  for (const row of rows) {
    let item = featuredRowToSavedWorkoutItem(row);
    if (!item) {
      const fromSaved = savedById.get(row.workout_id);
      if (fromSaved) item = fromSaved;
    }
    if (item) out.push(item);
  }
  return out;
}
