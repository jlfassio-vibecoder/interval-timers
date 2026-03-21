import type { WorkoutInSet, WorkoutSetTemplate } from './types';

/**
 * Validates an unknown body (e.g. POST `workoutSet`) for handoff / parse routes.
 * Returns a normalized-ready object; callers should still run domain normalization
 * (e.g. `normalizeWorkoutSet`) before storage or playback.
 */
export function parseWorkoutSetFromHandoffBody(data: unknown): WorkoutSetTemplate | null {
  if (!data || typeof data !== 'object' || !('workouts' in data)) return null;
  const raw = data as Record<string, unknown>;
  const workouts = raw.workouts;
  if (!Array.isArray(workouts) || workouts.length === 0) return null;
  const validWorkouts = workouts.filter(
    (w): w is WorkoutInSet =>
      Boolean(
        w &&
          typeof w === 'object' &&
          (('exerciseBlocks' in w && Array.isArray((w as WorkoutInSet).exerciseBlocks)) ||
            ('blocks' in w && Array.isArray((w as WorkoutInSet).blocks)) ||
            ('title' in w && typeof (w as WorkoutInSet).title === 'string'))
      )
  );
  if (validWorkouts.length === 0) return null;
  const title = typeof raw.title === 'string' ? raw.title : 'Pasted Workout';
  const description = typeof raw.description === 'string' ? raw.description : '';
  const difficulty =
    typeof raw.difficulty === 'string' &&
    ['beginner', 'intermediate', 'advanced'].includes(raw.difficulty)
      ? (raw.difficulty as 'beginner' | 'intermediate' | 'advanced')
      : 'intermediate';
  return {
    title,
    description,
    difficulty,
    workouts: validWorkouts,
  } as WorkoutSetTemplate;
}
