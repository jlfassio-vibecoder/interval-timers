/**
 * Client-side set-level workout tracking (WorkoutPlayer).
 * Replaces firebase/client/tracking.
 */

import { supabase } from '../supabase-instance';
import type { WorkoutLog } from '@/types/tracking';

/** Return YYYY-MM-DD for a Date in the user's local timezone (avoids UTC shift). */
function toLocalDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Sanitize exercises to plain JSON-serializable structure (avoids NaN, undefined, etc.). */
function sanitizeExercises(exercises: WorkoutLog['exercises']): WorkoutLog['exercises'] {
  try {
    return JSON.parse(JSON.stringify(exercises)) as WorkoutLog['exercises'];
  } catch {
    return exercises;
  }
}

export async function saveWorkoutLog(userId: string, log: WorkoutLog): Promise<string> {
  if (!log.date || Number.isNaN(log.date.getTime())) {
    throw new Error('Invalid workout log date');
  }

  const payload: Record<string, unknown> = {
    user_id: userId,
    program_id: String(log.programId ?? ''),
    week_id: String(log.weekId ?? ''),
    workout_id: String(log.workoutId ?? ''),
    date: toLocalDateISO(log.date),
    duration_seconds: Math.floor(Number(log.durationSeconds) || 0),
    exercises: sanitizeExercises(log.exercises),
  };
  if (log.coachAssignmentId?.trim()) {
    payload.coach_assignment_id = log.coachAssignmentId.trim();
  }
  if (log.coachResourceId?.trim()) {
    payload.coach_resource_id = log.coachResourceId.trim();
  }
  if (log.coachAssignmentType === 'workout' || log.coachAssignmentType === 'wod') {
    payload.coach_assignment_type = log.coachAssignmentType;
  }
  // Omit workout_display_name until migration 20250330000000 is applied (column may not exist in prod)

  const { data, error } = await supabase
    .from('user_workout_logs')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    const msg = error.message || 'Save failed';
    const details = error.details ? ` (${error.details})` : '';
    const hint = error.hint ? ` Hint: ${error.hint}` : '';
    throw new Error(`${msg}${details}${hint}`);
  }
  return data.id;
}
