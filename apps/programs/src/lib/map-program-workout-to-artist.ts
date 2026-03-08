/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Maps program schedule workout shape to Artist for WorkoutDetailModal (Mission Parameters).
 */

import type { Artist, WorkoutDetail, WorkoutComponent } from '@/types';
import type { ProgramSchedule } from '@/types/ai-program';
import { getExercisesFromWorkout } from '@/lib/program-schedule-utils';

export type ProgramWorkout = ProgramSchedule['workouts'][number];

const EMPTY_PHASE: WorkoutComponent = {
  title: '—',
  duration: '—',
  exercises: [],
};

export interface MapProgramWorkoutOptions {
  day: string;
  intensity: number;
  id?: string;
  image?: string;
}

const DEFAULT_IMAGE = '/images/gym-barbell-squat-001.jpg';

/**
 * Maps a program schedule workout to the Artist shape expected by WorkoutDetailModal.
 * Builds workoutDetail with a single main phase (all blocks' exercise names) and empty warmup/finisher/cooldown.
 * Populates exerciseQueryMap so resolution can use exerciseQuery as fallback when exerciseName does not match.
 */
export function mapProgramWorkoutToArtist(
  workout: ProgramWorkout,
  options: MapProgramWorkoutOptions
): Artist {
  const { day, intensity, id = 'program-workout', image = DEFAULT_IMAGE } = options;
  const mainExercises = getExercisesFromWorkout(workout);
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
  const workoutDetail: WorkoutDetail = {
    warmup,
    main: {
      title: 'Workout',
      duration: '—',
      exercises,
    },
    finisher: { ...EMPTY_PHASE, title: 'Finisher' },
    cooldown: { ...EMPTY_PHASE, title: 'Cooldown' },
  };
  return {
    id,
    name: workout.title ?? 'Workout',
    genre: '',
    image,
    day,
    description: workout.description ?? '',
    intensity,
    workoutDetail,
    ...(Object.keys(exerciseQueryMap).length > 0 ? { exerciseQueryMap } : {}),
  };
}
