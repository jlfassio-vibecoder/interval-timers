/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Client HUD: scheduled live session invites (P0).
 */

import { calendarDateInZone } from '@/lib/performance-lab/trainer-calendar-time';
import type { CalendarEvent } from '@/lib/calendar-events';
import { supabase } from '../supabase-instance';

function waitlistPositionByInviteId(
  rows: Array<{ id: string; occurrence_id: string; status: string; created_at: string }>
): Map<string, number> {
  const byOcc = new Map<string, typeof rows>();
  for (const r of rows) {
    if (r.status !== 'waitlisted') continue;
    const oid = r.occurrence_id;
    const arr = byOcc.get(oid) ?? [];
    arr.push(r);
    byOcc.set(oid, arr);
  }
  const pos = new Map<string, number>();
  for (const list of byOcc.values()) {
    list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    list.forEach((r, i) => pos.set(r.id, i + 1));
  }
  return pos;
}

/**
 * Invites for `userId` with pending/accepted/waitlisted on scheduled occurrences in calendar range.
 * `displayTimeZone` places the event on the correct HUD calendar day.
 */
export async function getLiveScheduledCalendarEventsForRange(
  userId: string,
  rangeStart: string,
  rangeEnd: string,
  displayTimeZone: string
): Promise<CalendarEvent[]> {
  const { data: invs, error: invErr } = await supabase
    .from('trainer_live_session_invites')
    .select('id, status, occurrence_id, created_at')
    .eq('invitee_user_id', userId)
    .in('status', ['pending', 'accepted', 'waitlisted']);

  if (invErr) {
    if (import.meta.env.DEV) console.error('[getLiveScheduledCalendarEventsForRange] invites', invErr);
    return [];
  }

  const rows = invs ?? [];
  if (rows.length === 0) return [];

  const occIds = [...new Set(rows.map((r) => r.occurrence_id as string))];
  const { data: occs, error: occErr } = await supabase
    .from('trainer_live_session_occurrences')
    .select('id, scheduled_start_at, scheduled_end_at, status, trainer_user_id')
    .in('id', occIds)
    .eq('status', 'scheduled');

  if (occErr) {
    if (import.meta.env.DEV) console.error('[getLiveScheduledCalendarEventsForRange] occs', occErr);
    return [];
  }

  const occById = new Map((occs ?? []).map((o) => [o.id as string, o]));
  const waitlistPos = waitlistPositionByInviteId(
    rows.map((r) => ({
      id: r.id as string,
      occurrence_id: r.occurrence_id as string,
      status: r.status as string,
      created_at: (r.created_at as string) ?? '',
    }))
  );
  const events: CalendarEvent[] = [];

  for (const inv of rows) {
    const occ = occById.get(inv.occurrence_id as string);
    if (!occ) continue;
    const startIso = occ.scheduled_start_at as string;
    const date = calendarDateInZone(startIso, displayTimeZone);
    if (date < rangeStart || date > rangeEnd) continue;

    const st = inv.status as string;
    const wlPos = st === 'waitlisted' ? waitlistPos.get(inv.id as string) : undefined;
    const workoutTitle =
      st === 'pending'
        ? 'Live session · invite pending'
        : st === 'waitlisted'
          ? wlPos != null
            ? `Live session · waitlist #${wlPos}`
            : 'Live session · waitlisted'
          : 'Live session';

    events.push({
      type: 'live_scheduled',
      date,
      workoutTitle,
      status: 'scheduled',
      metadata: {
        scheduledAt: startIso,
        liveInviteId: inv.id as string,
        occurrenceId: occ.id as string,
        inviteStatus: st,
        waitlistPosition: wlPos,
        trainerUserId: occ.trainer_user_id as string,
        scheduledEndAt: occ.scheduled_end_at as string,
      },
    });
  }

  return events;
}
