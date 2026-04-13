/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * P2 Performance Lab: week calendar with program events + draggable coach schedule instances.
 * Coach wall times use the viewer's profile timezone; badges show the client's local time.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, GripVertical, Pencil } from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { CoachAssignmentListItem } from '@/lib/supabase/admin/trainer-client-assignments';
import type {
  CoachScheduleConflictItem,
  TrainerCalendarApiEvent,
} from '@/lib/supabase/admin/trainer-client-calendar';
import type { WeeklyActivityCardRow } from '@/lib/supabase/admin/trainer-client-weekly-board';
import { truncateCardTitle } from '@/lib/performance-lab/weekly-board-dates';
import {
  addCalendarDaysInZone,
  calendarDateInZone,
  formatTimeInZone,
  localDateTimeToUtcIso,
  mondayOfWeekForZone,
  reschedulePreservingViewerLocalTime,
  safeIanaZone,
  shortZoneName,
  timeHmInZone,
  uniqueMondaysForDatesInZone,
  weekDayListFromMonday,
} from '@/lib/performance-lab/trainer-calendar-time';
import { missionControlApiAuthHeaders } from '@/lib/mission-control-api-auth';
import { useAppContext } from '@/contexts/AppContext';
import { CalendarTimezoneControl } from '@/components/react/calendar/CalendarTimezoneControl';
import { updateMyProfileTimezone } from '@/lib/profile-timezone';

type CoachInstanceEvent = Extract<TrainerCalendarApiEvent, { kind: 'coach_instance' }>;

type PendingCoachScheduleConflict = {
  conflicts: CoachScheduleConflictItem[];
  method: 'POST' | 'PATCH';
  url: string;
  baseBody: Record<string, unknown>;
  onSuccess: () => Promise<void>;
};

const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface PerformanceLabCalendarSectionProps {
  userId: string;
  assignments: CoachAssignmentListItem[];
  onRefreshAssignments: () => void;
}

