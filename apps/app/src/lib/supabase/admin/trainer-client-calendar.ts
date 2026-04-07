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
import { getAmrapSessionDisplayTitle } from '@/lib/amrap-preset-name';
import { getSupabaseServer } from '@/lib/supabase/server';
import { isUserInViewerRoster } from '@/lib/supabase/admin/trainer-roster';
import {
  fetchAmrapScheduledSessionsForClientRangeAdmin,
  fetchScheduledWorkoutsForClientRangeAdmin,
  normalizeWorkoutList,
  type AdminAmrapScheduledRow,
  type AdminScheduledWorkoutRow,
} from '@/lib/supabase/admin/trainer-client-calendar-client-originated';

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
      /** Optional link to a shared Live session (group / class). */
      trainerLiveSessionId?: string | null;
      /** UTC calendar date YYYY-MM-DD for grid placement */
      date: string;
    }
  | {
      kind: 'scheduled_workout';
      draggable: false;
      sourceId: string;
      scheduledAt: string;
      date: string;
      title: string;
      sourceApp: string;
    }
  | {
      kind: 'amrap_scheduled';
      draggable: false;
      sourceId: string;
      scheduledAt: string;
      date: string;
      title: string;
      durationMinutes: number;
    };

/** Sort order for Mission Control calendar lists (program → client-originated → coach). */
export function trainerCalendarApiEventKindRank(e: TrainerCalendarApiEvent): number {
  if (e.kind === 'program') return 0;
  if (e.kind === 'scheduled_workout' || e.kind === 'amrap_scheduled') return 1;
  return 2;
}

export function compareTrainerCalendarApiEvents(
  a: TrainerCalendarApiEvent,
  b: TrainerCalendarApiEvent
): number {
  const c = a.date.localeCompare(b.date);
  if (c !== 0) return c;
  const r = trainerCalendarApiEventKindRank(a) - trainerCalendarApiEventKindRank(b);
  if (r !== 0) return r;
  if (a.kind === 'coach_instance' && b.kind === 'coach_instance') {
    return a.scheduledAt.localeCompare(b.scheduledAt);
  }
  if (
    (a.kind === 'scheduled_workout' || a.kind === 'amrap_scheduled') &&
    (b.kind === 'scheduled_workout' || b.kind === 'amrap_scheduled')
  ) {
    return a.scheduledAt.localeCompare(b.scheduledAt);
  }
  if (a.kind === 'program' && b.kind === 'program') {
    return (a.workoutIndex ?? 0) - (b.workoutIndex ?? 0);
  }
  return 0;
}

export async function fetchClientTimezone(clientUserId: string): Promise<string> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', clientUserId)
    .maybeSingle();
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

