/**
 * Build WorkoutSetTemplate for pasted / WorkoutPlayer from coach assignment payloads.
 */

import type { WorkoutDetail } from '@/types';
import type { WorkoutSetTemplate, WorkoutInSet } from '@/types/ai-workout';
import type { WorkoutBlock } from '@/lib/supabase/admin/workout-details';
import { blocksToWorkoutInSet } from '@/lib/admin/workout-editor-map';

export function workoutRowToWorkoutSetTemplate(row: {
  title: string;
  description: string | null;
  blocks: unknown;
  difficulty_level?: string | null;
}): WorkoutSetTemplate {
  const blocks = Array.isArray(row.blocks) ? (row.blocks as WorkoutBlock[]) : [];
  const workoutInSet = blocksToWorkoutInSet(blocks, undefined, {
    title: row.title?.trim() || 'Workout',
    description: row.description?.trim() || '',
  });
  const difficulty =
    typeof row.difficulty_level === 'string' && row.difficulty_level.trim()
      ? row.difficulty_level.trim()
      : 'intermediate';
  return {
    title: row.title?.trim() || 'Workout',
    description: row.description?.trim() || '',
    difficulty: difficulty as WorkoutSetTemplate['difficulty'],
    workouts: [workoutInSet],
  };
}

/**
 * Minimal WorkoutInSet from WOD WorkoutDetail so WorkoutPlayer can log sets (names from main phase).
 */
export function wodWorkoutDetailToWorkoutSetTemplate(
  name: string,
  description: string,
  detail: WorkoutDetail
): WorkoutSetTemplate {
  const mainNames = detail.main?.exercises?.filter((n) => typeof n === 'string' && n.trim()) ?? [];
  const names = mainNames.length > 0 ? mainNames : ['Complete as prescribed'];
  const exercises = names.map((exerciseName, i) => ({
    order: i + 1,
    exerciseName,
    sets: 3,
    reps: '10',
    restSeconds: 60,
  }));
  const workoutInSet: WorkoutInSet = {
    title: name,
    description,
    exerciseBlocks:
      exercises.length > 0
        ? [
            {
              order: 1,
              name: 'Main',
              exercises,
            },
          ]
        : undefined,
  };
  return {
    title: name,
    description,
    difficulty: 'intermediate',
    workouts: [workoutInSet],
  };
}
