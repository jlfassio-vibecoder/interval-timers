/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Scheduled timer/interval workouts (Phase 5.1). Calendar places from ScheduleWorkoutModal.
 */

import { supabase } from '../supabase-instance';

export interface ScheduledWorkout {
  id: string;
  user_id: string;
  source_app: string;
  scheduled_at: string;
  workout_title: string | null;
  config: Record<string, unknown> | null;
  created_at: string;
}

export interface SaveScheduledWorkoutParams {
  sourceApp: string;
  scheduledAt: string;
  workoutTitle?: string | null;
  config?: Record<string, unknown> | null;
}

export async function saveScheduledWorkout(
  userId: string,
  params: SaveScheduledWorkoutParams
): Promise<string> {
  const { data, error } = await supabase
    .from('scheduled_workouts')
    .insert({
      user_id: userId,
      source_app: params.sourceApp,
      scheduled_at: params.scheduledAt,
      workout_title: params.workoutTitle ?? null,
      config: params.config ?? null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function getScheduledWorkoutsForRange(
  userId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<ScheduledWorkout[]> {
  const startIso = `${rangeStart}T00:00:00Z`;
  const endIso = `${rangeEnd}T23:59:59Z`;

  const { data, error } = await supabase
    .from('scheduled_workouts')
    .select('id, user_id, source_app, scheduled_at, workout_title, config, created_at')
    .eq('user_id', userId)
    .gte('scheduled_at', startIso)
    .lte('scheduled_at', endIso)
    .order('scheduled_at', { ascending: true });

  if (error) {
    if (import.meta.env.DEV) console.error('[getScheduledWorkoutsForRange]', error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    source_app: row.source_app,
    scheduled_at: row.scheduled_at,
    workout_title: row.workout_title,
    config: row.config as Record<string, unknown> | null,
    created_at: row.created_at,
  }));
}

export async function updateScheduledWorkout(
  id: string,
  updates: { scheduledAt: string }
): Promise<void> {
  const { error } = await supabase
    .from('scheduled_workouts')
    .update({ scheduled_at: updates.scheduledAt })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteScheduledWorkout(id: string): Promise<void> {
  const { error } = await supabase.from('scheduled_workouts').delete().eq('id', id);
  if (error) throw error;
}