export async function fetchProgramsForCalendarForClient(
  clientUserId: string
): Promise<ProgramForCalendar[]> {
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

function scheduledWorkoutDisplayTitle(row: AdminScheduledWorkoutRow): string {
  if (row.workout_title && row.workout_title.trim()) return row.workout_title.trim();
  const app = row.source_app;
  if (app === 'tabata') return 'Tabata';
  if (app === 'daily-warmup') return 'Daily Warm-Up';
  if (app === 'universal_activity_hub') return 'Universal Activity';
  return 'Timer';
}

function clientOriginatedEventsFromAdminRows(
  scheduled: AdminScheduledWorkoutRow[],
  amrap: AdminAmrapScheduledRow[]
): TrainerCalendarApiEvent[] {
  const out: TrainerCalendarApiEvent[] = [];
  for (const row of scheduled) {
    const scheduledAt = new Date(row.scheduled_at).toISOString();
    out.push({
      kind: 'scheduled_workout',
      draggable: false,
      sourceId: row.id,
      scheduledAt,
      date: utcDateOnlyFromTimestamptz(scheduledAt),
      title: scheduledWorkoutDisplayTitle(row),
      sourceApp: row.source_app,
    });
  }
  for (const row of amrap) {
    const scheduledAt = new Date(row.scheduled_start_at).toISOString();
    const list = normalizeWorkoutList(row.workout_list);
    out.push({
      kind: 'amrap_scheduled',
      draggable: false,
      sourceId: row.id,
      scheduledAt,
      date: utcDateOnlyFromTimestamptz(scheduledAt),
      title: getAmrapSessionDisplayTitle(null, list),
      durationMinutes: row.duration_minutes,
    });
  }
  return out;
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
    trainerLiveSessionId: string | null;
    title: string;
    assignmentType: string;
  }>
> {
  const supabase = getSupabaseServer();
  const startIso = `${rangeStart}T00:00:00.000Z`;
  const endIso = `${rangeEnd}T23:59:59.999Z`;

  const { data: instRows, error } = await supabase
    .from('client_coach_schedule_instances')
    .select('id, assignment_id, scheduled_at, trainer_live_session_id')
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
    trainerLiveSessionId: string | null;
    title: string;
    assignmentType: string;
  }> = [];

  for (const row of rows) {
    const assignmentId = row.assignment_id as string;
    const a = asgMap.get(assignmentId);
    if (!a || a.revoked_at || a.dismissed_at) continue;

    const scheduledAt = row.scheduled_at as string;
    const tls = (row as { trainer_live_session_id?: string | null }).trainer_live_session_id;
    out.push({
      id: row.id as string,
      assignmentId,
      scheduledAt,
      trainerLiveSessionId: tls != null && String(tls).length > 0 ? String(tls) : null,
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
): Promise<{
  /** Client's `profiles.timezone` (IANA). Used for "their local time" badges in Mission Control. */
  timezone: string;
  /** Coach/viewer's `profiles.timezone` (IANA). Used for scheduling in the trainer's local wall time. */
  viewerTimezone: string;
  events: TrainerCalendarApiEvent[];
} | null> {
  const allowed = await isUserInViewerRoster(viewerId, viewerRole, clientUserId);
  if (!allowed) return null;

  const [timezone, viewerTimezone] = await Promise.all([
    fetchClientTimezone(clientUserId),
    fetchClientTimezone(viewerId),
  ]);
  const [programs, loggedMap, instances, scheduledRows, amrapRows] = await Promise.all([
    fetchProgramsForCalendarForClient(clientUserId),
    fetchLoggedMapForCalendarRange(clientUserId, from, to),
    fetchCoachScheduleInstancesForRange(clientUserId, from, to),
    fetchScheduledWorkoutsForClientRangeAdmin(clientUserId, from, to),
    fetchAmrapScheduledSessionsForClientRangeAdmin(clientUserId, from, to),
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
      trainerLiveSessionId: inst.trainerLiveSessionId,
      date: utcDateOnlyFromTimestamptz(inst.scheduledAt),
    });
  }

  events.push(...clientOriginatedEventsFromAdminRows(scheduledRows, amrapRows));

  events.sort(compareTrainerCalendarApiEvents);

  return { timezone, viewerTimezone, events };
}

/** Default coach instance slot width for overlap detection (instances store `scheduled_at` only). */
export const COACH_SCHEDULE_CONFLICT_SLOT_MINUTES = 60;

export type CoachScheduleConflictItem =
  | {
      severity: 'hard';
      startAt: string;
      endAt: string;
      summary: string;
      source: 'coach_instance';
      sourceId: string;
      clientUserId: string;
    }
  | {
      severity: 'hard';
      startAt: string;
      endAt: string;
      summary: string;
      source: 'live_session';
      sourceId: string;
      /** Not applicable for Live rows; empty string for API shape compatibility. */
      clientUserId: '';
    }
  | {
      severity: 'hard';
      startAt: string;
      endAt: string;
      summary: string;
      source: 'scheduled_live_occurrence';
      sourceId: string;
      clientUserId: '';
    };

export type CoachScheduleMutationOptions = {
  preflight?: boolean;
  allowOverlap?: boolean;
  /** Optional Live session link for create / conflict proposal. */
  trainerLiveSessionId?: string | null;
};

export type FindCoachScheduleConflictsOptions = {
  excludeInstanceId?: string;
  proposalTrainerLiveSessionId?: string | null;
  /** When set, use this instant as the proposal end (e.g. scheduled live window); else default coach slot width. */
  proposedEndAtIso?: string;
  /** When rescheduling an existing planned occurrence, exclude it from overlap checks. */
  excludeScheduledOccurrenceId?: string;
};

/** Half-open interval overlap: [aStart,aEnd) vs [bStart,bEnd) in epoch ms. */
export function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/** When both rows reference the same Live session, coach-vs-coach overlap is not a conflict. */
export function shouldSuppressCoachConflictForSharedLiveSession(
  proposalTrainerLiveSessionId: string | null | undefined,
  existingInstanceLiveSessionId: string | null | undefined
): boolean {
  return (
    proposalTrainerLiveSessionId != null &&
    proposalTrainerLiveSessionId !== '' &&
    existingInstanceLiveSessionId != null &&
    existingInstanceLiveSessionId !== '' &&
    proposalTrainerLiveSessionId === existingInstanceLiveSessionId
  );
}

function coachSlotMs(): number {
  return COACH_SCHEDULE_CONFLICT_SLOT_MINUTES * 60 * 1000;
}

function logAllowOverlapWrite(meta: {
  viewerId: string;
  clientUserId: string;
  instanceId?: string;
  conflictCount: number;
}): void {
  if (!import.meta.env.DEV && import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING !== 'true') return;
  console.warn('[trainer-client-calendar] allowOverlap write', meta);
}

async function fetchTrainerCoachInstancesForConflictScan(
  trainerUserId: string,
  proposedStartMs: number,
  proposedEndMs: number,
  excludeInstanceId?: string
): Promise<
  Array<{
    id: string;
    client_user_id: string;
    scheduled_at: string;
    assignment_id: string;
    trainer_live_session_id: string | null;
  }>
> {
  const pad = coachSlotMs();
  const lo = new Date(proposedStartMs - pad).toISOString();
  const hi = new Date(proposedEndMs + pad).toISOString();

  const supabase = getSupabaseServer();
  let q = supabase
    .from('client_coach_schedule_instances')
    .select('id, client_user_id, scheduled_at, assignment_id, trainer_live_session_id')
    .eq('trainer_user_id', trainerUserId)
    .gte('scheduled_at', lo)
    .lte('scheduled_at', hi);

  const { data: instRows, error } = await q;
  if (error) {
    if (import.meta.env.DEV) console.warn('[trainer-client-calendar] conflict scan', error);
    return [];
  }

  const rows = (instRows ?? []) as Array<{
    id: string;
    client_user_id: string;
    scheduled_at: string;
    assignment_id: string;
    trainer_live_session_id?: string | null;
  }>;
  return rows
    .filter((r) => r.id !== excludeInstanceId)
    .map((r) => ({
      ...r,
      trainer_live_session_id:
        r.trainer_live_session_id != null && String(r.trainer_live_session_id).length > 0
          ? String(r.trainer_live_session_id)
          : null,
    }));
}

async function fetchScheduledLiveOccurrencesForConflictOverlap(
  trainerUserId: string,
  proposedStartMs: number,
  proposedEndMs: number
): Promise<Array<{ id: string; scheduled_start_at: string; scheduled_end_at: string }>> {
  const pad = 24 * 60 * 60 * 1000;
  const lo = new Date(proposedStartMs - pad).toISOString();
  const hi = new Date(proposedEndMs + pad).toISOString();
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('trainer_live_session_occurrences')
    .select('id, scheduled_start_at, scheduled_end_at')
    .eq('trainer_user_id', trainerUserId)
    .eq('status', 'scheduled')
    .gte('scheduled_end_at', lo)
    .lte('scheduled_start_at', hi);

  if (error) {
    if (import.meta.env.DEV) console.warn('[trainer-client-calendar] scheduled live conflict scan', error);
    return [];
  }
  return (data ?? []) as Array<{
    id: string;
    scheduled_start_at: string;
    scheduled_end_at: string;
  }>;
}

async function fetchTrainerLiveSessionsForConflictOverlap(
  trainerUserId: string,
  proposedStartMs: number,
  proposedEndMs: number
): Promise<Array<{ id: string; created_at: string; ended_at: string | null; shell: string | null }>> {
  const pad = coachSlotMs();
  const lo = new Date(proposedStartMs - pad).toISOString();
  const hi = new Date(proposedEndMs + pad).toISOString();
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('trainer_live_sessions')
    .select('id, created_at, ended_at, shell')
    .eq('trainer_user_id', trainerUserId)
    .gte('created_at', lo)
    .lte('created_at', hi);

  if (error) {
    if (import.meta.env.DEV) console.warn('[trainer-client-calendar] live conflict scan', error);
    return [];
  }
  return (data ?? []) as Array<{
    id: string;
    created_at: string;
    ended_at: string | null;
    shell: string | null;
  }>;
}

export async function validateTrainerLiveSessionForCoachLink(
  viewerId: string,
  clientUserId: string,
  sessionId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseServer();
  const { data: sess, error } = await supabase
    .from('trainer_live_sessions')
    .select('id, trainer_user_id, invited_client_user_id')
    .eq('id', sessionId)
    .maybeSingle();

  if (error || !sess) return { ok: false, error: 'Live session not found' };
  const s = sess as {
    trainer_user_id?: string;
    invited_client_user_id?: string | null;
  };
  if (s.trainer_user_id !== viewerId) return { ok: false, error: 'Live session not found' };

  if (s.invited_client_user_id === clientUserId) return { ok: true };

  const { data: part } = await supabase
    .from('trainer_live_participants')
    .select('id')
    .eq('session_id', sessionId)
    .eq('user_id', clientUserId)
    .eq('role', 'client')
    .maybeSingle();

  if (part) return { ok: true };
  return { ok: false, error: 'Client is not linked to this Live session' };
}

export async function findCoachScheduleConflictsForTrainer(
  trainerUserId: string,
  proposedScheduledAtIso: string,
  options?: FindCoachScheduleConflictsOptions
): Promise<CoachScheduleConflictItem[]> {
  const excludeInstanceId = options?.excludeInstanceId;
  const proposalTrainerLiveSessionId = options?.proposalTrainerLiveSessionId ?? null;

  const proposedStartMs = Date.parse(proposedScheduledAtIso);
  if (!Number.isFinite(proposedStartMs)) return [];
  const proposedEndMs =
    options?.proposedEndAtIso && Number.isFinite(Date.parse(options.proposedEndAtIso))
      ? Date.parse(options.proposedEndAtIso)
      : proposedStartMs + coachSlotMs();
  const slot = coachSlotMs();
  const excludeScheduledOccurrenceId = options?.excludeScheduledOccurrenceId?.trim();

  const raw = await fetchTrainerCoachInstancesForConflictScan(
    trainerUserId,
    proposedStartMs,
    proposedEndMs,
    excludeInstanceId
  );

  const assignmentIds = [...new Set(raw.map((r) => r.assignment_id).filter(Boolean))];
  const supabase = getSupabaseServer();
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

  const conflicts: CoachScheduleConflictItem[] = [];
  for (const row of raw) {
    const s = Date.parse(row.scheduled_at);
    if (!Number.isFinite(s)) continue;
    const e = s + slot;
    if (!intervalsOverlap(proposedStartMs, proposedEndMs, s, e)) continue;

    if (
      shouldSuppressCoachConflictForSharedLiveSession(
        proposalTrainerLiveSessionId,
        row.trainer_live_session_id
      )
    ) {
      continue;
    }

    const a = asgMap.get(row.assignment_id);
    if (!a || a.revoked_at || a.dismissed_at) continue;

    const title =
      typeof a.title_snapshot === 'string' && a.title_snapshot.trim()
        ? a.title_snapshot.trim()
        : 'Coach item';

    conflicts.push({
      severity: 'hard',
      startAt: new Date(s).toISOString(),
      endAt: new Date(e).toISOString(),
      summary: title,
      source: 'coach_instance',
      sourceId: row.id,
      clientUserId: row.client_user_id,
    });
  }

  const liveRows = await fetchTrainerLiveSessionsForConflictOverlap(
    trainerUserId,
    proposedStartMs,
    proposedEndMs
  );
  for (const sess of liveRows) {
    const s = Date.parse(sess.created_at);
    if (!Number.isFinite(s)) continue;
    const e = sess.ended_at ? Date.parse(sess.ended_at) : s + slot;
    if (!Number.isFinite(e)) continue;
    if (!intervalsOverlap(proposedStartMs, proposedEndMs, s, e)) continue;
    if (proposalTrainerLiveSessionId && sess.id === proposalTrainerLiveSessionId) continue;

    const shell = typeof sess.shell === 'string' && sess.shell.trim() ? sess.shell.trim() : 'live';
    conflicts.push({
      severity: 'hard',
      startAt: new Date(s).toISOString(),
      endAt: new Date(e).toISOString(),
      summary: `Live session (${shell})`,
      source: 'live_session',
      sourceId: sess.id,
      clientUserId: '',
    });
  }

  const schedRows = await fetchScheduledLiveOccurrencesForConflictOverlap(
    trainerUserId,
    proposedStartMs,
    proposedEndMs
  );
  for (const row of schedRows) {
    if (excludeScheduledOccurrenceId && row.id === excludeScheduledOccurrenceId) continue;
    const s = Date.parse(row.scheduled_start_at);
    const e = Date.parse(row.scheduled_end_at);
    if (!Number.isFinite(s) || !Number.isFinite(e)) continue;
    if (!intervalsOverlap(proposedStartMs, proposedEndMs, s, e)) continue;
    conflicts.push({
      severity: 'hard',
      startAt: new Date(s).toISOString(),
      endAt: new Date(e).toISOString(),
      summary: 'Scheduled live',
      source: 'scheduled_live_occurrence',
      sourceId: row.id,
      clientUserId: '',
    });
  }

  conflicts.sort((x, y) => x.startAt.localeCompare(y.startAt) || x.sourceId.localeCompare(y.sourceId));
  return conflicts;
}

export type PatchCoachScheduleInstanceInput = {
  scheduledAt?: string;
  assignmentId?: string;
  /** Set, clear (null), or omit to leave unchanged. */
  trainerLiveSessionId?: string | null;
};

export type PatchCoachScheduleInstanceResult =
  | { ok: true }
  | { ok: true; preflight: true; conflicts: CoachScheduleConflictItem[] }
  | { ok: false; error: string }
  | { ok: false; error: 'Scheduling conflict'; conflicts: CoachScheduleConflictItem[] };

export async function patchCoachScheduleInstance(
  viewerId: string,
  clientUserId: string,
  viewerRole: string,
  instanceId: string,
  patch: PatchCoachScheduleInstanceInput,
  options?: CoachScheduleMutationOptions
): Promise<PatchCoachScheduleInstanceResult> {
  const scheduledRaw =
    typeof patch.scheduledAt === 'string' ? patch.scheduledAt.trim() : '';
  const assignmentRaw =
    typeof patch.assignmentId === 'string' ? patch.assignmentId.trim() : '';
  const hasLivePatch = 'trainerLiveSessionId' in patch;
  const preflight = options?.preflight === true;
  const allowOverlap = options?.allowOverlap === true;

  const hasTime = scheduledRaw.length > 0;
  const hasAssignment = assignmentRaw.length > 0;
  if (!hasTime && !hasAssignment && !hasLivePatch) {
    return { ok: false, error: 'scheduledAt, assignmentId, or trainerLiveSessionId required' };
  }
  if (hasTime && Number.isNaN(Date.parse(scheduledRaw))) {
    return { ok: false, error: 'Invalid scheduledAt' };
  }

  const allowed = await isUserInViewerRoster(viewerId, viewerRole, clientUserId);
  if (!allowed) return { ok: false, error: 'Client not found or not in your roster' };

  const supabase = getSupabaseServer();
  const { data: row, error: fetchErr } = await supabase
    .from('client_coach_schedule_instances')
    .select('id, client_user_id, trainer_user_id, assignment_id, trainer_live_session_id')
    .eq('id', instanceId)
    .maybeSingle();

  if (fetchErr || !row) return { ok: false, error: 'Instance not found' };
  const r = row as {
    client_user_id?: string;
    trainer_user_id?: string;
    assignment_id?: string;
    trainer_live_session_id?: string | null;
  };
  if (r.client_user_id !== clientUserId || r.trainer_user_id !== viewerId) {
    return { ok: false, error: 'Instance not found' };
  }

  const currentAssignmentId = r.assignment_id as string;

  if (hasAssignment && assignmentRaw !== currentAssignmentId) {
    const { data: newAsg, error: newErr } = await supabase
      .from('client_coach_assignments')
      .select('id, trainer_user_id, client_user_id, revoked_at, dismissed_at')
      .eq('id', assignmentRaw)
      .maybeSingle();
    if (newErr || !newAsg) return { ok: false, error: 'Assignment not found' };
    const na = newAsg as {
      trainer_user_id?: string;
      client_user_id?: string;
      revoked_at?: string | null;
      dismissed_at?: string | null;
    };
    if (na.trainer_user_id !== viewerId || na.client_user_id !== clientUserId) {
      return { ok: false, error: 'Assignment not found' };
    }
    if (na.revoked_at || na.dismissed_at) {
      return { ok: false, error: 'Assignment is not available' };
    }
  } else if (hasTime) {
    const { data: asg } = await supabase
      .from('client_coach_assignments')
      .select('revoked_at, dismissed_at')
      .eq('id', currentAssignmentId)
      .maybeSingle();
    const aCur = asg as { revoked_at?: string | null; dismissed_at?: string | null } | null;
    if (aCur?.revoked_at || aCur?.dismissed_at) {
      return { ok: false, error: 'Assignment is no longer active' };
    }
  }

  const proposedScheduledIso = hasTime ? new Date(scheduledRaw).toISOString() : '';

  if (hasLivePatch) {
    const rawLive = patch.trainerLiveSessionId;
    if (rawLive != null && String(rawLive).trim() !== '') {
      const v = await validateTrainerLiveSessionForCoachLink(
        viewerId,
        clientUserId,
        String(rawLive).trim()
      );
      if (!v.ok) return v;
    }
  }

  const proposalLiveAfterPatch = hasLivePatch
    ? patch.trainerLiveSessionId != null && String(patch.trainerLiveSessionId).trim() !== ''
      ? String(patch.trainerLiveSessionId).trim()
      : null
    : r.trainer_live_session_id != null && String(r.trainer_live_session_id).length > 0
      ? String(r.trainer_live_session_id)
      : null;

  if (hasTime) {
    const conflicts = await findCoachScheduleConflictsForTrainer(viewerId, proposedScheduledIso, {
      excludeInstanceId: instanceId,
      proposalTrainerLiveSessionId: proposalLiveAfterPatch,
    });
    if (preflight) {
      return { ok: true, preflight: true, conflicts };
    }
    if (conflicts.length > 0 && !allowOverlap) {
      return { ok: false, error: 'Scheduling conflict', conflicts };
    }
    if (conflicts.length > 0 && allowOverlap) {
      logAllowOverlapWrite({
        viewerId,
        clientUserId,
        instanceId,
        conflictCount: conflicts.length,
      });
    }
  } else if (preflight) {
    return { ok: true, preflight: true, conflicts: [] };
  }

  const now = new Date().toISOString();
  const updatePayload: {
    scheduled_at?: string;
    assignment_id?: string;
    trainer_live_session_id?: string | null;
    updated_at: string;
  } = {
    updated_at: now,
  };
  if (hasTime) updatePayload.scheduled_at = proposedScheduledIso;
  if (hasAssignment) updatePayload.assignment_id = assignmentRaw;
  if (hasLivePatch) {
    updatePayload.trainer_live_session_id =
      patch.trainerLiveSessionId != null && String(patch.trainerLiveSessionId).trim() !== ''
        ? String(patch.trainerLiveSessionId).trim()
        : null;
  }

  const { error: updErr } = await supabase
    .from('client_coach_schedule_instances')
    .update(updatePayload)
    .eq('id', instanceId);

  if (updErr) {
    if (import.meta.env.DEV) console.warn('[trainer-client-calendar] patch', updErr);
    return { ok: false, error: 'Failed to update schedule' };
  }
  return { ok: true };
}

export async function deleteCoachScheduleInstance(
  viewerId: string,
  clientUserId: string,
  viewerRole: string,
  instanceId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const allowed = await isUserInViewerRoster(viewerId, viewerRole, clientUserId);
  if (!allowed) return { ok: false, error: 'Client not found or not in your roster' };

  const supabase = getSupabaseServer();
  const { data: row, error: fetchErr } = await supabase
    .from('client_coach_schedule_instances')
    .select('id, client_user_id, trainer_user_id')
    .eq('id', instanceId)
    .maybeSingle();

  if (fetchErr || !row) return { ok: false, error: 'Instance not found' };
  const r = row as { client_user_id?: string; trainer_user_id?: string };
  if (r.client_user_id !== clientUserId || r.trainer_user_id !== viewerId) {
    return { ok: false, error: 'Instance not found' };
  }

  const { error: delErr } = await supabase
    .from('client_coach_schedule_instances')
    .delete()
    .eq('id', instanceId);

  if (delErr) {
    if (import.meta.env.DEV) console.warn('[trainer-client-calendar] delete', delErr);
    return { ok: false, error: 'Failed to delete schedule instance' };
  }
  return { ok: true };
}

export type CreateCoachScheduleInstanceResult =
  | { ok: true; id: string }
  | { ok: true; preflight: true; conflicts: CoachScheduleConflictItem[] }
  | { ok: false; error: string }
  | { ok: false; error: 'Scheduling conflict'; conflicts: CoachScheduleConflictItem[] };

export async function createCoachScheduleInstance(
  viewerId: string,
  clientUserId: string,
  viewerRole: string,
  assignmentId: string,
  scheduledAt: string,
  options?: CoachScheduleMutationOptions
): Promise<CreateCoachScheduleInstanceResult> {
  const preflight = options?.preflight === true;
  const allowOverlap = options?.allowOverlap === true;

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

  let liveSessionId: string | null = null;
  const optLive = options?.trainerLiveSessionId;
  if (optLive != null && String(optLive).trim() !== '') {
    const sid = String(optLive).trim();
    const v = await validateTrainerLiveSessionForCoachLink(viewerId, clientUserId, sid);
    if (!v.ok) return { ok: false, error: v.error };
    liveSessionId = sid;
  }

  const scheduledIso = new Date(scheduledAt).toISOString();
  const conflicts = await findCoachScheduleConflictsForTrainer(viewerId, scheduledIso, {
    proposalTrainerLiveSessionId: liveSessionId,
  });

  if (preflight) {
    return { ok: true, preflight: true, conflicts };
  }
  if (conflicts.length > 0 && !allowOverlap) {
    return { ok: false, error: 'Scheduling conflict', conflicts };
  }
  if (conflicts.length > 0 && allowOverlap) {
    logAllowOverlapWrite({
      viewerId,
      clientUserId,
      conflictCount: conflicts.length,
    });
  }

  const now = new Date().toISOString();
  const { data: inserted, error: insErr } = await supabase
    .from('client_coach_schedule_instances')
    .insert({
      assignment_id: assignmentId,
      client_user_id: clientUserId,
      trainer_user_id: viewerId,
      scheduled_at: scheduledIso,
      trainer_live_session_id: liveSessionId,
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
