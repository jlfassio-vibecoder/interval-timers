/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Scheduled live session occurrences + invites (Mission Control + unified calendar).
 * P0: single occurrence; P1: series + prospects via roster_invitation_id.
 */

import { getSupabaseServer } from '@/lib/supabase/server';
import { isUserInViewerRoster } from '@/lib/supabase/admin/trainer-roster';
import {
  createRosterInvite,
  normalizeInviteEmail,
  getStudioSlugForInviter,
  buildRosterInviteAcceptUrl,
} from '@/lib/supabase/admin/roster-invitations';
import { trySendRosterInviteEmail } from '@/lib/supabase/admin/roster-invite-delivery';
import {
  expandWeeklyOccurrenceSlots,
  seriesMetaFromFirstSlot,
} from '@/lib/live-schedule-series-expand';
import {
  findCoachScheduleConflictsForTrainer,
  type CoachScheduleConflictItem,
} from '@/lib/supabase/admin/trainer-client-calendar';

export type UnifiedScheduledLiveOccurrenceItem = {
  kind: 'scheduled_live_occurrence';
  occurrenceId: string;
  seriesId: string | null;
  recurrenceSummary: string | null;
  /** Nullable override for calendar card title; default label see `scheduled-live-card-title.ts`. */
  displayName: string | null;
  scheduledStartAt: string;
  scheduledEndAt: string;
  status: string;
  liveSessionId: string | null;
  pendingCount: number;
  acceptedCount: number;
  waitlistedCount: number;
  declinedCount: number;
  inviteSummaries: Array<{
    inviteId: string;
    userId: string;
    label: string;
    status: string;
    createdAt?: string;
  }>;
};

export type LiveScheduleConflictFailure = {
  ok: false;
  error: string;
  conflicts: CoachScheduleConflictItem[];
};

function profileLabel(p: {
  full_name?: string | null;
  email?: string | null;
  username?: string | null;
  id: string;
}): string {
  const fn = p.full_name?.trim();
  if (fn) return fn;
  const em = p.email?.trim();
  if (em) return em;
  const un = p.username?.trim();
  if (un) return un;
  return p.id;
}

function recurrenceSummaryFromSeries(
  row: {
    frequency?: string | null;
    interval_weeks?: number | null;
    weekday?: number | null;
  } | null
): string | null {
  if (!row || row.frequency !== 'weekly') return null;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const wd = typeof row.weekday === 'number' ? days[row.weekday] ?? '' : '';
  const iv = row.interval_weeks && row.interval_weeks > 1 ? ` every ${row.interval_weeks} wks` : '';
  return wd ? `Weekly · ${wd}${iv}` : 'Weekly';
}

/**
 * Overlap with inclusive calendar date range [from, to] (YYYY-MM-DD) interpreted in UTC day bounds.
 */
