/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Session history for Zone 6 History Zone.
 * Reads from user_workout_logs (WorkoutPlayer sessions).
 */

import { supabase } from '../supabase-instance';
import type { ExerciseLog } from '@/types/tracking';

export type SessionFilter = 'all' | 'this_week' | 'this_month' | { programId: string };

export interface SessionHistoryItem {
  id: string;
  programId: string;
  weekId: string;
  workoutId: string;
  date: string;
  durationSeconds: number;
  exercises: ExerciseLog[];
  workoutTitle?: string;
  programTitle?: string;
}

function _todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function getThisWeekRange(): { start: string; end: string } {
  const d = new Date();
  const day = d.getDay();
  const toMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - toMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

function getThisMonthRange(): { start: string; end: string } {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

/**
 * Get session history from user_workout_logs with optional date/program filter.
 * Workout and program titles are resolved client-side via getProgramWithSchedule.
 */
export async function getSessionHistory(
  userId: string,
  filter: SessionFilter,
  limit: number = 10
): Promise<SessionHistoryItem[]> {
  let query = supabase
    .from('user_workout_logs')
    .select('id, program_id, week_id, workout_id, date, duration_seconds, exercises')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (filter === 'this_week') {
    const { start, end } = getThisWeekRange();
    query = query.gte('date', start).lte('date', end);
  } else if (filter === 'this_month') {
    const { start, end } = getThisMonthRange();
    query = query.gte('date', start).lte('date', end);
  } else if (typeof filter === 'object' && filter.programId) {
    query = query.eq('program_id', filter.programId);
  }

  query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    if (import.meta.env.DEV) console.error('[getSessionHistory]', error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    programId: row.program_id,
    weekId: row.week_id,
    workoutId: row.workout_id,
    date: row.date as string,
    durationSeconds: row.duration_seconds ?? 0,
    exercises: (row.exercises ?? []) as ExerciseLog[],
  }));
}
