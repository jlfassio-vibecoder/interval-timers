/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Chronological list view: upcoming events (e.g. 21 days), grouped by date, compact cards.
 */

import React, { useMemo } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import type { CalendarEvent, CalendarEventType } from '@/lib/calendar-events';
import { sortEventsByTypeOrder } from '@/lib/calendar-event-order';

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const TYPE_LABELS: Record<CalendarEvent['type'], string> = {
  program: 'Program',
  amrap: 'AMRAP',
  amrap_scheduled: 'AMRAP',
  timer: 'Timer',
  timer_scheduled: 'Scheduled',
  live_scheduled: 'Live',
  coach_live: 'Coach live',
  readiness: 'Readiness',
};

const TYPE_STYLES: Record<CalendarEvent['type'], { border: string; bg: string; text: string }> = {
  program: { border: 'border-orange-light', bg: 'bg-orange-light/10', text: 'text-orange-light' },
  amrap: { border: 'border-blue-400', bg: 'bg-blue-400/10', text: 'text-blue-400' },
  amrap_scheduled: { border: 'border-blue-300', bg: 'bg-blue-300/10', text: 'text-blue-300' },
  timer: { border: 'border-emerald-400', bg: 'bg-emerald-400/10', text: 'text-emerald-400' },
  timer_scheduled: {
    border: 'border-emerald-300',
    bg: 'bg-emerald-400/10',
    text: 'text-emerald-300',
  },
  readiness: { border: 'border-violet-400', bg: 'bg-violet-400/10', text: 'text-violet-400' },
  live_scheduled: {
    border: 'border-cyan-400',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-200',
  },
  coach_live: {
    border: 'border-cyan-400',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-200',
  },
};

function getEventStyle(ev: CalendarEvent): { border: string; bg: string; text: string } {
  if (ev.type === 'program' && ev.status) {
    const status = ev.status;
    if (status === 'completed')
      return { border: 'border-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400' };
    if (status === 'missed')
      return { border: 'border-white/30', bg: 'bg-white/5', text: 'text-white/50' };
  }
  return TYPE_STYLES[ev.type];
}

function formatDateHeader(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDuration(ev: CalendarEvent): string | null {
  const m = ev.metadata;
  if (m?.durationMinutes != null) return `${m.durationMinutes} min`;
  if (m?.durationSeconds != null) return `${Math.round(m.durationSeconds / 60)} min`;
  return null;
}

export interface CalendarListViewProps {
  events: CalendarEvent[];
  todayISO: string;
  restDays?: Set<string>;
  onEventClick?: (date: string, events: CalendarEvent[]) => void;
  onExportIcs?: () => void;
  exportIcsLoading?: boolean;
  loading?: boolean;
  /** When provided, same-day events are sorted by this type order (Phase 5.9). */
  eventTypeOrder?: CalendarEventType[];
}

const CalendarListView: React.FC<CalendarListViewProps> = ({
  events,
  todayISO,
  restDays,
  onEventClick,
  onExportIcs,
  exportIcsLoading = false,
  loading = false,
  eventTypeOrder,
}) => {
  const groupedByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    if (eventTypeOrder != null && eventTypeOrder.length > 0) {
      for (const [date, list] of map) {
        map.set(date, sortEventsByTypeOrder(list, eventTypeOrder));
      }
    }
    const dates: string[] = [];
    for (let i = 0; i < 21; i++) dates.push(addDays(todayISO, i));
    return dates.map((date) => [date, map.get(date) ?? []] as [string, CalendarEvent[]]);
  }, [events, todayISO, eventTypeOrder]);

  if (loading) {
    return (
      <p className="py-8 text-center font-mono text-[10px] uppercase text-white/40">Loading…</p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        {onExportIcs && (
          <button
            type="button"
            onClick={onExportIcs}
            disabled={exportIcsLoading}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-white transition-colors hover:bg-white/10 disabled:opacity-50"
            aria-label="Sync to Calendar"
            title="Export as .ics file for Google Calendar, Apple Calendar, or Outlook"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {exportIcsLoading ? 'Exporting…' : 'Sync to Calendar'}
          </button>
        )}
      </div>

      <ul className="space-y-4">
        {groupedByDate.map(([date, dayEvents]) => {
          const isRestOnly = dayEvents.length === 0 && restDays?.has(date);
          return (
            <li key={date}>
              <h5 className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-white/50">
                {formatDateHeader(date)}
                {date === todayISO && <span className="ml-2 text-orange-light">Today</span>}
              </h5>
              {dayEvents.length > 0 ? (
                <ul className="space-y-1.5">
                  {dayEvents.map((ev, j) => {
                    const style = getEventStyle(ev);
                    const duration = formatDuration(ev);
                    return (
                      <li key={j}>
                        <button
                          type="button"
                          onClick={() => onEventClick?.(date, [ev])}
                          className={`flex w-full flex-col gap-0.5 rounded-lg border-l-2 px-3 py-2 text-left transition-opacity hover:opacity-90 focus:outline-none focus:ring-1 focus:ring-white/30 ${style.border} ${style.bg} ${style.text}`}
                        >
                          <span className="font-mono text-xs font-medium">{ev.workoutTitle}</span>
                          <span className="flex items-center gap-2 font-mono text-[10px] text-white/70">
                            <span>{TYPE_LABELS[ev.type]}</span>
                            {duration != null && <span>· {duration}</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : isRestOnly ? (
                <button
                  type="button"
                  onClick={() => onEventClick?.(date, [])}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left font-mono text-[10px] text-white/50 transition-opacity hover:opacity-90 focus:outline-none focus:ring-1 focus:ring-white/30"
                >
                  Rest
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onEventClick?.(date, [])}
                  className="w-full rounded-lg border border-dashed border-white/10 px-3 py-2 text-left font-mono text-[10px] text-white/40 transition-opacity hover:opacity-90 focus:outline-none focus:ring-1 focus:ring-white/30"
                >
                  —
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default CalendarListView;