export async function fetchScheduledLiveOccurrencesForTrainer(
  trainerUserId: string,
  from: string,
  to: string
): Promise<UnifiedScheduledLiveOccurrenceItem[]> {
  const supabase = getSupabaseServer();
  const startIso = `${from}T00:00:00.000Z`;
  const endIso = `${to}T23:59:59.999Z`;

  const { data: occs, error: occErr } = await supabase
    .from('trainer_live_session_occurrences')
    .select(
      `
      id,
      display_name,
      scheduled_start_at,
      scheduled_end_at,
      status,
      live_session_id,
      series_id,
      series:trainer_live_session_series (
        id,
        frequency,
        interval_weeks,
        weekday,
        iana_timezone,
        duration_minutes,
        status
      )
    `
    )
    .eq('trainer_user_id', trainerUserId)
    .neq('status', 'cancelled')
    .gte('scheduled_end_at', startIso)
    .lte('scheduled_start_at', endIso)
    .order('scheduled_start_at', { ascending: true });

  if (occErr) {
    if (import.meta.env.DEV) console.warn('[trainer-live-scheduled] occurrences', occErr);
    return [];
  }

  const list = occs ?? [];
  if (list.length === 0) return [];

  const occIds = list.map((o) => o.id as string);
  const { data: invRows, error: invErr } = await supabase
    .from('trainer_live_session_invites')
    .select('id, occurrence_id, invitee_user_id, status, roster_invitation_id, created_at')
    .in('occurrence_id', occIds);

  if (invErr) {
    if (import.meta.env.DEV) console.warn('[trainer-live-scheduled] invites', invErr);
    return [];
  }

  const inviteeIds = [
    ...new Set(
      (invRows ?? [])
        .map((r) => r.invitee_user_id as string | null)
        .filter((x): x is string => typeof x === 'string' && x.length > 0)
    ),
  ];
  let labelById = new Map<string, string>();
  if (inviteeIds.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, full_name, username, email')
      .in('id', inviteeIds);
    labelById = new Map(
      (profs ?? []).map((p) => [p.id as string, profileLabel(p as never)])
    );
  }

  const rosterIds = [
    ...new Set(
      (invRows ?? [])
        .map((r) => r.roster_invitation_id as string | null)
        .filter((x): x is string => typeof x === 'string' && x.length > 0)
    ),
  ];
  let emailByRosterId = new Map<string, string>();
  if (rosterIds.length > 0) {
    const { data: rrows } = await supabase
      .from('roster_invitations')
      .select('id, invitee_email')
      .in('id', rosterIds);
    emailByRosterId = new Map(
      (rrows ?? []).map((r) => [r.id as string, String(r.invitee_email ?? 'Invite pending')])
    );
  }

  const invitesByOcc = new Map<string, typeof invRows>();
  for (const row of invRows ?? []) {
    const oid = row.occurrence_id as string;
    const cur = invitesByOcc.get(oid) ?? [];
    cur.push(row);
    invitesByOcc.set(oid, cur);
  }

  const items: UnifiedScheduledLiveOccurrenceItem[] = [];
  for (const o of list) {
    const oid = o.id as string;
    const serObj =
      o.series &&
      typeof o.series === 'object' &&
      !Array.isArray(o.series)
        ? (o.series as Record<string, unknown>)
        : Array.isArray(o.series) && (o.series as unknown[])[0]
          ? ((o.series as unknown[])[0] as Record<string, unknown>)
          : null;
    const seriesId =
      typeof o.series_id === 'string'
        ? o.series_id
        : serObj && typeof serObj.id === 'string'
          ? serObj.id
          : null;
    const recurrenceSummary = recurrenceSummaryFromSeries(serObj);
    const invs = (invitesByOcc.get(oid) ?? []).slice().sort((a, b) => {
      const sa = a.status as string;
      const sb = b.status as string;
      if (sa === 'waitlisted' && sb !== 'waitlisted') return -1;
      if (sb === 'waitlisted' && sa !== 'waitlisted') return 1;
      if (sa === 'waitlisted' && sb === 'waitlisted') {
        const ta = new Date((a.created_at as string) ?? 0).getTime();
        const tb = new Date((b.created_at as string) ?? 0).getTime();
        return ta - tb;
      }
      return 0;
    });
    let pendingCount = 0;
    let acceptedCount = 0;
    let waitlistedCount = 0;
    let declinedCount = 0;
    const inviteSummaries: UnifiedScheduledLiveOccurrenceItem['inviteSummaries'] = [];
    for (const inv of invs) {
      const st = inv.status as string;
      if (st === 'pending') pendingCount++;
      else if (st === 'accepted') acceptedCount++;
      else if (st === 'waitlisted') waitlistedCount++;
      else if (st === 'declined') declinedCount++;
      const uid = inv.invitee_user_id as string | null;
      const rid = inv.roster_invitation_id as string | null;
      const label =
        uid && labelById.has(uid)
          ? labelById.get(uid)!
          : rid
            ? (emailByRosterId.get(rid) ?? 'Prospect (roster pending)')
            : 'Unknown';
      inviteSummaries.push({
        inviteId: inv.id as string,
        userId: uid ?? '',
        label,
        status: st,
        createdAt: (inv.created_at as string) ?? undefined,
      });
    }
    items.push({
      kind: 'scheduled_live_occurrence',
      occurrenceId: oid,
      seriesId,
      recurrenceSummary,
      displayName: (() => {
        const v = (o as { display_name?: string | null }).display_name;
        if (v == null || typeof v !== 'string') return null;
        const t = v.trim();
        return t.length > 0 ? t : null;
      })(),
      scheduledStartAt: o.scheduled_start_at as string,
      scheduledEndAt: o.scheduled_end_at as string,
      status: o.status as string,
      liveSessionId: (o.live_session_id as string | null) ?? null,
      pendingCount,
      acceptedCount,
      waitlistedCount,
      declinedCount,
      inviteSummaries,
    });
  }

  return items;
}

async function deleteRosterInvitationsByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = getSupabaseServer();
  await supabase.from('roster_invitations').delete().in('id', ids);
}

export async function createLiveScheduleOccurrence(
  viewerId: string,
  viewerRole: string,
  input: {
    scheduledStartAt: string;
    scheduledEndAt: string;
    inviteeUserIds: string[];
    prospectEmails?: string[];
    prospectProgramIds?: string[];
    ianaTimezone?: string;
    publicAppBaseHint?: string | null;
    allowOverlap?: boolean;
  }
): Promise<
  { ok: true; occurrenceId: string } | { ok: false; error: string } | LiveScheduleConflictFailure
