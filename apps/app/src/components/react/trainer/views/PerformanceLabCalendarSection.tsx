/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * P2 Performance Lab: week calendar with program events + draggable coach schedule instances.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
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
import type { TrainerCalendarApiEvent } from '@/lib/supabase/admin/trainer-client-calendar';

function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function mondayOfWeekUtc(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay();
  const adjust = dow === 0 ? -6 : 1 - dow;
  dt.setUTCDate(dt.getUTCDate() + adjust);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface PerformanceLabCalendarSectionProps {
  userId: string;
  assignments: CoachAssignmentListItem[];
  onRefreshAssignments: () => void;
}

function CoachInstanceDraggable({ instanceId, title }: { instanceId: string; title: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `coach:${instanceId}`,
    data: { instanceId },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`mb-1 cursor-grab rounded border border-orange-light/50 bg-orange-light/15 px-1.5 py-1 font-mono text-[10px] text-orange-light active:cursor-grabbing ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      {title}
    </div>
  );
}

function DayColumn({
  date,
  label,
  events,
}: {
  date: string;
  label: string;
  events: TrainerCalendarApiEvent[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: date });
  const programEvents = events.filter((e) => e.kind === 'program');
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
        {coachEvents.map((ev) => (
          <CoachInstanceDraggable key={ev.instanceId} instanceId={ev.instanceId} title={ev.title} />
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
  const today = new Date().toISOString().slice(0, 10);
  const [weekStart, setWeekStart] = useState(() => mondayOfWeekUtc(today));
  const [timezone, setTimezone] = useState('UTC');
  const [events, setEvents] = useState<TrainerCalendarApiEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyPatch, setBusyPatch] = useState(false);
  const [pickAssignmentId, setPickAssignmentId] = useState('');
  const [busyAdd, setBusyAdd] = useState(false);

  const weekEnd = useMemo(() => addDaysIso(weekStart, 6), [weekStart]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i)),
    [weekStart]
  );

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    setEvents([]);
    setError(null);
    try {
      const q = new URLSearchParams({ from: weekStart, to: weekEnd });
      const res = await fetch(
        `/api/trainer/clients/${encodeURIComponent(userId)}/calendar?${q}`,
        { credentials: 'include' }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === 'string' ? body.error : 'Failed to load calendar');
        setEvents([]);
        return;
      }
      setTimezone(typeof body.timezone === 'string' ? body.timezone : 'UTC');
      const list = Array.isArray(body.events) ? (body.events as TrainerCalendarApiEvent[]) : [];
      setEvents(list);
    } catch {
      setError('Failed to load calendar');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [userId, weekStart, weekEnd]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  const byDate = useMemo(() => {
    const m = new Map<string, TrainerCalendarApiEvent[]>();
    for (const e of events) {
      const d = e.date;
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(e);
    }
    return m;
  }, [events]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const onDragEnd = useCallback(
    async (ev: DragEndEvent) => {
      const { active, over } = ev;
      if (!over || !active.id.toString().startsWith('coach:')) return;
      const targetDate = over.id.toString();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return;
      const instanceId = active.id.toString().slice('coach:'.length);
      const scheduledAt = `${targetDate}T12:00:00.000Z`;
      setBusyPatch(true);
      try {
        const res = await fetch(
          `/api/trainer/clients/${encodeURIComponent(userId)}/calendar/instances/${encodeURIComponent(instanceId)}`,
          {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scheduledAt }),
          }
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          window.alert(typeof body.error === 'string' ? body.error : 'Could not reschedule');
          return;
        }
        await loadCalendar();
      } finally {
        setBusyPatch(false);
      }
    },
    [userId, loadCalendar]
  );

  const addInstanceOnDay = async (date: string) => {
    if (!pickAssignmentId) {
      window.alert('Choose an assignment first.');
      return;
    }
    setBusyAdd(true);
    try {
      const scheduledAt = `${date}T12:00:00.000Z`;
      const res = await fetch(
        `/api/trainer/clients/${encodeURIComponent(userId)}/calendar/instances`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignmentId: pickAssignmentId, scheduledAt }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(typeof body.error === 'string' ? body.error : 'Could not add');
        return;
      }
      await loadCalendar();
      onRefreshAssignments();
    } finally {
      setBusyAdd(false);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-orange-light" />
          <h2 className="font-heading text-xl font-bold">Calendar</h2>
          <span className="text-sm text-white/50">Client TZ: {timezone}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekStart((w) => addDaysIso(w, -7))}
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
            onClick={() => setWeekStart((w) => addDaysIso(w, 7))}
            className="rounded-lg border border-white/15 p-2 text-white/80 hover:bg-white/10"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : null}

      <p className="text-sm text-white/55">
        Program workouts are read-only. Drag orange coach items to another day to reschedule (stored as
        UTC midday for the chosen date). Use the row below to place an assignment on a day.
      </p>

      <DndContext sensors={sensors} onDragEnd={(e) => void onDragEnd(e)}>
        <div className="flex gap-1 overflow-x-auto pb-2">
          {weekDays.map((date, i) => (
            <DayColumn
              key={date}
              date={date}
              label={WEEK_LABELS[i] ?? ''}
              events={byDate.get(date) ?? []}
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
    </div>
  );
};

export default PerformanceLabCalendarSection;
