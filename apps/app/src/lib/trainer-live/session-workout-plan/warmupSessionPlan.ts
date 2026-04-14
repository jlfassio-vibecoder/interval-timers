import { WARMUP_EXERCISES } from '@/components/react/interval-timers/interval-timer-warmup';
import { workoutBlocksToAmrapExerciseNames } from '@/lib/trainer-live/amrap-workout-list-adapter';
import type { TrainerLiveSessionWorkoutPlan } from './types';
import { createSessionWorkoutPlanBlockId } from './types';

/** Label for the system preset block (also used in Live UI). */
export const DAILY_WARMUP_LABEL = 'Daily Warm-up';

/**
 * System preset: same exercise order as interval timers’ Daily Warm-up (all trainers).
 */
export function buildDailyWarmupSessionPlan(): TrainerLiveSessionWorkoutPlan {
  const exercises = WARMUP_EXERCISES.map((e) => e.name);
  return {
    blocks: [
      {
        id: createSessionWorkoutPlanBlockId(),
        kind: 'warmup',
        exercises,
        label: DAILY_WARMUP_LABEL,
      },
    ],
  };
}

/**
 * Map a Mission Control `public.workouts` row to a single warm-up plan block (flattened exercise names).
 */
export function savedWorkoutRowToWarmupPlan(row: {
  title?: string;
  blocks?: unknown;
}): TrainerLiveSessionWorkoutPlan {
  const exercises = workoutBlocksToAmrapExerciseNames(row.blocks);
  if (exercises.length === 0) {
    return { blocks: [] };
  }
  return {
    blocks: [
      {
        id: createSessionWorkoutPlanBlockId(),
        kind: 'warmup',
        exercises,
        label:
          typeof row.title === 'string' && row.title.trim() ? row.title.trim() : 'Imported workout',
      },
    ],
  };
}