> {
  const start = input.scheduledStartAt?.trim();
  const end = input.scheduledEndAt?.trim();
  if (!start || !end) {
    return { ok: false, error: 'scheduledStartAt and scheduledEndAt required' };
  }
  if (Date.parse(end) <= Date.parse(start)) {
    return { ok: false, error: 'scheduledEndAt must be after scheduledStartAt' };
  }

  const rawIds = [...new Set(input.inviteeUserIds.filter((x) => typeof x === 'string' && x.trim()))];
  const prospectEmails = [
    ...new Set(
      (input.prospectEmails ?? [])
        .map((e) => normalizeInviteEmail(String(e)))
        .filter((e) => e.length > 0)
    ),
  ];

  if (rawIds.length === 0 && prospectEmails.length === 0) {
    return { ok: false, error: 'At least one inviteeUserId or prospect email required' };
  }

  if (prospectEmails.length > 0) {
    const pids = input.prospectProgramIds ?? [];
    if (!Array.isArray(pids) || pids.length === 0) {
      return { ok: false, error: 'prospectProgramIds required when inviting prospects' };
    }
  }

  for (const uid of rawIds) {
    const allowed = await isUserInViewerRoster(viewerId, viewerRole, uid);
    if (!allowed) {
      return { ok: false, error: `Client not on roster: ${uid}` };
    }
  }

  if (!input.allowOverlap) {
    const conflicts = await findCoachScheduleConflictsForTrainer(viewerId, start, {
      proposedEndAtIso: end,
    });
    if (conflicts.length > 0) {
      return {
        ok: false,
        error: 'Scheduling conflict',
        conflicts,
      };
    }
  }

  const supabase = getSupabaseServer();
  const createdRosterIds: string[] = [];
  const rosterTokens: Array<{ id: string; rawToken: string; email: string }> = [];

  try {
    for (const email of prospectEmails) {
      const r = await createRosterInvite({
        inviterId: viewerId,
        inviterRole: viewerRole === 'host' ? 'host' : 'trainer',
        channel: 'email',
        email,
        programIds: input.prospectProgramIds ?? [],
        publicAppBaseHint: input.publicAppBaseHint ?? undefined,
      });
      if (!r.ok) {
        await deleteRosterInvitationsByIds(createdRosterIds);
        return { ok: false, error: r.message };
      }
      createdRosterIds.push(r.invitationId);
      rosterTokens.push({ id: r.invitationId, rawToken: r.rawToken, email });
    }

    const { data: occ, error: occErr } = await supabase
      .from('trainer_live_session_occurrences')
      .insert({
        trainer_user_id: viewerId,
        scheduled_start_at: start,
        scheduled_end_at: end,
        status: 'scheduled',
      })
      .select('id')
      .single();

    if (occErr || !occ?.id) {
      await deleteRosterInvitationsByIds(createdRosterIds);
      if (import.meta.env.DEV) console.warn('[createLiveScheduleOccurrence] insert occ', occErr);
      return { ok: false, error: occErr?.message ?? 'Failed to create occurrence' };
    }

    const occurrenceId = occ.id as string;

    const userInviteRows = rawIds.map((invitee_user_id) => ({
      occurrence_id: occurrenceId,
      invitee_user_id,
      status: 'pending' as const,
    }));
    const prospectRows = createdRosterIds.map((roster_invitation_id) => ({
      occurrence_id: occurrenceId,
      invitee_user_id: null as string | null,
      roster_invitation_id,
      status: 'pending' as const,
    }));
    const { error: invErr } = await supabase
      .from('trainer_live_session_invites')
      .insert([...userInviteRows, ...prospectRows]);

    if (invErr) {
      if (import.meta.env.DEV) console.warn('[createLiveScheduleOccurrence] insert invites', invErr);
      await supabase.from('trainer_live_session_occurrences').delete().eq('id', occurrenceId);
      await deleteRosterInvitationsByIds(createdRosterIds);
      return { ok: false, error: invErr.message ?? 'Failed to create invites' };
    }

    const studioSlug = await getStudioSlugForInviter(viewerId);
    for (const rt of rosterTokens) {
      const { data: li } = await supabase
        .from('trainer_live_session_invites')
        .select('id')
        .eq('occurrence_id', occurrenceId)
        .eq('roster_invitation_id', rt.id)
        .maybeSingle();
      const focus = typeof li?.id === 'string' ? li.id : undefined;
      const baseUrl = buildRosterInviteAcceptUrl(
        rt.rawToken,
        studioSlug,
        input.publicAppBaseHint ?? undefined,
        focus ? { focusLiveInvite: focus } : undefined
      );
      await trySendRosterInviteEmail(rt.rawToken, rt.email, baseUrl);
    }

    return { ok: true, occurrenceId };
  } catch (e) {
    await deleteRosterInvitationsByIds(createdRosterIds);
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to create occurrence' };
  }
}

