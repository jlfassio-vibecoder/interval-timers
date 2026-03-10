/**
 * Client-side set-level workout tracking (WorkoutPlayer).
 * Replaces firebase/client/tracking.
 */

import { supabase } from '../client';
import type { WorkoutLog } from '@/types/tracking';

export async function saveWorkoutLog(userId: string, log: WorkoutLog): Promise<string> {
  if (!log.date || Number.isNaN(log.date.getTime())) {
    throw new Error('Invalid workout log date');
  }

  const { data, error } = await supabase
    .from('user_workout_logs')
    .insert({
      user_id: userId,
      program_id: log.programId,
      week_id: log.weekId,
      workout_id: log.workoutId,
      date: log.date.toISOString().slice(0, 10),
      duration_seconds: log.durationSeconds,
      exercises: log.exercises,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}
