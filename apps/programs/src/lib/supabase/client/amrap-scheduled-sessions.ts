/**
 * AMRAP With Friends scheduled sessions for HUD ScheduleZone.
 * Fetches sessions where user is creator or participant.
 */

import { supabase } from '../client';

export interface AmrapScheduledSession {
  id: string;
  duration_minutes: number;
  workout_list: string[];
  scheduled_start_at: string;
}

/**
 * Get AMRAP sessions scheduled by the user (created_by_user_id) or where user is a participant.
 */
export async function getAmrapScheduledSessionsForUser(
  userId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<AmrapScheduledSession[]> {
  const startIso = `${rangeStart}T00:00:00Z`;
  const endIso = `${rangeEnd}T23:59:59Z`;

  const { data: created, error: err1 } = await supabase
    .from('amrap_sessions')
    .select('id, duration_minutes, workout_list, scheduled_start_at')
    .eq('created_by_user_id', userId)
    .not('scheduled_start_at', 'is', null)
    .gte('scheduled_start_at', startIso)
    .lt('scheduled_start_at', endIso)
    .order('scheduled_start_at', { ascending: true });

  if (err1) {
    if (import.meta.env.DEV) console.error('[getAmrapScheduledSessionsForUser] created', err1);
  }

  const { data: participantRows } = await supabase
    .from('amrap_participants')
    .select('session_id')
    .eq('user_id', userId);

  const sessionIds =
    participantRows?.map((r) => r.session_id).filter(Boolean) ?? [];

  if (sessionIds.length === 0) {
    return (created ?? []).map((row) => ({
      id: row.id,
      duration_minutes: row.duration_minutes,
      workout_list: (row.workout_list ?? []) as string[],
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

  if (err2) {
    if (import.meta.env.DEV) console.error('[getAmrapScheduledSessionsForUser] participant', err2);
  }

  const byId = new Map<string, AmrapScheduledSession>();
  for (const row of created ?? []) {
    byId.set(row.id, {
      id: row.id,
      duration_minutes: row.duration_minutes,
      workout_list: (row.workout_list ?? []) as string[],
      scheduled_start_at: row.scheduled_start_at as string,
    });
  }
  for (const row of participantSessions ?? []) {
    if (!byId.has(row.id)) {
      byId.set(row.id, {
        id: row.id,
        duration_minutes: row.duration_minutes,
        workout_list: (row.workout_list ?? []) as string[],
        scheduled_start_at: row.scheduled_start_at as string,
      });
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) =>
      new Date(a.scheduled_start_at).getTime() - new Date(b.scheduled_start_at).getTime()
  );
}