export async function createLiveScheduleSeries(
  viewerId: string,
  viewerRole: string,
  input: {
    scheduledStartAt: string;
    scheduledEndAt: string;
    ianaTimezone: string;
    horizonWeeks?: number;
    inviteeUserIds: string[];
    prospectEmails?: string[];
    prospectProgramIds?: string[];
    publicAppBaseHint?: string | null;
    allowOverlap?: boolean;
  }
): Promise<
  { ok: true; seriesId: string; occurrenceIds: string[] } | { ok: false; error: string } | LiveScheduleConflictFailure
> {
  const start = input.scheduledStartAt?.trim();
  const end = input.scheduledEndAt?.trim();
  const zone = input.ianaTimezone?.trim();
  if (!start || !end || !zone) {
    return { ok: false, error: 'scheduledStartAt, scheduledEndAt, and ianaTimezone required' };
  }
  if (Date.parse(end) <= Date.parse(start)) {
    return { ok: false, error: 'scheduledEndAt must be after scheduledStartAt' };
  }

  let meta: ReturnType<typeof seriesMetaFromFirstSlot>;
  try {
    meta = seriesMetaFromFirstSlot(start, end, zone);
  } catch {
    return { ok: false, error: 'Invalid schedule window' };
  }

  const rawIds = [...new Set(input.inviteeUserIds.filter((x) => typeof x === 'string' && x.trim()))];
  const prospectEmails = [
    ...new Set(
      (input.prospectEmails ?? [])
        .map((e) => normalizeInviteEmail(String(e)))
        .filter((e) => e.length > 0)
    ),
  ];

  if (rawIds.length === 0 && prospectEmails.length === 0) {
    return { ok: false, error: 'At least one inviteeUserId or prospect email required' };
  }

  if (prospectEmails.length > 0) {
    const pids = input.prospectProgramIds ?? [];
    if (!Array.isArray(pids) || pids.length === 0) {
      return { ok: false, error: 'prospectProgramIds required when inviting prospects' };
    }
  }

  for (const uid of rawIds) {
    const allowed = await isUserInViewerRoster(viewerId, viewerRole, uid);
    if (!allowed) {
      return { ok: false, error: `Client not on roster: ${uid}` };
    }
  }

  const horizon = input.horizonWeeks ?? 12;
  let slots: ReturnType<typeof expandWeeklyOccurrenceSlots>;
  try {
    slots = expandWeeklyOccurrenceSlots(start, end, zone, horizon);
  } catch {
    return { ok: false, error: 'Failed to expand series' };
  }

  if (!input.allowOverlap) {
    for (const slot of slots) {
      const conflicts = await findCoachScheduleConflictsForTrainer(viewerId, slot.scheduledStartAt, {
        proposedEndAtIso: slot.scheduledEndAt,
      });
      if (conflicts.length > 0) {
        return { ok: false, error: 'Scheduling conflict', conflicts };
      }
    }
  }

  const supabase = getSupabaseServer();
  const createdRosterIds: string[] = [];
  const rosterTokens: Array<{ id: string; rawToken: string; email: string }> = [];

  try {
    for (const email of prospectEmails) {
      const r = await createRosterInvite({
        inviterId: viewerId,
        inviterRole: viewerRole === 'host' ? 'host' : 'trainer',
        channel: 'email',
        email,
        programIds: input.prospectProgramIds ?? [],
        publicAppBaseHint: input.publicAppBaseHint ?? undefined,
      });
      if (!r.ok) {
        await deleteRosterInvitationsByIds(createdRosterIds);
        return { ok: false, error: r.message };
      }
      createdRosterIds.push(r.invitationId);
      rosterTokens.push({ id: r.invitationId, rawToken: r.rawToken, email });
    }

    const { data: ser, error: serErr } = await supabase
      .from('trainer_live_session_series')
      .insert({
        trainer_user_id: viewerId,
        frequency: 'weekly',
        interval_weeks: 1,
        weekday: meta.weekday,
        iana_timezone: meta.ianaTimezone,
        duration_minutes: meta.durationMinutes,
        local_start_time: meta.localStartTime,
        expand_horizon_weeks: Math.min(104, Math.max(1, horizon)),
        status: 'active',
      })
      .select('id')
      .single();

    if (serErr || !ser?.id) {
      await deleteRosterInvitationsByIds(createdRosterIds);
      return { ok: false, error: serErr?.message ?? 'Failed to create series' };
    }

    const seriesId = ser.id as string;

    const occRows = slots.map((s) => ({
      trainer_user_id: viewerId,
      series_id: seriesId,
      scheduled_start_at: s.scheduledStartAt,
      scheduled_end_at: s.scheduledEndAt,
      status: 'scheduled' as const,
    }));

    const { data: occIns, error: occErr } = await supabase
      .from('trainer_live_session_occurrences')
      .insert(occRows)
      .select('id');

    if (occErr || !occIns?.length) {
      await supabase.from('trainer_live_session_series').delete().eq('id', seriesId);
      await deleteRosterInvitationsByIds(createdRosterIds);
      return { ok: false, error: occErr?.message ?? 'Failed to create occurrences' };
    }

    const occurrenceIds = occIns.map((r) => r.id as string);

    const allInvites: Array<{
      occurrence_id: string;
      invitee_user_id: string | null;
      roster_invitation_id?: string | null;
      status: 'pending';
    }> = [];
    for (const oid of occurrenceIds) {
      for (const uid of rawIds) {
        allInvites.push({ occurrence_id: oid, invitee_user_id: uid, status: 'pending' });
      }
      for (const rid of createdRosterIds) {
        allInvites.push({
          occurrence_id: oid,
          invitee_user_id: null,
          roster_invitation_id: rid,
          status: 'pending',
        });
      }
    }

    if (allInvites.length > 0) {
      const { error: invErr } = await supabase.from('trainer_live_session_invites').insert(allInvites);
      if (invErr) {
        await supabase.from('trainer_live_session_occurrences').delete().in('id', occurrenceIds);
        await supabase.from('trainer_live_session_series').delete().eq('id', seriesId);
        await deleteRosterInvitationsByIds(createdRosterIds);
        return { ok: false, error: invErr.message ?? 'Failed to create invites' };
      }
    }

    const studioSlug = await getStudioSlugForInviter(viewerId);
    for (const rt of rosterTokens) {
      const { data: li } = await supabase
        .from('trainer_live_session_invites')
        .select('id')
        .eq('roster_invitation_id', rt.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      const focus = typeof li?.id === 'string' ? li.id : undefined;
      const baseUrl = buildRosterInviteAcceptUrl(
        rt.rawToken,
        studioSlug,
        input.publicAppBaseHint ?? undefined,
        focus ? { focusLiveInvite: focus } : undefined
      );
      await trySendRosterInviteEmail(rt.rawToken, rt.email, baseUrl);
    }

    return { ok: true, seriesId, occurrenceIds };
  } catch (e) {
    await deleteRosterInvitationsByIds(createdRosterIds);
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to create series' };
  }
}

export async function patchLiveScheduleOccurrence(
  viewerId: string,
  occurrenceId: string,
  patch: {
    scheduledStartAt?: string;
    scheduledEndAt?: string;
    status?: 'scheduled' | 'cancelled' | 'completed';
    allowOverlap?: boolean;
    /** Link / unlink native `trainer_live_sessions` row (viewer must own the session). */
    liveSessionId?: string | null;
    /** Optional calendar title override; `null` clears to default label. */
    displayName?: string | null;
    /** Batch series reschedule: extra occurrence ids to ignore in overlap scan (in addition to this row). */
    conflictExcludeScheduledOccurrenceIds?: string[];
  }
): Promise<{ ok: true } | { ok: false; error: string } | LiveScheduleConflictFailure> {
  const supabase = getSupabaseServer();
  const { data: row, error: selErr } = await supabase
    .from('trainer_live_session_occurrences')
    .select('id, trainer_user_id, scheduled_start_at, scheduled_end_at, status')
    .eq('id', occurrenceId)
    .maybeSingle();

  if (selErr || !row || row.trainer_user_id !== viewerId) {
    return { ok: false, error: 'Occurrence not found' };
  }

  const hasLiveKey = 'liveSessionId' in patch;
  if (hasLiveKey && patch.liveSessionId != null && String(patch.liveSessionId).trim() !== '') {
    const sid = String(patch.liveSessionId).trim();
    const { data: sess, error: sErr } = await supabase
      .from('trainer_live_sessions')
      .select('id, trainer_user_id, status')
      .eq('id', sid)
      .maybeSingle();
    if (sErr || !sess) {
      return { ok: false, error: 'Live session not found' };
    }
    if ((sess.trainer_user_id as string) !== viewerId) {
      return { ok: false, error: 'Live session not found' };
    }
    if ((sess.status as string) !== 'active') {
      return { ok: false, error: 'Live session must be active to link' };
    }
  }

  const updates: {
    updated_at: string;
    scheduled_start_at?: string;
    scheduled_end_at?: string;
    status?: 'scheduled' | 'cancelled' | 'completed';
    live_session_id?: string | null;
    display_name?: string | null;
  } = { updated_at: new Date().toISOString() };
  if (patch.status) {
    updates.status = patch.status;
  }
  if ('displayName' in patch) {
    const dn = patch.displayName;
    if (dn == null) {
      updates.display_name = null;
    } else {
      const t = String(dn).trim();
      updates.display_name = t.length > 0 ? t : null;
    }
  }
  if (patch.scheduledStartAt?.trim()) {
    updates.scheduled_start_at = patch.scheduledStartAt.trim();
  }
  if (patch.scheduledEndAt?.trim()) {
    updates.scheduled_end_at = patch.scheduledEndAt.trim();
  }
  if (hasLiveKey) {
    updates.live_session_id =
      patch.liveSessionId != null && String(patch.liveSessionId).trim() !== ''
        ? String(patch.liveSessionId).trim()
        : null;
  }

  const finalStart = updates.scheduled_start_at ?? (row.scheduled_start_at as string);
  const finalEnd = updates.scheduled_end_at ?? (row.scheduled_end_at as string);
  const finalStatus = updates.status ?? (row.status as string);

  if (patch.scheduledStartAt && patch.scheduledEndAt) {
    if (Date.parse(patch.scheduledEndAt) <= Date.parse(patch.scheduledStartAt)) {
      return { ok: false, error: 'End must be after start' };
    }
  } else if (updates.scheduled_start_at || updates.scheduled_end_at) {
    if (Date.parse(finalEnd) <= Date.parse(finalStart)) {
      return { ok: false, error: 'End must be after start' };
    }
  }

  if (
    !patch.allowOverlap &&
    finalStatus === 'scheduled' &&
    finalStart &&
    finalEnd &&
    Date.parse(finalEnd) > Date.parse(finalStart)
  ) {
    const extraEx = (patch.conflictExcludeScheduledOccurrenceIds ?? []).filter(
      (id): id is string => typeof id === 'string' && id.trim() !== '' && id.trim() !== occurrenceId
    );
    const conflicts = await findCoachScheduleConflictsForTrainer(viewerId, finalStart, {
      proposedEndAtIso: finalEnd,
      excludeScheduledOccurrenceId: occurrenceId,
      ...(extraEx.length > 0 ? { excludeScheduledOccurrenceIds: extraEx } : {}),
    });
    if (conflicts.length > 0) {
      return { ok: false, error: 'Scheduling conflict', conflicts };
    }
  }

  const { error: upErr } = await supabase
    .from('trainer_live_session_occurrences')
    .update(updates)
    .eq('id', occurrenceId);

  if (upErr) {
    return { ok: false, error: upErr.message ?? 'Update failed' };
  }
  return { ok: true };
}

export async function addInvitesToLiveScheduleOccurrence(
  viewerId: string,
  viewerRole: string,
  occurrenceId: string,
  inviteeUserIds: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const raw = [
    ...new Set(
      inviteeUserIds
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.trim())
        .filter((x) => x.length > 0)
    ),
  ];
  if (raw.length === 0) {
    return { ok: false, error: 'At least one inviteeUserId required' };
  }

  const supabase = getSupabaseServer();
  const { data: occ, error: occErr } = await supabase
    .from('trainer_live_session_occurrences')
    .select('id, trainer_user_id, status')
    .eq('id', occurrenceId)
    .maybeSingle();

  if (occErr || !occ || (occ.trainer_user_id as string) !== viewerId) {
    return { ok: false, error: 'Occurrence not found' };
  }
  if ((occ.status as string) !== 'scheduled') {
    return { ok: false, error: 'Can only add invites to scheduled occurrences' };
  }

  // Copilot suggestion ignored: batching roster lookups would need a shared helper; per-id check matches existing admin patterns here.
  for (const uid of raw) {
    const allowed = await isUserInViewerRoster(viewerId, viewerRole, uid);
    if (!allowed) {
      return { ok: false, error: `Client not on roster: ${uid}` };
    }
  }

  const { data: existing, error: existingErr } = await supabase
    .from('trainer_live_session_invites')
    .select('invitee_user_id')
    .eq('occurrence_id', occurrenceId);

  if (existingErr) {
    return { ok: false, error: existingErr.message ?? 'Failed to load invites' };
  }

  const existingUserIds = new Set(
    (existing ?? [])
      .map((r) => r.invitee_user_id as string | null)
      .filter((x): x is string => typeof x === 'string' && x.length > 0)
  );

  const toAdd = raw.filter((id) => !existingUserIds.has(id));
  if (toAdd.length === 0) {
    return { ok: true };
  }

  const rows = toAdd.map((invitee_user_id) => ({
    occurrence_id: occurrenceId,
    invitee_user_id,
    status: 'pending' as const,
  }));

  const { error: insErr } = await supabase.from('trainer_live_session_invites').insert(rows);
  if (insErr) {
    return { ok: false, error: insErr.message ?? 'Failed to add invites' };
  }
  return { ok: true };
}

