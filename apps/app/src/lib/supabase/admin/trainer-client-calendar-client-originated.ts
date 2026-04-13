/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase D: server-side reads of client-originated schedule rows for Mission Control calendars.
 * Call only after roster access is verified (e.g. inside buildTrainerClientCalendarPayload).
 */

import { getSupabaseServer } from '@/lib/supabase/server';

export type AdminScheduledWorkoutRow = {
  id: string;
  source_app: string;
  scheduled_at: string;
  workout_title: string | null;
};

export type AdminAmrapScheduledRow = {
  id: string;
  duration_minutes: number;
  workout_list: unknown;
  scheduled_start_at: string;
};

export function normalizeWorkoutList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((e) => (typeof e === 'string' ? e.trim() : String(e))).filter(Boolean);
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return normalizeWorkoutList(parsed);
    } catch {
      return raw.trim() ? [raw.trim()] : [];
    }
  }
  return [];
}

export async function fetchScheduledWorkoutsForClientRangeAdmin(
  clientUserId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<AdminScheduledWorkoutRow[]> {
  const supabase = getSupabaseServer();
  const startIso = `${rangeStart}T00:00:00Z`;
  const endIso = `${rangeEnd}T23:59:59Z`;

  const { data, error } = await supabase
    .from('scheduled_workouts')
    .select('id, source_app, scheduled_at, workout_title')
    .eq('user_id', clientUserId)
    .gte('scheduled_at', startIso)
    .lte('scheduled_at', endIso)
    .order('scheduled_at', { ascending: true });

  if (error) {
    if (import.meta.env.DEV)
      console.warn('[trainer-client-calendar-client-originated] scheduled_workouts', error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    source_app: String(row.source_app ?? ''),
    scheduled_at: row.scheduled_at as string,
    workout_title: (row.workout_title as string | null) ?? null,
  }));
}

export async function fetchAmrapScheduledSessionsForClientRangeAdmin(
  clientUserId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<AdminAmrapScheduledRow[]> {
  const supabase = getSupabaseServer();
  const startIso = `${rangeStart}T00:00:00Z`;
  const endIso = `${rangeEnd}T23:59:59Z`;

  const { data: created, error: err1 } = await supabase
    .from('amrap_sessions')
    .select('id, duration_minutes, workout_list, scheduled_start_at')
    .eq('created_by_user_id', clientUserId)
    .not('scheduled_start_at', 'is', null)
    .gte('scheduled_start_at', startIso)
    .lt('scheduled_start_at', endIso)
    .order('scheduled_start_at', { ascending: true });

  if (err1 && import.meta.env.DEV) {
    console.warn('[trainer-client-calendar-client-originated] amrap created', err1);
  }

  const { data: participantRows } = await supabase
    .from('amrap_participants')
    .select('session_id')
    .eq('user_id', clientUserId);

  const sessionIds = participantRows?.map((r) => r.session_id).filter(Boolean) ?? [];

  if (sessionIds.length === 0) {
    return (created ?? []).map((row) => ({
      id: row.id as string,
      duration_minutes: Number(row.duration_minutes ?? 0),
      workout_list: row.workout_list,
      scheduled_start_at: row.scheduled_start_at as string,
    }));
  }

  const { data: participantSessions, error: err2 } = await supabase
    .from('amrap_sessions')
    .select('id, duration_minutes, workout_list, scheduled_start_at')
    .in('id', sessionIds)
    .not('scheduled_start_at', 'is', null)
    .gte('scheduled_start_at', startIso)
    .lt('scheduled_start_at', endIso)
    .order('scheduled_start_at', { ascending: true });

  if (err2 && import.meta.env.DEV) {
    console.warn('[trainer-client-calendar-client-originated] amrap participant', err2);
  }

  const byId = new Map<string, AdminAmrapScheduledRow>();
  for (const row of created ?? []) {
    byId.set(row.id as string, {
      id: row.id as string,
      duration_minutes: Number(row.duration_minutes ?? 0),
      workout_list: row.workout_list,
      scheduled_start_at: row.scheduled_start_at as string,
    });
  }
  for (const row of participantSessions ?? []) {
    const id = row.id as string;
    if (!byId.has(id)) {
      byId.set(id, {
        id,
        duration_minutes: Number(row.duration_minutes ?? 0),
        workout_list: row.workout_list,
        scheduled_start_at: row.scheduled_start_at as string,
      });
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.scheduled_start_at).getTime() - new Date(b.scheduled_start_at).getTime()
  );
}