function CoachInstanceDraggable({
  event,
  viewerTz,
  clientTz,
  onEdit,
}: {
  event: CoachInstanceEvent;
  viewerTz: string;
  clientTz: string;
  onEdit: (e: CoachInstanceEvent) => void;
}) {
  const { instanceId, title, scheduledAt } = event;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `coach:${instanceId}`,
    data: { instanceId, scheduledAt },
  });
  const viewerTime = formatTimeInZone(scheduledAt, viewerTz);
  const clientTime = formatTimeInZone(scheduledAt, clientTz);
  const clientAbbr = shortZoneName(scheduledAt, clientTz);
  return (
    <div
      ref={setNodeRef}
      className={`border-orange-light/50 bg-orange-light/15 mb-1 flex gap-0.5 rounded border px-0.5 py-1 font-mono text-[10px] text-orange-light ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <button
        type="button"
        className="text-white/45 hover:text-white/80 active:cursor-grabbing"
        aria-label="Drag to reschedule"
        {...listeners}
        {...attributes}
      >
        <GripVertical className="h-4 w-4 shrink-0" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0">
          <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
          <span className="shrink-0 text-white/85">{viewerTime}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1">
          <span
            className="inline-block max-w-full truncate rounded bg-emerald-500/15 px-1 py-px font-mono text-[8px] text-emerald-100/90 ring-1 ring-emerald-400/25"
            title="Client local time"
          >
            {clientTime}
            {clientAbbr ? ` ${clientAbbr}` : ''}
          </span>
        </div>
      </div>
      <button
        type="button"
        className="shrink-0 rounded p-0.5 text-white/50 hover:bg-white/10 hover:text-orange-light"
        aria-label="Edit schedule"
        onClick={() => onEdit(event)}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function DayColumn({
  date,
  label,
  events,
  weeklyActivities,
  viewerTz,
  clientTz,
  onEditCoach,
}: {
  date: string;
  label: string;
  events: TrainerCalendarApiEvent[];
  weeklyActivities: WeeklyActivityCardRow[];
  viewerTz: string;
  clientTz: string;
  onEditCoach: (e: CoachInstanceEvent) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: date });
  const programEvents = events.filter((e) => e.kind === 'program');
  const clientScheduledEvents = events.filter(
    (e) => e.kind === 'scheduled_workout' || e.kind === 'amrap_scheduled'
  );
  const coachEvents = events.filter((e) => e.kind === 'coach_instance');

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[140px] flex-1 flex-col border border-white/10 bg-black/30 p-1.5 ${
        isOver ? 'border-orange-light/50 bg-orange-light/5' : ''
      }`}
    >
      <div className="mb-1 border-b border-white/10 pb-1 text-center">
        <div className="font-mono text-[10px] uppercase text-white/45">{label}</div>
        <div className="font-mono text-xs text-white/80">{date.slice(5)}</div>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {programEvents.map((ev, i) => (
          <div
            key={`p-${date}-${i}-${ev.programId}-${ev.workoutIndex}`}
            className="rounded border border-white/20 bg-white/5 px-1 py-0.5 font-mono text-[9px] text-white/70"
            title="Program schedule (read-only)"
          >
            {ev.workoutTitle}
            <span className="ml-0.5 text-white/40">
              {ev.status === 'completed' ? '✓' : ev.status === 'missed' ? '·' : ''}
            </span>
          </div>
        ))}
        {weeklyActivities.map((c) => (
          <div
            key={`wb-${c.id}`}
            className="bg-emerald-500/12 mb-1 max-w-full truncate rounded-full border border-emerald-400/35 px-2 py-0.5 text-center font-mono text-[9px] text-emerald-100/90"
            title={
              c.status !== 'planned' ? `${c.title} (${c.status})` : `${c.title} — Week activity`
            }
          >
            {truncateCardTitle(c.title)}
          </div>
        ))}
        {clientScheduledEvents
          .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
          .map((ev) => (
            <div
              key={`${ev.kind}-${ev.sourceId}`}
              className="mb-1 rounded border border-sky-400/35 bg-sky-500/10 px-1 py-0.5 font-mono text-[9px] text-sky-100/90"
              title="Scheduled by client (read-only)"
            >
              <div className="truncate font-medium">
                {ev.kind === 'amrap_scheduled' ? 'AMRAP · ' : 'Timer · '}
                {ev.title}
              </div>
              <div className="text-white/55">
                {formatTimeInZone(ev.scheduledAt, viewerTz)}
                {ev.kind === 'amrap_scheduled' ? (
                  <span className="text-white/40"> · {ev.durationMinutes}m</span>
                ) : null}
              </div>
            </div>
          ))}
        {coachEvents
          .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
          .map((ev) => (
            <CoachInstanceDraggable
              key={ev.instanceId}
              event={ev}
              viewerTz={viewerTz}
              clientTz={clientTz}
              onEdit={onEditCoach}
            />
          ))}
      </div>
    </div>
  );
}