export async function cancelLiveScheduleInvite(
  viewerId: string,
  inviteId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseServer();
  const { data: inv, error: invErr } = await supabase
    .from('trainer_live_session_invites')
    .select('id, occurrence_id, status')
    .eq('id', inviteId)
    .maybeSingle();

  if (invErr || !inv) {
    return { ok: false, error: 'Invite not found' };
  }

  const { data: occ, error: occErr } = await supabase
    .from('trainer_live_session_occurrences')
    .select('trainer_user_id')
    .eq('id', inv.occurrence_id as string)
    .maybeSingle();

  if (occErr || !occ || (occ.trainer_user_id as string) !== viewerId) {
    return { ok: false, error: 'Invite not found' };
  }

  const st = inv.status as string;
  if (st !== 'pending' && st !== 'waitlisted') {
    return { ok: false, error: 'Only pending or waitlisted invites can be cancelled' };
  }

  const now = new Date().toISOString();
  const { error: upErr } = await supabase
    .from('trainer_live_session_invites')
    .update({ status: 'cancelled', updated_at: now })
    .eq('id', inviteId);

  if (upErr) {
    return { ok: false, error: upErr.message ?? 'Failed to cancel invite' };
  }
  return { ok: true };
}

/**
 * Shift this occurrence and all future scheduled rows in the series by the same UTC delta,
 * then align series weekly metadata to the anchor's new wall window.
 */
