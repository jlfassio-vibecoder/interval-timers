/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unified trainer calendar: per-client payloads plus grouped Live session rows.
 */

import {
  buildTrainerClientCalendarPayload,
  COACH_SCHEDULE_CONFLICT_SLOT_MINUTES,
  fetchClientTimezone,
  type TrainerCalendarApiEvent,
} from '@/lib/supabase/admin/trainer-client-calendar';
import { fetchTrainerRoster, type RosterItem } from '@/lib/supabase/admin/trainer-roster';
import {
  fetchScheduledLiveOccurrencesForTrainer,
  type UnifiedScheduledLiveOccurrenceItem,
} from '@/lib/supabase/admin/trainer-live-scheduled';
import { getSupabaseServer } from '@/lib/supabase/server';

export type { UnifiedScheduledLiveOccurrenceItem };

export type UnifiedLiveSessionCalendarItem = {
  kind: 'live_session';
  sessionId: string;
  startAt: string;
  endAt: string;
  shell: string | null;
  status: string;
  participantSummaries: Array<{ clientUserId: string; label: string }>;
};

/** Single row in the unified feed: program/coach (per client) or one grouped Live session. */
export type UnifiedCalendarItem =
  | (TrainerCalendarApiEvent & { clientUserId: string; clientLabel: string })
  | UnifiedLiveSessionCalendarItem
  | UnifiedScheduledLiveOccurrenceItem;

function rosterLabel(r: Pick<RosterItem, 'full_name' | 'email' | 'id'>): string {
  const n = r.full_name?.trim();
  if (n) return n;
  const e = r.email?.trim();
  if (e) return e;
  return r.id;
}

/** Stable ISO-ish sort key for merging unified calendar rows (exported for unit tests). */
export function unifiedCalendarItemSortKey(ev: UnifiedCalendarItem): string {
  if (ev.kind === 'live_session') return ev.startAt;
  if (ev.kind === 'scheduled_live_occurrence') return ev.scheduledStartAt;
  if (
    ev.kind === 'coach_instance' ||
    ev.kind === 'scheduled_workout' ||
    ev.kind === 'amrap_scheduled'
  ) {
    return ev.scheduledAt;
  }
  return `${ev.date}T00:00:00.000Z`;
}

async function mapInChunks<T, R>(items: T[], chunkSize: number, fn: (item: T) => Promise<R>) {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    out.push(...(await Promise.all(chunk.map(fn))));
  }
  return out;
}

