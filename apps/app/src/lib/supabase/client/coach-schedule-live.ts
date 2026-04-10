/**
 * Client HUD: coach schedule instances with optional native live room link.
 */

import { calendarDateInZone } from '@/lib/performance-lab/trainer-calendar-time';
import type { CalendarEvent } from '@/lib/calendar-events';
import { supabase } from '../supabase-instance';

/**
 * Scheduled 1:1 coach slots in range with `trainer_live_session_id` when the trainer linked a room.
 */
export async function getClientCoachScheduleLiveEventsForRange(
  userId: string,
  rangeStart: string,
  rangeEnd: string,
  displayTimeZone: string
): Promise<CalendarEvent[]> {
  const startBound = `${rangeStart}T00:00:00.000Z`;
  const endBound = `${rangeEnd}T23:59:59.999Z`;

  const { data: rows, error } = await supabase
    .from('client_coach_schedule_instances')
    .select('id, scheduled_at, trainer_live_session_id, trainer_user_id, assignment_id')
    .eq('client_user_id', userId)
    .gte('scheduled_at', startBound)
    .lte('scheduled_at', endBound)
    .order('scheduled_at', { ascending: true });

  if (error) {
    if (import.meta.env.DEV) console.error('[getClientCoachScheduleLiveEventsForRange]', error);
    return [];
  }

  const list = rows ?? [];
  const asgIds = [...new Set(list.map((r) => r.assignment_id as string).filter(Boolean))];
  let titleByAsgId = new Map<string, string>();
  if (asgIds.length > 0) {
    const { data: asgs } = await supabase
      .from('client_coach_assignments')
      .select('id, title_snapshot')
      .in('id', asgIds);
    titleByAsgId = new Map(
      (asgs ?? []).map((a) => [
        a.id as string,
        typeof a.title_snapshot === 'string' ? a.title_snapshot.trim() : '',
      ])
    );
  }

  const out: CalendarEvent[] = [];
  for (const r of list) {
    const scheduledAt = r.scheduled_at as string;
    const date = calendarDateInZone(scheduledAt, displayTimeZone);
    const titleSnap = titleByAsgId.get(r.assignment_id as string) ?? '';
    out.push({
      type: 'coach_live',
      date,
      workoutTitle: titleSnap ? `Coach live · ${titleSnap}` : 'Coach live session',
      status: 'scheduled',
      sessionId: r.id as string,
      metadata: {
        scheduledAt,
        coachScheduleInstanceId: r.id as string,
        trainerLiveSessionId:
          r.trainer_live_session_id != null && String(r.trainer_live_session_id).length > 0
            ? String(r.trainer_live_session_id)
            : undefined,
        trainerUserId: r.trainer_user_id as string,
      },
    });
  }

  return out;
}