export async function rescheduleLiveScheduleSeriesFutureFromAnchor(
  viewerId: string,
  seriesId: string,
  anchorOccurrenceId: string,
  newScheduledStartAt: string,
  newScheduledEndAt: string,
  allowOverlap: boolean
): Promise<{ ok: true } | { ok: false; error: string } | LiveScheduleConflictFailure> {
  const start = newScheduledStartAt?.trim();
  const end = newScheduledEndAt?.trim();
  if (!start || !end || Date.parse(end) <= Date.parse(start)) {
    return { ok: false, error: 'End must be after start' };
  }

  const supabase = getSupabaseServer();
  const { data: ser, error: serErr } = await supabase
    .from('trainer_live_session_series')
    .select('id, trainer_user_id, iana_timezone, status')
    .eq('id', seriesId)
    .maybeSingle();

  if (serErr || !ser || (ser.trainer_user_id as string) !== viewerId) {
    return { ok: false, error: 'Series not found' };
  }
  if ((ser.status as string) !== 'active') {
    return { ok: false, error: 'Series is not active' };
  }

  const zone = String(ser.iana_timezone ?? '').trim();
  if (!zone) {
    return { ok: false, error: 'Series timezone missing' };
  }

  const { data: anchor, error: aErr } = await supabase
    .from('trainer_live_session_occurrences')
    .select('id, trainer_user_id, series_id, status, scheduled_start_at, scheduled_end_at')
    .eq('id', anchorOccurrenceId)
    .maybeSingle();

  if (aErr || !anchor || (anchor.trainer_user_id as string) !== viewerId) {
    return { ok: false, error: 'Occurrence not found' };
  }
  if ((anchor.series_id as string | null) !== seriesId) {
    return { ok: false, error: 'Occurrence is not in this series' };
  }
  if ((anchor.status as string) !== 'scheduled') {
    return { ok: false, error: 'Anchor occurrence must be scheduled' };
  }

  let meta: ReturnType<typeof seriesMetaFromFirstSlot>;
  try {
    meta = seriesMetaFromFirstSlot(start, end, zone);
  } catch {
    return { ok: false, error: 'Invalid schedule window' };
  }

  const oldAnchorStartMs = Date.parse(anchor.scheduled_start_at as string);
  const newStartMs = Date.parse(start);
  if (!Number.isFinite(oldAnchorStartMs) || !Number.isFinite(newStartMs)) {
    return { ok: false, error: 'Invalid timestamps' };
  }
  const deltaMs = newStartMs - oldAnchorStartMs;
  const newDurationMs = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(newDurationMs) || newDurationMs <= 0) {
    return { ok: false, error: 'Invalid schedule window' };
  }

  const anchorStartIso = anchor.scheduled_start_at as string;

  const { data: futureRows, error: fErr } = await supabase
    .from('trainer_live_session_occurrences')
    .select('id, scheduled_start_at, scheduled_end_at')
    .eq('trainer_user_id', viewerId)
    .eq('series_id', seriesId)
    .eq('status', 'scheduled')
    .gte('scheduled_start_at', anchorStartIso)
    .order('scheduled_start_at', { ascending: true });

  if (fErr) {
    return { ok: false, error: fErr.message ?? 'Failed to load occurrences' };
  }

  const rows = futureRows ?? [];
  if (rows.length === 0) {
    return { ok: false, error: 'No scheduled occurrences to reschedule' };
  }

  const batchIds = rows.map((r) => r.id as string);

  const proposals: Array<{ id: string; nextStart: string; nextEnd: string }> = [];
  for (const r of rows) {
    const sMs = Date.parse(r.scheduled_start_at as string);
    const eMs = Date.parse(r.scheduled_end_at as string);
    if (!Number.isFinite(sMs) || !Number.isFinite(eMs)) {
      return { ok: false, error: 'Invalid occurrence timestamps' };
    }
    const ns = new Date(sMs + deltaMs).toISOString();
    const ne = new Date(sMs + deltaMs + newDurationMs).toISOString();
    if (Date.parse(ne) <= Date.parse(ns)) {
      return { ok: false, error: 'Invalid shifted window' };
    }
    proposals.push({ id: r.id as string, nextStart: ns, nextEnd: ne });
  }

  // Copilot suggestion ignored: a single conflict query over a merged window can report conflicts outside the shifted slots; per-slot checks stay precise.
  if (!allowOverlap) {
    for (const p of proposals) {
      const conflicts = await findCoachScheduleConflictsForTrainer(viewerId, p.nextStart, {
        proposedEndAtIso: p.nextEnd,
        excludeScheduledOccurrenceIds: batchIds,
      });
      if (conflicts.length > 0) {
        return { ok: false, error: 'Scheduling conflict', conflicts };
      }
    }
  }

  const nowIso = new Date().toISOString();
  // Copilot suggestion ignored: true atomicity belongs in a DB transaction/RPC; client upsert would not match this update-only flow safely without broader schema review.
  for (const p of proposals) {
    const { error: uErr } = await supabase
      .from('trainer_live_session_occurrences')
      .update({
        scheduled_start_at: p.nextStart,
        scheduled_end_at: p.nextEnd,
        updated_at: nowIso,
      })
      .eq('id', p.id);

    if (uErr) {
      return { ok: false, error: uErr.message ?? 'Failed to update occurrence' };
    }
  }

  const { error: sErr } = await supabase
    .from('trainer_live_session_series')
    .update({
      weekday: meta.weekday,
      local_start_time: meta.localStartTime,
      duration_minutes: meta.durationMinutes,
      updated_at: nowIso,
    })
    .eq('id', seriesId);

  if (sErr) {
    return { ok: false, error: sErr.message ?? 'Failed to update series' };
  }

  return { ok: true };
}

