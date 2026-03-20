/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Fetch calendar events from non-program sources (AMRAP, timer logs, readiness) for unified calendar.
 */

import { getAmrapSessionResults } from './amrap-session-results';
import { getAmrapScheduledSessionsForUser } from './amrap-scheduled-sessions';
import { getScheduledWorkoutsForRange } from './scheduled-workouts';
import { getAmrapPresetName } from '@/lib/amrap-preset-name';
import type { CalendarEvent } from '@/lib/calendar-events';
import { supabase } from '../supabase-instance';

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * AMRAP completed sessions in range → CalendarEvent[] (type: 'amrap', status: 'completed').
 */
export async function getAmrapCompletedEventsForRange(
  userId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<CalendarEvent[]> {
  const results = await getAmrapSessionResults(userId, 100);
  const events: CalendarEvent[] = [];
  for (const r of results) {
    const date = dateOnly(r.completed_at);
    if (date >= rangeStart && date <= rangeEnd) {
      const workoutList = r.workout_list?.length ? r.workout_list : undefined;
      const presetTitle = workoutList ? getAmrapPresetName(workoutList) : null;
      events.push({
        type: 'amrap',
        date,
        workoutTitle: r.workout_name?.trim() || presetTitle || 'AMRAP With Friends',
        status: 'completed',
        sessionId: r.session_id,
        metadata: {
          rounds: r.total_rounds,
          durationMinutes: r.duration_minutes,
          workoutList,
        },
      });
    }
  }
  return events;
}

/**
 * AMRAP scheduled sessions in range → CalendarEvent[] (type: 'amrap_scheduled', status: 'scheduled').
 */
export async function getAmrapScheduledEventsForRange(
  userId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<CalendarEvent[]> {
  const sessions = await getAmrapScheduledSessionsForUser(userId, rangeStart, rangeEnd);
  return sessions.map((s) => {
    const workoutList = s.workout_list?.length ? s.workout_list : undefined;
    const presetTitle = workoutList ? getAmrapPresetName(workoutList) : null;
    return {
      type: 'amrap_scheduled' as const,
      date: dateOnly(s.scheduled_start_at),
      workoutTitle: presetTitle ?? 'AMRAP With Friends',
      status: 'scheduled' as const,
      sessionId: s.id,
      metadata: {
        durationMinutes: s.duration_minutes,
        scheduledAt: s.scheduled_start_at,
        workoutList,
      },
    };
  });
}

/**
 * Timer app logs (workout_logs with source) in range → CalendarEvent[] (type: 'timer', status: 'completed').
 */
export async function getTimerLogEventsForRange(
  userId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('id, date, workout_name, source, duration_seconds, effort, rating, rounds, notes')
    .eq('user_id', userId)
    .not('source', 'is', null)
    .neq('source', 'amrap_with_friends') // AMRAP With Friends shown via getAmrapCompletedEventsForRange
    .neq('workout_name', 'Readiness')
    .gte('date', rangeStart)
    .lte('date', rangeEnd)
    .order('date', { ascending: true });

  if (error) {
    if (import.meta.env.DEV) console.error('[getTimerLogEventsForRange]', error);
    return [];
  }

  return (data ?? []).map((row) => ({
    type: 'timer' as const,
    date: row.date as string,
    workoutTitle: (row.workout_name as string) ?? 'Timer',
    status: 'completed' as const,
    sourceApp: row.source as string,
    metadata: {
      durationSeconds: row.duration_seconds ?? undefined,
      effort: row.effort ?? undefined,
      rating: row.rating ?? undefined,
      rounds: row.rounds ?? undefined,
      logId: row.id as string,
      notes: (row.notes as string | null) ?? undefined,
    },
  }));
}

/**
 * Scheduled timer/interval workouts (scheduled_workouts) in range → CalendarEvent[] (type: 'timer_scheduled', status: 'scheduled').
 */
export async function getScheduledWorkoutEventsForRange(
  userId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<CalendarEvent[]> {
  const rows = await getScheduledWorkoutsForRange(userId, rangeStart, rangeEnd);
  return rows.map((row) => ({
    type: 'timer_scheduled' as const,
    date: dateOnly(row.scheduled_at),
    workoutTitle:
      row.workout_title ??
      (row.source_app === 'tabata'
        ? 'Tabata'
        : row.source_app === 'daily-warmup'
          ? 'Daily Warm-Up'
          : row.source_app === 'universal_activity_hub'
            ? 'Universal Activity'
            : 'Timer'),
    status: 'scheduled' as const,
    sessionId: row.id,
    sourceApp: row.source_app,
    metadata: { scheduledAt: row.scheduled_at },
  }));
}

/**
 * Readiness check-ins (workout_logs workout_name='Readiness') in range → CalendarEvent[] (type: 'readiness', status: 'completed').
 */
export async function getReadinessEventsForRange(
  userId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('date, readiness_score')
    .eq('user_id', userId)
    .eq('workout_name', 'Readiness')
    .gte('date', rangeStart)
    .lte('date', rangeEnd)
    .order('date', { ascending: true });

  if (error) {
    if (import.meta.env.DEV) console.error('[getReadinessEventsForRange]', error);
    return [];
  }

  return (data ?? []).map((row) => ({
    type: 'readiness' as const,
    date: row.date as string,
    workoutTitle: 'Readiness',
    status: 'completed' as const,
    metadata: { rating: (row as { readiness_score?: number }).readiness_score },
  }));
}
