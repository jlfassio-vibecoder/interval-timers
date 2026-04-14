import { workoutBlocksToAmrapExerciseNames } from '@/lib/trainer-live/amrap-workout-list-adapter';
import type { TrainerLiveSessionWorkoutPlan } from './types';
import { createSessionWorkoutPlanBlockId } from './types';

/**
 * Best-effort: map a Mission Control `public.workouts` row (API shape) to a single AMRAP plan block.
 * Trainers can edit block type and split into Tabata/EMOM after import.
 */
export function savedWorkoutRowToSessionPlan(row: {
  id?: string;
  title?: string;
  blocks?: unknown;
  durationMinutes?: number | null;
}): TrainerLiveSessionWorkoutPlan {
  const exercises = workoutBlocksToAmrapExerciseNames(row.blocks);
  const dmRaw = row.durationMinutes;
  const durationMinutes =
    typeof dmRaw === 'number' && Number.isFinite(dmRaw) && dmRaw >= 1 && dmRaw <= 180
      ? Math.round(dmRaw)
      : exercises.length > 0
        ? 15
        : 15;

  if (exercises.length === 0) {
    return { blocks: [] };
  }

  return {
    blocks: [
      {
        id: createSessionWorkoutPlanBlockId(),
        kind: 'amrap',
        durationMinutes,
        exercises,
        label:
          typeof row.title === 'string' && row.title.trim() ? row.title.trim() : 'Imported workout',
      },
    ],
  };
}