export async function patchLiveScheduleSeries(
  viewerId: string,
  seriesId: string,
  patch: { status?: 'active' | 'cancelled'; untilAt?: string | null }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseServer();
  const { data: ser, error: selErr } = await supabase
    .from('trainer_live_session_series')
    .select('id, trainer_user_id')
    .eq('id', seriesId)
    .maybeSingle();

  if (selErr || !ser || ser.trainer_user_id !== viewerId) {
    return { ok: false, error: 'Series not found' };
  }

  const updates: Record<string, string | null> = { updated_at: new Date().toISOString() };
  if (patch.status) updates.status = patch.status;
  if (patch.untilAt !== undefined) updates.until_at = patch.untilAt;

  const { error: upErr } = await supabase
    .from('trainer_live_session_series')
    .update(updates)
    .eq('id', seriesId);

  if (upErr) {
    return { ok: false, error: upErr.message ?? 'Update failed' };
  }

  if (patch.status === 'cancelled') {
    const nowIso = new Date().toISOString();
    await supabase
      .from('trainer_live_session_occurrences')
      .update({ status: 'cancelled', updated_at: nowIso })
      .eq('series_id', seriesId)
      .eq('status', 'scheduled')
      .gte('scheduled_start_at', nowIso);
  }

  return { ok: true };
}