const PerformanceLabCalendarSection: React.FC<PerformanceLabCalendarSectionProps> = ({
  userId,
  assignments,
  onRefreshAssignments,
}) => {
  const { user: authUser } = useAppContext();
  const [weekStart, setWeekStart] = useState(() => mondayOfWeekForZone(Date.now(), 'UTC'));
  const [viewerTimezone, setViewerTimezone] = useState('UTC');
  const [clientTimezone, setClientTimezone] = useState('UTC');
  const [events, setEvents] = useState<TrainerCalendarApiEvent[]>([]);
  const [weeklyByDay, setWeeklyByDay] = useState<Record<string, WeeklyActivityCardRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyPatch, setBusyPatch] = useState(false);
  const [pickAssignmentId, setPickAssignmentId] = useState('');
  const [busyAdd, setBusyAdd] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('07:00');
  const [editCoach, setEditCoach] = useState<CoachInstanceEvent | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('07:00');
  const [editAssignmentId, setEditAssignmentId] = useState('');
  const [busyEditModal, setBusyEditModal] = useState(false);
  const [pendingScheduleConflict, setPendingScheduleConflict] =
    useState<PendingCoachScheduleConflict | null>(null);
  const [busyConflictRetry, setBusyConflictRetry] = useState(false);
  const alignedWeekRef = useRef(false);
  /** Keeps week strip math in sync without re-subscribing loadCalendar to viewerTimezone (avoids duplicate GET). */
  const viewerTzForFetchRef = useRef(viewerTimezone);

  useLayoutEffect(() => {
    viewerTzForFetchRef.current = viewerTimezone;
  }, [viewerTimezone]);

  useEffect(() => {
    if (!editCoach) return;
    const vz = safeIanaZone(viewerTimezone);
    setEditDate(calendarDateInZone(editCoach.scheduledAt, vz));
    setEditTime(timeHmInZone(editCoach.scheduledAt, vz));
    setEditAssignmentId(editCoach.assignmentId);
  }, [editCoach, viewerTimezone]);

  useEffect(() => {
    if (!editCoach) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditCoach(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editCoach]);

  const weekEnd = useMemo(
    () => addCalendarDaysInZone(weekStart, 6, viewerTimezone),
    [weekStart, viewerTimezone]
  );
  const weekDays = useMemo(
    () => weekDayListFromMonday(weekStart, viewerTimezone),
    [weekStart, viewerTimezone]
  );

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    setEvents([]);
    setWeeklyByDay({});
    setError(null);
    try {
      const auth = await missionControlApiAuthHeaders();
      const vtFetch = viewerTzForFetchRef.current;
      const weekDayList = weekDayListFromMonday(weekStart, vtFetch);
      const mondays = uniqueMondaysForDatesInZone(weekDayList, vtFetch);
      const q = new URLSearchParams({ from: weekStart, to: weekEnd });
      const calendarUrl = `/api/trainer/clients/${encodeURIComponent(userId)}/calendar?${q}`;
      const fetches: Promise<Response>[] = [
        fetch(calendarUrl, { credentials: 'include', headers: { ...auth } }),
        ...mondays.map((ws) =>
          fetch(
            `/api/trainer/clients/${encodeURIComponent(userId)}/weekly-board?weekStart=${encodeURIComponent(ws)}`,
            { credentials: 'include', headers: { ...auth } }
          )
        ),
      ];
      const results = await Promise.all(fetches);
      const calRes = results[0];
      const calBody = await calRes.json().catch(() => ({}));
      if (!calRes.ok) {
        setError(typeof calBody.error === 'string' ? calBody.error : 'Failed to load calendar');
        setEvents([]);
        setWeeklyByDay({});
        return;
      }
      const vTz = safeIanaZone(
        typeof calBody.viewerTimezone === 'string' ? calBody.viewerTimezone : undefined
      );
      const cTz = safeIanaZone(typeof calBody.timezone === 'string' ? calBody.timezone : undefined);
      setViewerTimezone(vTz);
      setClientTimezone(cTz);
      viewerTzForFetchRef.current = vTz;
      if (!alignedWeekRef.current) {
        alignedWeekRef.current = true;
        const nextMonday = mondayOfWeekForZone(Date.now(), vTz);
        if (nextMonday !== weekStart) {
          setWeekStart(nextMonday);
          return;
        }
      }
      const list = Array.isArray(calBody.events)
        ? (calBody.events as TrainerCalendarApiEvent[])
        : [];
      setEvents(list);

      const daySet = new Set(weekDayList);
      const merged: Record<string, WeeklyActivityCardRow[]> = {};
      for (const d of weekDayList) merged[d] = [];

      for (let i = 1; i < results.length; i++) {
        const wbRes = results[i];
        const wbBody = await wbRes.json().catch(() => ({}));
        if (!wbRes.ok) continue;
        const cards = Array.isArray(wbBody.cards) ? (wbBody.cards as WeeklyActivityCardRow[]) : [];
        for (const c of cards) {
          const ds = c.scheduledDate;
          if (daySet.has(ds)) {
            merged[ds].push(c);
          }
        }
      }
      for (const d of weekDayList) {
        merged[d].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
      }
      setWeeklyByDay(merged);
    } catch {
      setError('Failed to load calendar');
      setEvents([]);
      setWeeklyByDay({});
    } finally {
      setLoading(false);
    }
  }, [userId, weekStart, weekEnd]);

  const commitViewerTimezone = useCallback(
    async (zone: string) => {
      if (!authUser?.uid) return;
      try {
        await updateMyProfileTimezone(authUser.uid, zone);
        const z = safeIanaZone(zone);
        viewerTzForFetchRef.current = z;
        setViewerTimezone(z);
        alignedWeekRef.current = false;
        await loadCalendar();
      } catch (e) {
        window.alert(e instanceof Error ? e.message : 'Failed to save timezone');
      }
    },
    [authUser?.uid, loadCalendar]
  );

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  const submitCoachScheduleMutation = useCallback(
    async (opts: {
      method: 'POST' | 'PATCH';
      url: string;
      body: Record<string, unknown>;
      allowOverlap?: boolean;
      onSuccess: () => Promise<void>;
    }) => {
      const auth = await missionControlApiAuthHeaders();
      const bodyPayload = opts.allowOverlap
        ? { ...opts.body, allowOverlap: true }
        : { ...opts.body };
      const res = await fetch(opts.url, {
        method: opts.method,
        credentials: 'include',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      const parsed = (await res.json().catch(() => ({}))) as {
        error?: string;
        conflicts?: CoachScheduleConflictItem[];
      };
      if (res.status === 409 && Array.isArray(parsed.conflicts) && parsed.conflicts.length > 0) {
        setPendingScheduleConflict({
          conflicts: parsed.conflicts,
          method: opts.method,
          url: opts.url,
          baseBody: { ...opts.body },
          onSuccess: opts.onSuccess,
        });
        return;
      }
      if (!res.ok) {
        window.alert(typeof parsed.error === 'string' ? parsed.error : 'Request failed');
        return;
      }
      await opts.onSuccess();
    },
    []
  );

  const confirmScheduleDespiteConflict = useCallback(async () => {
    const pending = pendingScheduleConflict;
    if (!pending) return;
    setBusyConflictRetry(true);
    try {
      const auth = await missionControlApiAuthHeaders();
      const res = await fetch(pending.url, {
        method: pending.method,
        credentials: 'include',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pending.baseBody, allowOverlap: true }),
      });
      const parsed = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        window.alert(typeof parsed.error === 'string' ? parsed.error : 'Request failed');
        return;
      }
      setPendingScheduleConflict(null);
      await pending.onSuccess();
    } finally {
      setBusyConflictRetry(false);
    }
  }, [pendingScheduleConflict]);

  const byDate = useMemo(() => {
    const m = new Map<string, TrainerCalendarApiEvent[]>();
    const vz = safeIanaZone(viewerTimezone);
    for (const e of events) {
      const d =
        e.kind === 'coach_instance' ||
        e.kind === 'scheduled_workout' ||
        e.kind === 'amrap_scheduled'
          ? calendarDateInZone(e.scheduledAt, vz)
          : e.date;
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(e);
    }
    return m;
  }, [events, viewerTimezone]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const onDragEnd = useCallback(
    async (ev: DragEndEvent) => {
      const { active, over } = ev;
      if (!over || !active.id.toString().startsWith('coach:')) return;
      const targetDate = over.id.toString();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return;
      const instanceId = active.id.toString().slice('coach:'.length);
      const prev = events.find(
        (x) => x.kind === 'coach_instance' && x.instanceId === instanceId
      ) as TrainerCalendarApiEvent | undefined;
      const prevAt = prev && prev.kind === 'coach_instance' ? prev.scheduledAt : null;
      const scheduledAt = prevAt
        ? reschedulePreservingViewerLocalTime(prevAt, targetDate, viewerTimezone, scheduleTime)
        : localDateTimeToUtcIso(targetDate, scheduleTime, viewerTimezone);
      setBusyPatch(true);
      try {
        await submitCoachScheduleMutation({
          method: 'PATCH',
          url: `/api/trainer/clients/${encodeURIComponent(userId)}/calendar/instances/${encodeURIComponent(instanceId)}`,
          body: { scheduledAt },
          onSuccess: async () => {
            await loadCalendar();
          },
        });
      } finally {
        setBusyPatch(false);
      }
    },
    [userId, loadCalendar, events, viewerTimezone, scheduleTime, submitCoachScheduleMutation]
  );

  const addInstanceOnDay = async (date: string) => {
    if (!pickAssignmentId) {
      window.alert('Choose an assignment first.');
      return;
    }
    setBusyAdd(true);
    try {
      const scheduledAt = localDateTimeToUtcIso(date, scheduleTime, viewerTimezone);
      await submitCoachScheduleMutation({
        method: 'POST',
        url: `/api/trainer/clients/${encodeURIComponent(userId)}/calendar/instances`,
        body: { assignmentId: pickAssignmentId, scheduledAt },
        onSuccess: async () => {
          await loadCalendar();
          onRefreshAssignments();
        },
      });
    } finally {
      setBusyAdd(false);
    }
  };

  const saveEditCoach = async () => {
    if (!editCoach) return;
    if (!editAssignmentId) {
      window.alert('Choose an assignment.');
      return;
    }
    setBusyEditModal(true);
    try {
      const scheduledAt = localDateTimeToUtcIso(editDate, editTime, viewerTimezone);
      const prevAssignmentId = editCoach.assignmentId;
      await submitCoachScheduleMutation({
        method: 'PATCH',
        url: `/api/trainer/clients/${encodeURIComponent(userId)}/calendar/instances/${encodeURIComponent(editCoach.instanceId)}`,
        body: { scheduledAt, assignmentId: editAssignmentId },
        onSuccess: async () => {
          setEditCoach(null);
          await loadCalendar();
          if (editAssignmentId !== prevAssignmentId) onRefreshAssignments();
        },
      });
    } finally {
      setBusyEditModal(false);
    }
  };

  const deleteEditCoach = async () => {
    if (!editCoach) return;
    if (
      !window.confirm(
        'Remove this scheduled instance from the calendar? This does not delete the assignment itself.'
      )
    ) {
      return;
    }
    setBusyEditModal(true);
    try {
      const auth = await missionControlApiAuthHeaders();
      const res = await fetch(
        `/api/trainer/clients/${encodeURIComponent(userId)}/calendar/instances/${encodeURIComponent(editCoach.instanceId)}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: { ...auth },
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(typeof body.error === 'string' ? body.error : 'Could not delete');
        return;
      }
      setEditCoach(null);
      await loadCalendar();
      onRefreshAssignments();
    } finally {
      setBusyEditModal(false);
    }
  };

  if (loading && events.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-light border-t-transparent" />
        <span className="ml-3 text-white/60">Loading calendar…</span>
      </div>
    );
  }

  const viewerLabel = safeIanaZone(viewerTimezone);
  const clientLabel = safeIanaZone(clientTimezone);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-orange-light" />
            <h2 className="font-heading text-xl font-bold">Calendar</h2>
          </div>
          <span className="text-sm text-white/55">
            You: <span className="font-mono text-white/75">{viewerLabel}</span>
          </span>
          <span className="text-sm text-white/55">
            Client: <span className="font-mono text-white/75">{clientLabel}</span>
          </span>
          {authUser?.uid ? (
            <CalendarTimezoneControl
              variant="trainer"
              value={viewerLabel}
              onCommit={commitViewerTimezone}
              id="performance-lab-calendar-timezone"
            />
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekStart((w) => addCalendarDaysInZone(w, -7, viewerTimezone))}
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
            onClick={() => setWeekStart((w) => addCalendarDaysInZone(w, 7, viewerTimezone))}
            className="rounded-lg border border-white/15 p-2 text-white/80 hover:bg-white/10"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {viewerLabel === 'UTC' ? (
        <p className="text-xs text-amber-200/80">
          Your profile timezone is UTC. Use the timezone control above (or Profile) so scheduling
          matches your local time.
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <p className="text-sm text-white/55">
        Program workouts are read-only. Emerald pills are Week-board activities (same titles as the
        Week tab). Orange coach items use your local time; the green badge is the client&apos;s
        local time. Use the grip to drag to another day (same local time), or the pencil to edit
        date, time, or assignment—or remove the instance. Pick a default time below, then add to a
        day.
      </p>

      <DndContext sensors={sensors} onDragEnd={(e) => void onDragEnd(e)}>
        <div className="flex gap-1 overflow-x-auto pb-2">
          {weekDays.map((date, i) => (
            <DayColumn
              key={date}
              date={date}
              label={WEEK_LABELS[i] ?? ''}
              events={byDate.get(date) ?? []}
              weeklyActivities={weeklyByDay[date] ?? []}
              viewerTz={viewerLabel}
              clientTz={clientLabel}
              onEditCoach={setEditCoach}
            />
          ))}
        </div>
      </DndContext>

      {busyPatch ? (
        <p className="text-center font-mono text-[10px] text-white/50">Saving…</p>
      ) : null}

      <div className="rounded-lg border border-white/10 bg-black/20 p-4">
        <p className="font-mono text-[10px] uppercase text-white/50">Add schedule instance</p>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem]">
            <label className="mb-1 block text-xs text-white/50">Assignment</label>
            <select
              value={pickAssignmentId}
              onChange={(e) => setPickAssignmentId(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            >
              <option value="">Select…</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.assignmentType}: {a.titleSnapshot}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[8rem]">
            <label className="mb-1 block text-xs text-white/50">Time ({viewerLabel})</label>
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm text-white"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {weekDays.map((date, i) => (
            <button
              key={date}
              type="button"
              disabled={busyAdd || !pickAssignmentId}
              onClick={() => void addInstanceOnDay(date)}
              className="rounded-md border border-white/15 px-2 py-1 font-mono text-[10px] uppercase text-white/70 hover:bg-white/10 disabled:opacity-40"
            >
              {WEEK_LABELS[i]} {date.slice(5)}
            </button>
          ))}
        </div>
      </div>

      {editCoach ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="presentation"
          onClick={() => !busyEditModal && setEditCoach(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-coach-instance-title"
            className="max-h-[min(90vh,640px)] w-full max-w-md overflow-y-auto rounded-xl border border-white/15 bg-bg-dark p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="edit-coach-instance-title"
              className="font-heading text-lg font-bold text-white"
            >
              Edit scheduled item
            </h3>
            <p className="mt-1 text-xs text-white/50">
              Times are in your timezone ({viewerLabel}). Client sees{' '}
              <span className="font-mono text-white/70">{clientLabel}</span> on the badge after you
              save.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs text-white/50">Date ({viewerLabel})</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  disabled={busyEditModal}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/50">Time</label>
                <input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  disabled={busyEditModal}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/50">Assignment</label>
                <select
                  value={editAssignmentId}
                  onChange={(e) => setEditAssignmentId(e.target.value)}
                  disabled={busyEditModal}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                >
                  <option value="">Select…</option>
                  {assignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.assignmentType}: {a.titleSnapshot}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
              <button
                type="button"
                disabled={busyEditModal}
                onClick={() => void saveEditCoach()}
                className="bg-orange-light/25 hover:bg-orange-light/35 rounded-lg px-4 py-2 text-sm font-medium text-orange-light disabled:opacity-40"
              >
                Save
              </button>
              <button
                type="button"
                disabled={busyEditModal}
                onClick={() => setEditCoach(null)}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyEditModal}
                onClick={() => void deleteEditCoach()}
                className="ml-auto rounded-lg border border-red-400/40 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-40"
              >
                Delete instance
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingScheduleConflict ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4"
          role="presentation"
          onClick={() => !busyConflictRetry && setPendingScheduleConflict(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-conflict-title"
            className="max-h-[min(90vh,520px)] w-full max-w-md overflow-y-auto rounded-xl border border-amber-400/30 bg-bg-dark p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="schedule-conflict-title"
              className="font-heading text-lg font-bold text-amber-100"
            >
              Scheduling conflict
            </h3>
            <p className="mt-2 text-sm text-white/65">
              This time overlaps another item on your calendar. Change the time and try again, or
              schedule anyway (double-book).
            </p>
            <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto font-mono text-xs text-white/80">
              {pendingScheduleConflict.conflicts.map((c) => (
                <li
                  key={c.sourceId}
                  className="rounded border border-white/10 bg-black/30 px-2 py-2"
                >
                  <div className="text-orange-100/95 font-medium">{c.summary}</div>
                  <div className="mt-1 text-white/55">
                    {formatTimeInZone(c.startAt, viewerLabel)}–
                    {formatTimeInZone(c.endAt, viewerLabel)}{' '}
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
                disabled={busyConflictRetry}
                onClick={() => void confirmScheduleDespiteConflict()}
                className="rounded-lg bg-amber-500/25 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-500/35 disabled:opacity-40"
              >
                Schedule anyway
              </button>
              <button
                type="button"
                disabled={busyConflictRetry}
                onClick={() => setPendingScheduleConflict(null)}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/85 hover:bg-white/10 disabled:opacity-40"
              >
                Edit time
              </button>
              <button
                type="button"
                disabled={busyConflictRetry}
                onClick={() => setPendingScheduleConflict(null)}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/55 hover:bg-white/10 disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default PerformanceLabCalendarSection;
