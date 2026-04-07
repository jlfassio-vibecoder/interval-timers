/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Picker drawer for a day with multiple activities. User selects one to open type-specific drawer.
 */

import React, { useEffect } from 'react';
import { X, Activity, Dumbbell, Timer, Heart, Calendar, Plus, Video } from 'lucide-react';
import type { CalendarEvent, CalendarEventType } from '@/lib/calendar-events';

export interface MultiActivityDayDrawerProps {
  date: string;
  events: CalendarEvent[];
  /** When provided, section order follows this type order (Phase 5.9); otherwise uses built-in TYPE_ORDER. */
  eventTypeOrder?: CalendarEventType[];
  onClose: () => void;
  onEventSelect: (event: CalendarEvent) => void;
  onScheduleWorkout?: (date: string) => void;
}

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('default', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function typeIcon(type: CalendarEvent['type']) {
  switch (type) {
    case 'program':
      return Dumbbell;
    case 'amrap':
    case 'amrap_scheduled':
      return Activity;
    case 'timer':
    case 'timer_scheduled':
      return Timer;
    case 'readiness':
      return Heart;
    case 'live_scheduled':
      return Video;
    default:
      return Calendar;
  }
}

function typeLabel(type: CalendarEvent['type']): string {
  switch (type) {
    case 'program':
      return 'Program';
    case 'amrap':
      return 'AMRAP';
    case 'amrap_scheduled':
      return 'AMRAP scheduled';
    case 'timer':
      return 'Timer';
    case 'timer_scheduled':
      return 'Scheduled';
    case 'readiness':
      return 'Readiness';
    case 'live_scheduled':
      return 'Live session';
    default:
      return 'Activity';
  }
}

function eventSubline(ev: CalendarEvent): string {
  const parts: string[] = [];
  if (ev.metadata?.durationMinutes != null) parts.push(`${ev.metadata.durationMinutes} min`);
  if (ev.metadata?.durationSeconds != null && ev.metadata?.durationMinutes == null)
    parts.push(`${Math.round(ev.metadata.durationSeconds / 60)} min`);
  if (ev.metadata?.rounds != null) parts.push(`${ev.metadata.rounds} rounds`);
  if (ev.status === 'completed') parts.push('Completed');
  if (ev.status === 'scheduled') parts.push('Scheduled');
  return parts.join(' · ');
}

const TYPE_ORDER: CalendarEvent['type'][] = [
  'program',
  'amrap',
  'amrap_scheduled',
  'timer',
  'timer_scheduled',
  'live_scheduled',
  'readiness',
];

function groupEventsByType(events: CalendarEvent[]): Map<CalendarEvent['type'], CalendarEvent[]> {
  const map = new Map<CalendarEvent['type'], CalendarEvent[]>();
  for (const ev of events) {
    const list = map.get(ev.type) ?? [];
    list.push(ev);
    map.set(ev.type, list);
  }
  return map;
}

const MultiActivityDayDrawer: React.FC<MultiActivityDayDrawerProps> = ({
  date,
  events,
  eventTypeOrder,
  onClose,
  onEventSelect,
  onScheduleWorkout,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const dateLabel = formatDate(date);
  const byType = groupEventsByType(events);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-3xl border border-white/10 bg-bg-dark shadow-2xl"
        role="dialog"
        aria-labelledby="multi-drawer-title"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-bg-dark px-6 py-4">
          <h2
            id="multi-drawer-title"
            className="font-heading text-lg font-black uppercase text-white"
          >
            {dateLabel} — {events.length} activities
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">
          {(eventTypeOrder ?? TYPE_ORDER).map((type) => {
            const list = byType.get(type);
            if (!list || list.length === 0) return null;
            return (
              <section key={type} className="mb-4 last:mb-0">
                <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-white/50">
                  {typeLabel(type)}
                </h3>
                <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
                  {list.map((ev, i) => {
                    const Icon = typeIcon(ev.type);
                    const subline = eventSubline(ev);
                    return (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => onEventSelect(ev)}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/5"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80">
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-white">{ev.workoutTitle}</p>
                            <p className="font-mono text-[10px] uppercase text-white/50">
                              {typeLabel(ev.type)}
                              {subline ? ` · ${subline}` : ''}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          {onScheduleWorkout && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => onScheduleWorkout(date)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Plus className="h-4 w-4" />
                Schedule workout
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default MultiActivityDayDrawer;
