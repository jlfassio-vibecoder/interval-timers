/**
 * Client-side workout logs (summary logs: effort, rating, notes).
 * Replaces firebaseService.saveWorkoutLog / fetchWorkoutLogs.
 */

import { supabase } from '../supabase-instance';
import type { WorkoutLog } from '@/types';

export async function saveWorkoutLog(log: Omit<WorkoutLog, 'id'>): Promise<string> {
  const { data, error } = await supabase
    .from('workout_logs')
    .insert({
      user_id: log.userId,
      workout_id: log.workoutId ?? null,
      workout_name: log.workoutName,
      date: log.date,
      effort: log.effort,
      rating: log.rating,
      notes: log.notes ?? '',
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function fetchWorkoutLogs(uid: string): Promise<WorkoutLog[]> {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('*')
    .eq('user_id', uid)
    .order('date', { ascending: false });

  if (error) {
    if (import.meta.env.DEV) console.error('[fetchWorkoutLogs]', error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    workoutId: row.workout_id ?? undefined,
    workoutName: row.workout_name,
    date: row.date,
    effort: row.effort,
    rating: row.rating,
    notes: row.notes ?? '',
  })) as WorkoutLog[];
}
