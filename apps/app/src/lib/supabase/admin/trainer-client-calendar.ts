/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * P2: Trainer-scoped client calendar read + coach schedule instance mutations.
 */

import type { ProgramSchedule } from '@/types/ai-program';
import {
  getCalendarEventsForRange,
  type CalendarEvent,
  type ProgramForCalendar,
} from '@/lib/calendar-events';
import { getSupabaseServer } from '@/lib/supabase/server';
import { isUserInViewerRoster } from '@/lib/supabase/admin/trainer-roster';

export const MAX_CALENDAR_RANGE_DAYS = 93;

export function parseISODateOnly(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** True if `iso` is YYYY-MM-DD and that calendar day exists in UTC (regex alone admits e.g. 2026-02-31). */
function isValidUtcCalendarDateOnly(iso: string): boolean {
  if (!parseISODateOnly(iso)) return false;
  const t = new Date(`${iso}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(t)) return false;
  const d = new Date(t);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}` === iso;
}

export function validateCalendarRange(
  from: string,
  to: string
): { ok: true } | { ok: false; error: string } {
  if (!parseISODateOnly(from) || !parseISODateOnly(to)) {
    return { ok: false, error: 'from and to must be YYYY-MM-DD' };
  }
  if (!isValidUtcCalendarDateOnly(from) || !isValidUtcCalendarDateOnly(to)) {
    return { ok: false, error: 'from and to must be valid calendar dates' };
  }
  if (from > to) return { ok: false, error: 'from must be <= to' };
  const d0 = new Date(`${from}T00:00:00.000Z`).getTime();
  const d1 = new Date(`${to}T00:00:00.000Z`).getTime();
  const days = Math.floor((d1 - d0) / 86400000) + 1;
  if (days > MAX_CALENDAR_RANGE_DAYS) {
    return { ok: false, error: `Range must be at most ${MAX_CALENDAR_RANGE_DAYS} days` };
  }
  if (days < 1) return { ok: false, error: 'Invalid range' };
  return { ok: true };
}

export type TrainerCalendarApiEvent =
  | ({ kind: 'program'; draggable: false } & CalendarEvent)
  | {
      kind: 'coach_instance';
      draggable: true;
      instanceId: string;
      assignmentId: string;
      assignmentType: string;
      title: string;
      scheduledAt: string;
      /** UTC calendar date YYYY-MM-DD for grid placement */
      date: string;
    };

async function fetchClientTimezone(clientUserId: string): Promise<string> {
  const supabase = getSupabaseServer();
  const { data } = await supabase.from('profiles').select('timezone').eq('id', clientUserId).maybeSingle();
  const tz = (data as { timezone?: string | null } | null)?.timezone;
  return typeof tz === 'string' && tz.trim() ? tz.trim() : 'UTC';
}

interface ProgramWeekRow {
  week_number: number;
  content?: { weekNumber?: number; workouts?: ProgramSchedule['workouts'] } | null;
}

function scheduleFromProgramWeekRows(rows: ProgramWeekRow[]): ProgramSchedule[] {
  return rows.map((row) => ({
    weekNumber: row.content?.weekNumber ?? row.week_number ?? 0,
    workouts: (row.content?.workouts ?? []) as ProgramSchedule['workouts'],
  }));
}

export async function fetchProgramsForCalendarForClient(clientUserId: string): Promise<ProgramForCalendar[]> {
  const supabase = getSupabaseServer();
  const { data: rows, error } = await supabase
    .from('user_programs')
    .select('program_id, start_date, status')
    .eq('user_id', clientUserId);

  if (error || !rows?.length) return [];

  const programIds = [...new Set(rows.map((r) => r.program_id as string).filter(Boolean))];
  if (programIds.length === 0) return [];

  // Batched reads: one programs rowset + one program_weeks rowset (avoids N+1 per enrollment).
  const { data: programRows, error: programsError } = await supabase
    .from('programs')
    .select('id, title')
    .in('id', programIds);

  if (programsError || !programRows?.length) return [];

  const titleByProgramId = new Map<string, string>();
  for (const p of programRows) {
    const id = p.id as string;
    titleByProgramId.set(id, typeof p.title === 'string' ? p.title : 'Program');
  }

  const { data: allWeeks, error: weeksError } = await supabase
    .from('program_weeks')
    .select('program_id, week_number, content')
    .in('program_id', programIds);

  const weeksByProgramId = new Map<string, ProgramWeekRow[]>();
  if (!weeksError) {
    for (const w of allWeeks ?? []) {
      const pid = w.program_id as string;
      const list = weeksByProgramId.get(pid);
      const row: ProgramWeekRow = {
        week_number: w.week_number as number,
        content: (w as { content?: ProgramWeekRow['content'] }).content,
      };
      if (list) list.push(row);
      else weeksByProgramId.set(pid, [row]);
    }
    for (const list of weeksByProgramId.values()) {
      list.sort((a, b) => (a.week_number ?? 0) - (b.week_number ?? 0));
    }
  }

  const results: ProgramForCalendar[] = [];
  for (const r of rows) {
    const startDate = r.start_date;
    if (typeof startDate !== 'string' || !startDate.trim()) continue;
    const programId = r.program_id as string;
    const title = titleByProgramId.get(programId);
    if (title == null) continue;

    const weekRows = weeksByProgramId.get(programId) ?? [];
    const schedule = weeksError ? [] : scheduleFromProgramWeekRows(weekRows);

    results.push({
      programId,
      title,
      startDate: startDate.trim(),
      schedule,
    });
  }
  return results;
}

export async function fetchLoggedMapForCalendarRange(
  clientUserId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<Map<string, Set<string>>> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('user_workout_logs')
    .select('date, program_id, week_id, workout_id')
    .eq('user_id', clientUserId)
    .gte('date', rangeStart)
    .lte('date', rangeEnd);

  if (error) return new Map();

  const map = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const date = row.date as string;
    const key = `${row.program_id}:${row.week_id}:${row.workout_id}`;
    let set = map.get(date);
    if (!set) {
      set = new Set<string>();
      map.set(date, set);
    }
    set.add(key);
  }
  return map;
}

function utcDateOnlyFromTimestamptz(iso: string): string {
  return iso.slice(0, 10);
}

export async function fetchCoachScheduleInstancesForRange(
  clientUserId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<
  Array<{
    id: string;
    assignmentId: string;
    scheduledAt: string;
    title: string;
    assignmentType: string;
  }>
> {
  const supabase = getSupabaseServer();
  const startIso = `${rangeStart}T00:00:00.000Z`;
  const endIso = `${rangeEnd}T23:59:59.999Z`;

  const { data: instRows, error } = await supabase
    .from('client_coach_schedule_instances')
    .select('id, assignment_id, scheduled_at')
    .eq('client_user_id', clientUserId)
    .gte('scheduled_at', startIso)
    .lte('scheduled_at', endIso)
    .order('scheduled_at', { ascending: true });

  if (error) {
    if (import.meta.env.DEV) console.warn('[trainer-client-calendar] instances', error);
    return [];
  }

  const rows = instRows ?? [];
  if (rows.length === 0) return [];

  const assignmentIds = [...new Set(rows.map((r) => r.assignment_id as string).filter(Boolean))];
  const { data: asgRows } = await supabase
    .from('client_coach_assignments')
    .select('id, revoked_at, dismissed_at, title_snapshot, assignment_type')
    .in('id', assignmentIds);

  const asgMap = new Map(
    (asgRows ?? []).map((a) => [
      a.id as string,
      a as {
        revoked_at?: string | null;
        dismissed_at?: string | null;
        title_snapshot?: string | null;
        assignment_type?: string | null;
      },
    ])
  );

  const out: Array<{
    id: string;
    assignmentId: string;
    scheduledAt: string;
    title: string;
    assignmentType: string;
  }> = [];

  for (const row of rows) {
    const assignmentId = row.assignment_id as string;
    const a = asgMap.get(assignmentId);
    if (!a || a.revoked_at || a.dismissed_at) continue;

    const scheduledAt = row.scheduled_at as string;
    out.push({
      id: row.id as string,
      assignmentId,
      scheduledAt,
      title:
        typeof a.title_snapshot === 'string' && a.title_snapshot.trim()
          ? a.title_snapshot.trim()
          : 'Coach item',
      assignmentType: typeof a.assignment_type === 'string' ? a.assignment_type : 'workout',
    });
  }
  return out;
}

export async function buildTrainerClientCalendarPayload(
  viewerId: string,
  clientUserId: string,
  viewerRole: string,
  from: string,
  to: string
): Promise<{ timezone: string; events: TrainerCalendarApiEvent[] } | null> {
  const allowed = await isUserInViewerRoster(viewerId, viewerRole, clientUserId);
  if (!allowed) return null;

  const timezone = await fetchClientTimezone(clientUserId);
  const [programs, loggedMap, instances] = await Promise.all([
    fetchProgramsForCalendarForClient(clientUserId),
    fetchLoggedMapForCalendarRange(clientUserId, from, to),
    fetchCoachScheduleInstancesForRange(clientUserId, from, to),
  ]);

  const programEvents = getCalendarEventsForRange(from, to, programs, loggedMap);

  const events: TrainerCalendarApiEvent[] = programEvents.map((e) => ({
    kind: 'program' as const,
    draggable: false as const,
    ...e,
  }));

  for (const inst of instances) {
    events.push({
      kind: 'coach_instance',
      draggable: true,
      instanceId: inst.id,
      assignmentId: inst.assignmentId,
      assignmentType: inst.assignmentType,
      title: inst.title,
      scheduledAt: inst.scheduledAt,
      date: utcDateOnlyFromTimestamptz(inst.scheduledAt),
    });
  }

  events.sort((a, b) => {
    const c = a.date.localeCompare(b.date);
    if (c !== 0) return c;
    const rank = (e: TrainerCalendarApiEvent) => (e.kind === 'program' ? 0 : 1);
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    if (a.kind === 'coach_instance' && b.kind === 'coach_instance') {
      return a.scheduledAt.localeCompare(b.scheduledAt);
    }
    return 0;
  });

  return { timezone, events };
}

export async function patchCoachScheduleInstance(
  viewerId: string,
  clientUserId: string,
  viewerRole: string,
  instanceId: string,
  scheduledAt: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = Date.parse(scheduledAt);
  if (Number.isNaN(t)) return { ok: false, error: 'Invalid scheduledAt' };

  const allowed = await isUserInViewerRoster(viewerId, viewerRole, clientUserId);
  if (!allowed) return { ok: false, error: 'Client not found or not in your roster' };

  const supabase = getSupabaseServer();
  const { data: row, error: fetchErr } = await supabase
    .from('client_coach_schedule_instances')
    .select('id, client_user_id, trainer_user_id, assignment_id')
    .eq('id', instanceId)
    .maybeSingle();

  if (fetchErr || !row) return { ok: false, error: 'Instance not found' };
  const r = row as {
    client_user_id?: string;
    trainer_user_id?: string;
    assignment_id?: string;
  };
  if (r.client_user_id !== clientUserId || r.trainer_user_id !== viewerId) {
    return { ok: false, error: 'Instance not found' };
  }

  const { data: asg } = await supabase
    .from('client_coach_assignments')
    .select('revoked_at, dismissed_at')
    .eq('id', r.assignment_id as string)
    .maybeSingle();
  const aPatch = asg as { revoked_at?: string | null; dismissed_at?: string | null } | null;
  if (aPatch?.revoked_at || aPatch?.dismissed_at) {
    return { ok: false, error: 'Assignment is no longer active' };
  }

  const now = new Date().toISOString();
  const { error: updErr } = await supabase
    .from('client_coach_schedule_instances')
    .update({ scheduled_at: new Date(scheduledAt).toISOString(), updated_at: now })
    .eq('id', instanceId);

  if (updErr) {
    if (import.meta.env.DEV) console.warn('[trainer-client-calendar] patch', updErr);
    return { ok: false, error: 'Failed to update schedule' };
  }
  return { ok: true };
}

export async function createCoachScheduleInstance(
  viewerId: string,
  clientUserId: string,
  viewerRole: string,
  assignmentId: string,
  scheduledAt: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const t = Date.parse(scheduledAt);
  if (Number.isNaN(t)) return { ok: false, error: 'Invalid scheduledAt' };

  const allowed = await isUserInViewerRoster(viewerId, viewerRole, clientUserId);
  if (!allowed) return { ok: false, error: 'Client not found or not in your roster' };

  const supabase = getSupabaseServer();
  const { data: asg, error: asgErr } = await supabase
    .from('client_coach_assignments')
    .select('id, trainer_user_id, client_user_id, revoked_at, dismissed_at')
    .eq('id', assignmentId)
    .maybeSingle();

  if (asgErr || !asg) return { ok: false, error: 'Assignment not found' };
  const a = asg as {
    trainer_user_id?: string;
    client_user_id?: string;
    revoked_at?: string | null;
    dismissed_at?: string | null;
  };
  if (a.trainer_user_id !== viewerId || a.client_user_id !== clientUserId) {
    return { ok: false, error: 'Assignment not found' };
  }
  if (a.revoked_at || a.dismissed_at) return { ok: false, error: 'Assignment is not available' };

  const now = new Date().toISOString();
  const { data: inserted, error: insErr } = await supabase
    .from('client_coach_schedule_instances')
    .insert({
      assignment_id: assignmentId,
      client_user_id: clientUserId,
      trainer_user_id: viewerId,
      scheduled_at: new Date(scheduledAt).toISOString(),
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();

  if (insErr || !inserted?.id) {
    if (import.meta.env.DEV) console.warn('[trainer-client-calendar] create', insErr);
    return { ok: false, error: 'Failed to create schedule instance' };
  }
  return { ok: true, id: inserted.id as string };
}
