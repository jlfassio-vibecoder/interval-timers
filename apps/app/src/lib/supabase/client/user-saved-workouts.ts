/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * User-saved workout templates (Universal Activity Hub Save Workout flow).
 */

import { supabase } from '../supabase-instance';
import type { WorkoutSetTemplate } from '@/types/ai-workout';

export interface UserSavedWorkout {
  id: string;
  user_id: string;
  title: string;
  workout_set: WorkoutSetTemplate;
  created_at: string;
  updated_at: string;
}

export async function listSavedWorkouts(userId: string): Promise<UserSavedWorkout[]> {
  const { data, error } = await supabase
    .from('user_saved_workouts')
    .select('id, user_id, title, workout_set, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    if (import.meta.env.DEV) console.error('[listSavedWorkouts]', error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    workout_set: row.workout_set as WorkoutSetTemplate,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function getSavedWorkout(id: string): Promise<UserSavedWorkout | null> {
  const { data, error } = await supabase
    .from('user_saved_workouts')
    .select('id, user_id, title, workout_set, created_at, updated_at')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    user_id: data.user_id,
    title: data.title,
    workout_set: data.workout_set as WorkoutSetTemplate,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/** Strip non-JSON-serializable values (React refs, undefined in arrays) to avoid insert failures. */
function toPlainJson<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export async function insertSavedWorkout(
  userId: string,
  params: { title: string; workoutSet: WorkoutSetTemplate }
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    throw new Error('You must be signed in to save workouts.');
  }
  if (session.user.id !== userId) {
    throw new Error('Session does not match. Please sign in again.');
  }

  const workoutSet = toPlainJson(params.workoutSet);
  const { data, error } = await supabase
    .from('user_saved_workouts')
    .insert({
      user_id: userId,
      title: params.title.trim() || 'Untitled Workout',
      workout_set: workoutSet,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    const err = error as { code?: string; message?: string; details?: string; hint?: string };
    const msg =
      err.code === '42501' || err.message?.toLowerCase().includes('row-level security')
        ? 'You must be signed in to save workouts.'
        : err.message || 'Failed to save workout.';
    throw new Error(msg);
  }
  return data.id;
}

export async function updateSavedWorkout(
  id: string,
  params: { title?: string; workoutSet?: WorkoutSetTemplate }
): Promise<void> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (params.title !== undefined) payload.title = params.title;
  if (params.workoutSet !== undefined) payload.workout_set = params.workoutSet;

  const { error } = await supabase
    .from('user_saved_workouts')
    .update(payload)
    .eq('id', id);
  if (error) {
    const err = error as { code?: string; message?: string };
    const msg =
      err.code === '42501' || err.message?.toLowerCase().includes('row-level security')
        ? 'You must be signed in to update workouts.'
        : err.message || 'Failed to update workout.';
    throw new Error(msg);
  }
}

export async function deleteSavedWorkout(id: string): Promise<void> {
  const { error } = await supabase.from('user_saved_workouts').delete().eq('id', id);
  if (error) throw error;
}
