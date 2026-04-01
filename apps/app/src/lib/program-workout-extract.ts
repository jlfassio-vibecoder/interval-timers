/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Converts a program schedule workout (embedded content) to WorkoutSetTemplate + WorkoutConfig
 * for "Extract to Workout Factory" flow.
 */

import { normalizeWorkoutForEditor } from '@/lib/program-schedule-utils';
import type { WorkoutSetTemplate, WorkoutConfig, WorkoutInSet } from '@/types/ai-workout';
import type { ProgramWorkout } from '@/lib/program-schedule-utils';

const DEFAULT_TARGET_AUDIENCE = {
  ageRange: '26-35',
  sex: 'Male',
  weight: 180,
  experienceLevel: 'intermediate' as const,
};

export interface ExtractedWorkout {
  workoutSet: WorkoutSetTemplate;
  workoutConfig: WorkoutConfig;
}

/**
 * Converts a program schedule workout to a WorkoutSetTemplate + minimal WorkoutConfig
 * for saving to workout_sets via saveWorkoutToLibrary.
 */
export function programWorkoutToWorkoutSet(
  workout: ProgramWorkout,
  setTitle?: string,
  setDescription?: string
): ExtractedWorkout {
  const normalized = normalizeWorkoutForEditor(workout);
  const workoutSet: WorkoutSetTemplate = {
    title: setTitle ?? workout.title,
    description: setDescription ?? (workout.description || ''),
    difficulty: 'intermediate',
    workouts: [normalized as WorkoutInSet],
  };

  const workoutConfig: WorkoutConfig = {
    workoutInfo: {
      title: workoutSet.title,
      description: workoutSet.description,
    },
    targetAudience: DEFAULT_TARGET_AUDIENCE,
    requirements: {
      sessionsPerWeek: 3,
      sessionDurationMinutes: 60,
      splitType: 'full_body',
      lifestyle: 'active',
      twoADay: false,
      weeklyTimeMinutes: 180,
    },
    goals: {
      primary: 'General Fitness',
      secondary: 'Strength',
    },
  };

  return { workoutSet, workoutConfig };
}