async function fetchUnifiedLiveSessionItems(
  viewerId: string,
  from: string,
  to: string
): Promise<{ items: UnifiedLiveSessionCalendarItem[]; sessionIdSet: Set<string> }> {
  const supabase = getSupabaseServer();
  const startIso = `${from}T00:00:00.000Z`;
  const endIso = `${to}T23:59:59.999Z`;
  const { data: sessions, error: sessErr } = await supabase
    .from('trainer_live_sessions')
    .select('id, created_at, ended_at, shell, status')
    .eq('trainer_user_id', viewerId)
    .gte('created_at', startIso)
    .lte('created_at', endIso)
    .order('created_at', { ascending: true });

  if (sessErr) {
    if (import.meta.env.DEV) console.warn('[trainer-unified-calendar] live sessions', sessErr);
    return { items: [], sessionIdSet: new Set() };
  }

  const sessionList = sessions ?? [];
  if (sessionList.length === 0) return { items: [], sessionIdSet: new Set() };

  const sessionIds = sessionList.map((s) => s.id as string);
  const { data: parts } = await supabase
    .from('trainer_live_participants')
    .select('session_id, user_id, role')
    .in('session_id', sessionIds)
    .eq('role', 'client')
    .not('user_id', 'is', null);

  const clientIds = [...new Set((parts ?? []).map((p) => p.user_id as string).filter(Boolean))];
  let labelById = new Map<string, string>();
  if (clientIds.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, full_name, username, email')
      .in('id', clientIds);
    labelById = new Map(
      (profs ?? []).map((p) => {
        const id = p.id as string;
        const fn = (p as { full_name?: string | null }).full_name?.trim();
        const em = (p as { email?: string | null }).email?.trim();
        const un = (p as { username?: string | null }).username?.trim();
        return [id, fn || em || un || id] as [string, string];
      })
    );
  }

  const uidsBySession = new Map<string, string[]>();
  for (const row of parts ?? []) {
    const sid = row.session_id as string;
    const uid = row.user_id as string;
    if (!uid) continue;
    const list = uidsBySession.get(sid);
    if (list) list.push(uid);
    else uidsBySession.set(sid, [uid]);
  }

  const slotMs = COACH_SCHEDULE_CONFLICT_SLOT_MINUTES * 60 * 1000;
  const items: UnifiedLiveSessionCalendarItem[] = [];
  const sessionIdSet = new Set<string>();

  for (const s of sessionList) {
    const id = s.id as string;
    sessionIdSet.add(id);
    const created = s.created_at as string;
    const startMs = Date.parse(created);
    const endMs = s.ended_at ? Date.parse(s.ended_at as string) : startMs + slotMs;
    const startAt = new Date(startMs).toISOString();
    const endAt = new Date(endMs).toISOString();
    const uids = uidsBySession.get(id) ?? [];
    const participantSummaries = uids.map((uid) => ({
      clientUserId: uid,
      label: labelById.get(uid) ?? uid,
    }));
    items.push({
      kind: 'live_session',
      sessionId: id,
      startAt,
      endAt,
      shell: typeof s.shell === 'string' ? s.shell : null,
      status: typeof s.status === 'string' ? s.status : 'active',
      participantSummaries,
    });
  }

  return { items, sessionIdSet };
}

export async function buildTrainerUnifiedCalendarPayload(
  viewerId: string,
  viewerRole: string,
  from: string,
  to: string
): Promise<{ from: string; to: string; viewerTimezone: string; items: UnifiedCalendarItem[] }> {
  const viewerTimezone = await fetchClientTimezone(viewerId);
  const { items: liveItems, sessionIdSet } = await fetchUnifiedLiveSessionItems(viewerId, from, to);
  const scheduledRaw = await fetchScheduledLiveOccurrencesForTrainer(viewerId, from, to);
  const scheduledItems = scheduledRaw.filter(
    (s) => !s.liveSessionId || !sessionIdSet.has(s.liveSessionId)
  );

  const roster = await fetchTrainerRoster(viewerId);
  if (roster.length === 0) {
    const items = [...liveItems, ...scheduledItems].sort((a, b) =>
      unifiedCalendarItemSortKey(a).localeCompare(unifiedCalendarItemSortKey(b))
    );
    return { from, to, viewerTimezone, items };
  }

  const results = await mapInChunks(roster, 6, async (r) => {
    const payload = await buildTrainerClientCalendarPayload(viewerId, r.id, viewerRole, from, to);
    return { r, payload };
  });

  const items: UnifiedCalendarItem[] = [...liveItems, ...scheduledItems];
  let vt = viewerTimezone;

  for (const { r, payload } of results) {
    if (!payload) {
      if (import.meta.env.DEV) {
        console.warn('[trainer-unified-calendar] skipped client (no payload)', r.id);
      }
      continue;
    }
    vt = payload.viewerTimezone;
    const label = rosterLabel(r);
    for (const ev of payload.events) {
      if (
        ev.kind === 'coach_instance' &&
        ev.trainerLiveSessionId &&
        sessionIdSet.has(ev.trainerLiveSessionId)
      ) {
        continue;
      }
      const row: UnifiedCalendarItem = { ...ev, clientUserId: r.id, clientLabel: label };
      items.push(row);
    }
  }

  items.sort((a, b) => unifiedCalendarItemSortKey(a).localeCompare(unifiedCalendarItemSortKey(b)));

  return { from, to, viewerTimezone: vt, items };
}
