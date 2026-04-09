/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase A: read-only unified trainer calendar (all roster clients, one week).
 */

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import type { UnifiedCalendarItem } from '@/lib/supabase/admin/trainer-unified-calendar';
import {
  addCalendarDaysInZone,
  calendarDateInZone,
  formatTimeInZone,
  mondayOfWeekForZone,
  safeIanaZone,
  weekDayListFromMonday,
} from '@/lib/performance-lab/trainer-calendar-time';
import { missionControlApiAuthHeaders } from '@/lib/mission-control-api-auth';
import { useAppContext } from '@/contexts/AppContext';
import { CalendarTimezoneControl } from '@/components/react/calendar/CalendarTimezoneControl';
import { updateMyProfileTimezone } from '@/lib/profile-timezone';
import type { CoachScheduleConflictItem } from '@/lib/supabase/admin/trainer-client-calendar';
import { supabase } from '@/lib/supabase/supabase-instance';
import { trainerLiveParticipantStorageKey } from '@/lib/trainer-live/storage';

const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type PendingLiveScheduleConflict = {
  conflicts: CoachScheduleConflictItem[];
  url: string;
  basePayload: Record<string, unknown>;
};

function itemSortKey(ev: UnifiedCalendarItem): string {
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

function dayKeyForItem(ev: UnifiedCalendarItem, viewerTz: string): string {
  if (ev.kind === 'live_session') return calendarDateInZone(ev.startAt, viewerTz);
  if (ev.kind === 'scheduled_live_occurrence') {
    return calendarDateInZone(ev.scheduledStartAt, viewerTz);
  }
  if (
    ev.kind === 'coach_instance' ||
    ev.kind === 'scheduled_workout' ||
    ev.kind === 'amrap_scheduled'
  ) {
    return calendarDateInZone(ev.scheduledAt, viewerTz);
  }
  return ev.date;
}

const TrainerUnifiedCalendarView: React.FC = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAppContext();
  const [weekStart, setWeekStart] = useState(() => mondayOfWeekForZone(Date.now(), 'UTC'));
  const [viewerTimezone, setViewerTimezone] = useState('UTC');
  const [items, setItems] = useState<UnifiedCalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scheduleLiveOpen, setScheduleLiveOpen] = useState(false);
  const [rosterOptions, setRosterOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [startLocal, setStartLocal] = useState('');
  const [endLocal, setEndLocal] = useState('');
  const [selectedInvitees, setSelectedInvitees] = useState<Set<string>>(() => new Set());
  const [createBusy, setCreateBusy] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [weeklySeries, setWeeklySeries] = useState(false);
  const [horizonWeeks, setHorizonWeeks] = useState(12);
  const [pendingLiveConflict, setPendingLiveConflict] = useState<PendingLiveScheduleConflict | null>(
    null
  );
  const [busyLiveConflictRetry, setBusyLiveConflictRetry] = useState(false);
  /** `occ:${id}` or `coach:${clientUserId}:${instanceId}` while starting / linking live */
  const [startLiveBusyKey, setStartLiveBusyKey] = useState<string | null>(null);
  const [startLiveErr, setStartLiveErr] = useState<string | null>(null);
  const alignedWeekRef = useRef(false);
  const viewerTzForFetchRef = useRef(viewerTimezone);

  useLayoutEffect(() => {
    viewerTzForFetchRef.current = viewerTimezone;
  }, [viewerTimezone]);

  const weekEnd = useMemo(
    () => addCalendarDaysInZone(weekStart, 6, viewerTimezone),
    [weekStart, viewerTimezone]
  );
  const weekDays = useMemo(
    () => weekDayListFromMonday(weekStart, viewerTimezone),
    [weekStart, viewerTimezone]
  );

  const loadUnified = useCallback(async () => {
    setLoading(true);
    setError(null);
    setItems([]);
    try {
      const auth = await missionControlApiAuthHeaders();
      const vt = viewerTzForFetchRef.current;
      const ws = weekStart;
      const we = addCalendarDaysInZone(ws, 6, vt);
      const q = new URLSearchParams({ from: ws, to: we });
      const res = await fetch(`/api/trainer/calendar/unified?${q}`, {
        credentials: 'include',
        headers: { ...auth },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === 'string' ? body.error : 'Failed to load calendar');
        return;
      }
      const vTz = safeIanaZone(
        typeof body.viewerTimezone === 'string' ? body.viewerTimezone : undefined
      );
      setViewerTimezone(vTz);
      viewerTzForFetchRef.current = vTz;
      if (!alignedWeekRef.current) {
        alignedWeekRef.current = true;
        const nextMonday = mondayOfWeekForZone(Date.now(), vTz);
        if (nextMonday !== weekStart) {
          setWeekStart(nextMonday);
          return;
        }
      }
      const list = Array.isArray(body.items) ? (body.items as UnifiedCalendarItem[]) : [];
      setItems(list);
    } catch {
      setError('Failed to load calendar');
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  const openTrainerLiveRoom = useCallback(
    (sessionId: string) => {
      navigate(`/live/${encodeURIComponent(sessionId)}`);
    },
    [navigate]
  );

  const runCreateTrainerLiveSession = useCallback(async (invitedClientUserId: string | null) => {
    const { data, error } = await supabase.rpc('trainer_live_create_session', {
      p_shell: 'video_only',
      p_invited_client_user_id: invitedClientUserId,
    });
    if (error) return { ok: false as const, error: error.message };
    const row = data as { session_id?: string; participant_id?: string } | null;
    const sid = row?.session_id;
    const pid = row?.participant_id;
    if (!sid || !pid) return { ok: false as const, error: 'Could not create live session' };
    return { ok: true as const, sid, pid };
  }, []);

  const onScheduledOccurrenceLiveCta = useCallback(
    async (ev: UnifiedCalendarItem & { kind: 'scheduled_live_occurrence' }) => {
      setStartLiveErr(null);
      if (ev.liveSessionId) {
        openTrainerLiveRoom(ev.liveSessionId);
        return;
      }
      setStartLiveBusyKey(`occ:${ev.occurrenceId}`);
      try {
        const created = await runCreateTrainerLiveSession(null);
        if (!created.ok) {
          setStartLiveErr(created.error);
          return;
        }
        const auth = await missionControlApiAuthHeaders();
        const res = await fetch(
          `/api/trainer/live-schedule/occurrences/${encodeURIComponent(ev.occurrenceId)}`,
          {
            method: 'PATCH',
            credentials: 'include',
            headers: { ...auth, 'Content-Type': 'application/json' },
            body: JSON.stringify({ liveSessionId: created.sid }),
          }
        );
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setStartLiveErr(typeof body.error === 'string' ? body.error : 'Failed to link calendar');
          return;
        }
        sessionStorage.setItem(trainerLiveParticipantStorageKey(created.sid), created.pid);
        await loadUnified();
        openTrainerLiveRoom(created.sid);
      } finally {
        setStartLiveBusyKey(null);
      }
    },
    [loadUnified, openTrainerLiveRoom, runCreateTrainerLiveSession]
  );

  const onCoachInstanceLiveCta = useCallback(
    async (ev: UnifiedCalendarItem & { kind: 'coach_instance' }) => {
      setStartLiveErr(null);
      const liveId = ev.trainerLiveSessionId;
      if (liveId) {
        openTrainerLiveRoom(liveId);
        return;
      }
      setStartLiveBusyKey(`coach:${ev.clientUserId}:${ev.instanceId}`);
      try {
        let created = await runCreateTrainerLiveSession(ev.clientUserId);
        if (
          !created.ok &&
          /not on your roster|Client is not/i.test(created.error)
        ) {
          created = await runCreateTrainerLiveSession(null);
        }
        if (!created.ok) {
          setStartLiveErr(created.error);
          return;
        }
        const auth = await missionControlApiAuthHeaders();
        const res = await fetch(
          `/api/trainer/clients/${encodeURIComponent(ev.clientUserId)}/calendar/instances/${encodeURIComponent(ev.instanceId)}`,
          {
            method: 'PATCH',
            credentials: 'include',
            headers: { ...auth, 'Content-Type': 'application/json' },
            body: JSON.stringify({ trainerLiveSessionId: created.sid }),
          }
        );
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setStartLiveErr(typeof body.error === 'string' ? body.error : 'Failed to link calendar');
          return;
        }
        sessionStorage.setItem(trainerLiveParticipantStorageKey(created.sid), created.pid);
        await loadUnified();
        openTrainerLiveRoom(created.sid);
      } finally {
        setStartLiveBusyKey(null);
      }
    },
    [loadUnified, openTrainerLiveRoom, runCreateTrainerLiveSession]
  );

  const commitViewerTimezone = useCallback(
    async (zone: string) => {
      if (!authUser?.uid) return;
      try {
        await updateMyProfileTimezone(authUser.uid, zone);
        const z = safeIanaZone(zone);
        viewerTzForFetchRef.current = z;
        setViewerTimezone(z);
        alignedWeekRef.current = false;
        await loadUnified();
      } catch (e) {
        window.alert(e instanceof Error ? e.message : 'Failed to save timezone');
      }
    },
    [authUser?.uid, loadUnified]
  );

  useEffect(() => {
    void loadUnified();
  }, [loadUnified]);

  useEffect(() => {
    if (!scheduleLiveOpen || !authUser?.uid) return;
    let cancelled = false;
    (async () => {
      try {
        const auth = await missionControlApiAuthHeaders();
        const res = await fetch('/api/trainer/roster', {
          credentials: 'include',
          headers: { ...auth },
        });
        const data = (await res.json().catch(() => [])) as Array<{
          id: string;
          full_name?: string | null;
          email?: string | null;
        }>;
        if (cancelled) return;
        setRosterOptions(
          (Array.isArray(data) ? data : []).map((r) => ({
            id: r.id,
            label: (r.full_name?.trim() || r.email?.trim() || r.id) as string,
          }))
        );
      } catch {
        if (!cancelled) setRosterOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scheduleLiveOpen, authUser?.uid]);

  const submitScheduleLive = useCallback(
    async (allowOverlap?: boolean) => {
      if (!authUser?.uid || !startLocal || !endLocal || selectedInvitees.size === 0) {
        setCreateErr('Pick start, end, and at least one client.');
        return;
      }
      const startMs = new Date(startLocal).getTime();
      const endMs = new Date(endLocal).getTime();
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
        setCreateErr('End must be after start.');
        return;
      }
      const hz = Math.min(104, Math.max(1, Math.floor(horizonWeeks)));
      setCreateBusy(true);
      setCreateErr(null);
      try {
        const auth = await missionControlApiAuthHeaders();
        const viewerTz = safeIanaZone(viewerTzForFetchRef.current);
        const basePayload: Record<string, unknown> = weeklySeries
          ? {
              scheduledStartAt: new Date(startLocal).toISOString(),
              scheduledEndAt: new Date(endLocal).toISOString(),
              ianaTimezone: viewerTz,
              horizonWeeks: hz,
              inviteeUserIds: [...selectedInvitees],
            }
          : {
              scheduledStartAt: new Date(startLocal).toISOString(),
              scheduledEndAt: new Date(endLocal).toISOString(),
              ianaTimezone: viewerTz,
              inviteeUserIds: [...selectedInvitees],
            };
        const requestBody = allowOverlap ? { ...basePayload, allowOverlap: true } : basePayload;
        const url = weeklySeries
          ? '/api/trainer/live-schedule/series'
          : '/api/trainer/live-schedule/occurrences';
        const res = await fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          conflicts?: CoachScheduleConflictItem[];
        };
        if (
          res.status === 409 &&
          Array.isArray(body.conflicts) &&
          body.conflicts.length > 0 &&
          !allowOverlap
        ) {
          setPendingLiveConflict({
            conflicts: body.conflicts,
            url,
            basePayload,
          });
          return;
        }
        if (!res.ok) {
          setCreateErr(typeof body.error === 'string' ? body.error : 'Failed to create');
          return;
        }
        setScheduleLiveOpen(false);
        setStartLocal('');
        setEndLocal('');
        setSelectedInvitees(new Set());
        setWeeklySeries(false);
        setHorizonWeeks(12);
        setPendingLiveConflict(null);
        await loadUnified();
      } catch {
        setCreateErr('Network error');
      } finally {
        setCreateBusy(false);
      }
    },
    [authUser?.uid, startLocal, endLocal, selectedInvitees, loadUnified, weeklySeries, horizonWeeks]
  );

  const confirmLiveDespiteConflict = useCallback(async () => {
    const pending = pendingLiveConflict;
    if (!pending) return;
    setBusyLiveConflictRetry(true);
    try {
      const auth = await missionControlApiAuthHeaders();
      const res = await fetch(pending.url, {
        method: 'POST',
        credentials: 'include',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pending.basePayload, allowOverlap: true }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setCreateErr(typeof body.error === 'string' ? body.error : 'Failed to create');
        return;
      }
      setPendingLiveConflict(null);
      setScheduleLiveOpen(false);
      setStartLocal('');
      setEndLocal('');
      setSelectedInvitees(new Set());
      setWeeklySeries(false);
      setHorizonWeeks(12);
      await loadUnified();
    } catch {
      setCreateErr('Network error');
    } finally {
      setBusyLiveConflictRetry(false);
    }
  }, [pendingLiveConflict, loadUnified]);

  const viewerLabel = safeIanaZone(viewerTimezone);

  const byDay = useMemo(() => {
    const m = new Map<string, UnifiedCalendarItem[]>();
    for (const d of weekDays) m.set(d, []);
    for (const ev of items) {
      const k = dayKeyForItem(ev, viewerLabel);
      if (!m.has(k)) continue;
      m.get(k)!.push(ev);
    }
    for (const d of weekDays) {
      m.get(d)!.sort((a, b) => itemSortKey(a).localeCompare(itemSortKey(b)));
    }
    return m;
  }, [items, weekDays, viewerLabel]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-orange-light" />
            <h1 className="font-heading text-2xl font-bold">Unified calendar</h1>
          </div>
          {authUser?.uid ? (
            <CalendarTimezoneControl
              variant="trainer"
              value={viewerLabel}
              onCommit={commitViewerTimezone}
              id="unified-calendar-timezone"
            />
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setWeekStart((w) => addCalendarDaysInZone(w, -7, viewerTimezone))
            }
            className="rounded-lg border border-white/15 p-2 text-white/80 hover:bg-white/10"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[10rem] text-center font-mono text-sm text-white/70">
            {weekStart} → {weekEnd}
          </span>
          <button
            type="button"
            onClick={() =>
              setWeekStart((w) => addCalendarDaysInZone(w, 7, viewerTimezone))
            }
            className="rounded-lg border border-white/15 p-2 text-white/80 hover:bg-white/10"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-white/55">
          All clients on your program roster for the selected week. Program days are read-only;
          coach instances are scheduled assignments; Live rows are runtime rooms; teal cards are
          scheduled live invites. Week columns use your timezone ({viewerLabel}).
        </p>
        {authUser?.uid ? (
          <button
            type="button"
            onClick={() => {
              setCreateErr(null);
              setScheduleLiveOpen(true);
            }}
            className="shrink-0 rounded-lg border border-orange-light/40 bg-orange-light/15 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-orange-light hover:bg-orange-light/25"
          >
            Schedule live
          </button>
        ) : null}
      </div>

      {scheduleLiveOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="presentation"
          onClick={() => !createBusy && setScheduleLiveOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-live-title"
            className="max-h-[min(90vh,560px)] w-full max-w-lg overflow-y-auto rounded-xl border border-white/15 bg-bg-dark p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="schedule-live-title" className="font-heading text-lg font-bold text-white">
              Schedule live session
            </h2>
            <p className="mt-1 text-xs text-white/50">
              Roster clients and weekly series use your calendar timezone below. Prospects: use the API
              with prospect emails + program ids. Capacity 6 + waitlist on accept.
            </p>
            <div className="mt-4 space-y-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={weeklySeries}
                  disabled={createBusy}
                  onChange={(e) => setWeeklySeries(e.target.checked)}
                />
                Weekly series (materialize {horizonWeeks} week{horizonWeeks === 1 ? '' : 's'})
              </label>
              {weeklySeries ? (
                <div>
                  <label className="mb-1 block text-xs text-white/50">Weeks ahead</label>
                  <input
                    type="number"
                    min={1}
                    max={104}
                    value={horizonWeeks}
                    onChange={(e) => setHorizonWeeks(Number(e.target.value) || 12)}
                    disabled={createBusy}
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                  />
                </div>
              ) : null}
              <div>
                <label className="mb-1 block text-xs text-white/50">Start (local)</label>
                <input
                  type="datetime-local"
                  value={startLocal}
                  onChange={(e) => setStartLocal(e.target.value)}
                  disabled={createBusy}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/50">End (local)</label>
                <input
                  type="datetime-local"
                  value={endLocal}
                  onChange={(e) => setEndLocal(e.target.value)}
                  disabled={createBusy}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <p className="mb-2 text-xs text-white/50">Invite clients</p>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-2">
                  {rosterOptions.length === 0 ? (
                    <p className="text-xs text-white/40">Loading roster…</p>
                  ) : (
                    rosterOptions.map((r) => (
                      <label key={r.id} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedInvitees.has(r.id)}
                          disabled={createBusy}
                          onChange={() => {
                            setSelectedInvitees((prev) => {
                              const next = new Set(prev);
                              if (next.has(r.id)) next.delete(r.id);
                              else next.add(r.id);
                              return next;
                            });
                          }}
                        />
                        <span className="text-white/85">{r.label}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
            {createErr ? <p className="mt-3 text-sm text-red-300">{createErr}</p> : null}
            <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
              <button
                type="button"
                disabled={createBusy}
                onClick={() => void submitScheduleLive()}
                className="rounded-lg bg-orange-light/25 px-4 py-2 text-sm font-medium text-orange-light hover:bg-orange-light/35 disabled:opacity-40"
              >
                {createBusy ? 'Saving…' : 'Create & invite'}
              </button>
              <button
                type="button"
                disabled={createBusy}
                onClick={() => setScheduleLiveOpen(false)}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingLiveConflict ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4"
          role="presentation"
          onClick={() => !busyLiveConflictRetry && setPendingLiveConflict(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="live-schedule-conflict-title"
            className="max-h-[min(90vh,520px)] w-full max-w-md overflow-y-auto rounded-xl border border-amber-400/30 bg-bg-dark p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="live-schedule-conflict-title"
              className="font-heading text-lg font-bold text-amber-100"
            >
              Scheduling conflict
            </h3>
            <p className="mt-2 text-sm text-white/65">
              This time overlaps another item on your calendar. Change the time and try again, or
              create anyway (double-book).
            </p>
            <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto font-mono text-xs text-white/80">
              {pendingLiveConflict.conflicts.map((c) => (
                <li
                  key={`${c.source}-${c.sourceId}`}
                  className="rounded border border-white/10 bg-black/30 px-2 py-2"
                >
                  <div className="font-medium text-orange-100/95">{c.summary}</div>
                  <div className="mt-1 text-white/55">
                    {formatTimeInZone(c.startAt, viewerLabel)}–{formatTimeInZone(c.endAt, viewerLabel)}{' '}
                    <span className="text-white/40">({viewerLabel})</span>
                  </div>
                  {c.source === 'coach_instance' ? (
                    <div className="mt-0.5 text-[10px] text-white/40">
                      Client <span className="text-white/55">{c.clientUserId}</span>
                    </div>
                  ) : c.source === 'scheduled_live_occurrence' ? (
                    <div className="mt-0.5 text-[10px] text-white/40">Scheduled live</div>
                  ) : (
                    <div className="mt-0.5 text-[10px] text-white/40">Trainer Live</div>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
              <button
                type="button"
                disabled={busyLiveConflictRetry}
                onClick={() => void confirmLiveDespiteConflict()}
                className="rounded-lg bg-amber-500/25 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-500/35 disabled:opacity-40"
              >
                {busyLiveConflictRetry ? 'Saving…' : 'Create anyway'}
              </button>
              <button
                type="button"
                disabled={busyLiveConflictRetry}
                onClick={() => setPendingLiveConflict(null)}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {startLiveErr ? <p className="text-sm text-red-300">{startLiveErr}</p> : null}

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-light border-t-transparent" />
          <span className="ml-3 text-white/60">Loading…</span>
        </div>
      ) : (
        <div className="flex gap-1 overflow-x-auto pb-2">
          {weekDays.map((date, i) => (
            <div
              key={date}
              className="flex min-h-[200px] min-w-[7.5rem] flex-1 flex-col border border-white/10 bg-black/30 p-2"
            >
              <div className="mb-2 border-b border-white/10 pb-1 text-center">
                <div className="font-mono text-[10px] uppercase text-white/45">
                  {WEEK_LABELS[i] ?? ''}
                </div>
                <div className="font-mono text-xs text-white/80">{date.slice(5)}</div>
              </div>
              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
                {(byDay.get(date) ?? []).map((ev) =>
                  ev.kind === 'scheduled_live_occurrence' ? (
                    <div
                      key={`sched-live-${ev.occurrenceId}`}
                      className="rounded border border-teal-400/45 bg-teal-500/10 px-1.5 py-1 font-mono text-[9px] text-teal-100/95"
                    >
                      <div className="truncate font-medium text-white/90">Scheduled Live</div>
                      {ev.recurrenceSummary ? (
                        <div className="text-[8px] text-teal-200/80">{ev.recurrenceSummary}</div>
                      ) : null}
                      <div className="text-white/65">
                        {formatTimeInZone(ev.scheduledStartAt, viewerLabel)}
                        {ev.scheduledEndAt !== ev.scheduledStartAt ? (
                          <span className="text-white/45">
                            {' '}
                            – {formatTimeInZone(ev.scheduledEndAt, viewerLabel)}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-[8px] text-white/50">
                        P {ev.pendingCount} · A {ev.acceptedCount} · W {ev.waitlistedCount}
                        {ev.declinedCount > 0 ? ` · D ${ev.declinedCount}` : ''}
                      </div>
                      {ev.inviteSummaries.length > 0 ? (
                        <div className="mt-0.5 truncate text-[8px] text-white/55" title="">
                          {ev.inviteSummaries.map((s) => `${s.label} (${s.status})`).join(', ')}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        disabled={startLiveBusyKey === `occ:${ev.occurrenceId}`}
                        onClick={() => void onScheduledOccurrenceLiveCta(ev)}
                        className="mt-1 w-full rounded border border-teal-400/50 bg-teal-500/15 px-1.5 py-1 text-[8px] font-medium text-teal-100/95 hover:bg-teal-500/25 disabled:opacity-40"
                      >
                        {startLiveBusyKey === `occ:${ev.occurrenceId}`
                          ? '…'
                          : ev.liveSessionId
                            ? 'Open live'
                            : 'Start session'}
                      </button>
                    </div>
                  ) : ev.kind === 'live_session' ? (
                    <div
                      key={`live-${ev.sessionId}`}
                      className="rounded border border-cyan-400/35 bg-cyan-500/10 px-1.5 py-1 font-mono text-[9px] text-cyan-100/95"
                    >
                      <div className="truncate font-medium text-white/90">Live</div>
                      <div className="truncate">
                        <span className="text-white/40">Session · </span>
                        {ev.shell ?? 'video'}
                        {ev.status === 'ended' ? (
                          <span className="text-white/45"> · ended</span>
                        ) : null}
                      </div>
                      <div className="text-white/65">
                        {formatTimeInZone(ev.startAt, viewerLabel)}
                        {ev.endAt !== ev.startAt ? (
                          <span className="text-white/45">
                            {' '}
                            – {formatTimeInZone(ev.endAt, viewerLabel)}
                          </span>
                        ) : null}
                      </div>
                      {ev.participantSummaries.length > 0 ? (
                        <div className="mt-0.5 truncate text-[8px] text-white/55" title="">
                          {ev.participantSummaries.map((p) => p.label).join(', ')}
                        </div>
                      ) : null}
                      <Link
                        to={`/live/${encodeURIComponent(ev.sessionId)}`}
                        className="mt-1 inline-block text-[8px] text-cyan-200/90 underline decoration-cyan-400/40 hover:decoration-cyan-200"
                      >
                        Open Live
                      </Link>
                    </div>
                  ) : ev.kind === 'scheduled_workout' || ev.kind === 'amrap_scheduled' ? (
                    <div
                      key={`${ev.kind}-${ev.clientUserId}-${ev.sourceId}`}
                      className="rounded border border-sky-400/35 bg-sky-500/10 px-1.5 py-1 font-mono text-[9px] text-sky-100/90"
                    >
                      <div className="truncate font-medium text-white/90">{ev.clientLabel}</div>
                      <div className="truncate">
                        <span className="text-white/40">
                          {ev.kind === 'amrap_scheduled' ? 'Client AMRAP · ' : 'Client timer · '}
                        </span>
                        {ev.title}
                      </div>
                      <div className="text-white/60">
                        {formatTimeInZone(ev.scheduledAt, viewerLabel)}
                        {ev.kind === 'amrap_scheduled' ? (
                          <span className="text-white/45"> · {ev.durationMinutes}m</span>
                        ) : null}
                      </div>
                      <Link
                        to={`/roster/${encodeURIComponent(ev.clientUserId)}/lab`}
                        className="mt-1 inline-block text-[8px] text-sky-200/90 underline decoration-sky-400/40 hover:decoration-sky-200"
                      >
                        Open lab
                      </Link>
                    </div>
                  ) : (
                    <div
                      key={
                        ev.kind === 'coach_instance'
                          ? `c-${ev.instanceId}`
                          : `p-${ev.clientUserId}-${ev.date}-${ev.programId}-${ev.workoutIndex}`
                      }
                      className={
                        ev.kind === 'coach_instance'
                          ? 'rounded border border-orange-light/40 bg-orange-light/10 px-1.5 py-1 font-mono text-[9px] text-orange-light'
                          : 'rounded border border-white/15 bg-white/5 px-1.5 py-1 font-mono text-[9px] text-white/70'
                      }
                    >
                      <div className="truncate font-medium text-white/90">{ev.clientLabel}</div>
                      <div className="truncate">
                        {ev.kind === 'program' ? (
                          <>
                            <span className="text-white/40">Program · </span>
                            {ev.workoutTitle}
                          </>
                        ) : (
                          <>
                            <span className="text-white/40">Coach · </span>
                            {ev.title}
                          </>
                        )}
                      </div>
                      {ev.kind === 'coach_instance' ? (
                        <>
                          <div className="text-white/60">
                            {formatTimeInZone(ev.scheduledAt, viewerLabel)}
                          </div>
                          <button
                            type="button"
                            disabled={
                              startLiveBusyKey === `coach:${ev.clientUserId}:${ev.instanceId}`
                            }
                            onClick={() => void onCoachInstanceLiveCta(ev)}
                            className="mt-1 w-full rounded border border-orange-light/50 bg-orange-light/15 px-1.5 py-1 text-[8px] font-medium text-orange-light hover:bg-orange-light/25 disabled:opacity-40"
                          >
                            {startLiveBusyKey === `coach:${ev.clientUserId}:${ev.instanceId}`
                              ? '…'
                              : ev.trainerLiveSessionId
                                ? 'Open live'
                                : 'Start session'}
                          </button>
                        </>
                      ) : (
                        <div className="text-white/45">All day</div>
                      )}
                      <Link
                        to={`/roster/${encodeURIComponent(ev.clientUserId)}/lab`}
                        className="mt-1 inline-block text-[8px] text-orange-light/90 underline decoration-orange-light/40 hover:decoration-orange-light"
                      >
                        Open lab
                      </Link>
                    </div>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrainerUnifiedCalendarView;
