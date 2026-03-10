/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Maps Workout Factory WorkoutInSet (one session) to Artist for WorkoutDetailModal.
 */

import type { Artist, WorkoutDetail, WorkoutComponent } from '@/types';
import type { WorkoutInSet } from '@/types/ai-workout';
import { getExercisesFromWorkout } from '@/lib/program-schedule-utils';

const EMPTY_PHASE: WorkoutComponent = {
  title: '—',
  duration: '—',
  exercises: [],
};

export interface MapWorkoutInSetOptions {
  setId: string;
  sessionIndex: number;
  /** 1–5 intensity for display */
  intensity: number;
  id?: string;
  image?: string;
}

const DEFAULT_IMAGE = '/images/gym-barbell-squat-001.jpg';

/**
 * Maps a WorkoutInSet (one session in a published set) to the Artist shape expected by WorkoutDetailModal.
 * Builds workoutDetail from warmupBlocks and exerciseBlocks/blocks; finisher/cooldown empty.
 * Populates exerciseQueryMap when exerciseQuery is present.
 */
export function mapWorkoutInSetToArtist(
  workout: WorkoutInSet,
  options: MapWorkoutInSetOptions
): Artist {
  const {
    setId,
    sessionIndex,
    intensity,
    id = `workout-set-${setId}-session-${sessionIndex}`,
    image = DEFAULT_IMAGE,
  } = options;

  const mainExercises = getExercisesFromWorkout(
    workout as Parameters<typeof getExercisesFromWorkout>[0]
  );
  const exercises = mainExercises.map((b) => b.exerciseName);
  const exerciseQueryMap: Record<string, string> = {};
  for (const ex of mainExercises) {
    if (ex.exerciseQuery?.trim()) {
      exerciseQueryMap[ex.exerciseName] = ex.exerciseQuery.trim();
    }
  }

  const warmupBlocks = workout.warmupBlocks ?? [];
  const warmup: WorkoutComponent =
    warmupBlocks.length > 0
      ? {
          title: 'Warmup',
          duration: '—',
          exercises: warmupBlocks.map((b) => b.exerciseName),
        }
      : { ...EMPTY_PHASE, title: 'Warmup' };

  const finisherBlocks = workout.finisherBlocks ?? [];
  const finisher: WorkoutComponent =
    finisherBlocks.length > 0
      ? {
          title: 'Finisher',
          duration: '—',
          exercises: finisherBlocks.map((b) => b.exerciseName),
        }
      : { ...EMPTY_PHASE, title: 'Finisher' };

  const cooldownBlocks = workout.cooldownBlocks ?? [];
  const cooldown: WorkoutComponent =
    cooldownBlocks.length > 0
      ? {
          title: 'Cooldown',
          duration: '—',
          exercises: cooldownBlocks.map((b) => b.exerciseName),
        }
      : { ...EMPTY_PHASE, title: 'Cooldown' };

  const workoutDetail: WorkoutDetail = {
    warmup,
    main: {
      title: 'Workout',
      duration: '—',
      exercises,
    },
    finisher,
    cooldown,
  };

  return {
    id,
    name: workout.title ?? 'Workout',
    genre: '',
    image,
    day: `Session ${sessionIndex + 1}`,
    description: workout.description ?? '',
    intensity,
    workoutDetail,
    ...(Object.keys(exerciseQueryMap).length > 0 ? { exerciseQueryMap } : {}),
    ...(workout.exerciseOverrides && Object.keys(workout.exerciseOverrides).length > 0
      ? { exerciseOverrides: workout.exerciseOverrides }
      : {}),
  };
}
