/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Single-week calendar view: 7 columns (Sun–Sat), larger cells, week navigation.
 * Uses parent DndContext; no select mode.
 */

import React, { useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import type { CalendarEvent, CalendarEventType } from '@/lib/calendar-events';
import { sortEventsByTypeOrder } from '@/lib/calendar-event-order';
import { DroppableDayCell } from './AppCalendar';

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + 'T12:00:00Z');
  const end = new Date(addDays(weekStart, 6) + 'T12:00:00Z');
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  if (sameMonth) {
    return `${start.toLocaleDateString('default', { month: 'short' })} ${start.getUTCDate()}–${end.getUTCDate()}, ${start.getUTCFullYear()}`;
  }
  return `${start.toLocaleDateString('default', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export interface CalendarWeekViewProps {
  events: CalendarEvent[];
  weekStart: string;
  todayISO: string;
  restDays?: Set<string>;
  onEventClick?: (date: string, events: CalendarEvent[]) => void;
  onEventDrop?: (event: CalendarEvent, targetDate: string) => Promise<void>;
  onWeekChange: (delta: number) => void;
  onExportIcs?: () => void;
  exportIcsLoading?: boolean;
  loading?: boolean;
  /** When provided, same-day events are sorted by this type order (Phase 5.9). */
  eventTypeOrder?: CalendarEventType[];
}

const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({
  events,
  weekStart,
  todayISO: _todayISO,
  restDays,
  onEventClick,
  onEventDrop,
  onWeekChange,
  onExportIcs,
  exportIcsLoading = false,
  loading = false,
  eventTypeOrder,
}) => {
  const eventsByDate = useMemo(() => {
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
    return map;
  }, [events, eventTypeOrder]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  if (loading) {
    return (
      <p className="py-8 text-center font-mono text-[10px] uppercase text-white/40">Loading…</p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onWeekChange(-1)}
            className="rounded border border-white/10 bg-white/5 p-2 transition-colors hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/30"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[180px] font-mono text-sm text-white">
            {formatWeekRange(weekStart)}
          </span>
          <button
            type="button"
            onClick={() => onWeekChange(1)}
            className="rounded border border-white/10 bg-white/5 p-2 transition-colors hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/30"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
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

      <div className="grid grid-cols-7 gap-px border border-white/10 bg-white/5">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="bg-bg-dark py-2 text-center font-mono text-[10px] uppercase text-white/50"
          >
            {wd}
          </div>
        ))}
        {weekDays.map((iso) => {
          const d = new Date(iso + 'T12:00:00Z');
          const dayEvents = eventsByDate.get(iso) ?? [];
          return (
            <div key={iso} className="min-h-[120px] md:min-h-[140px]">
              <DroppableDayCell
                iso={iso}
                dayEvents={dayEvents}
                d={d}
                onEventClick={onEventClick}
                onEventDrop={onEventDrop}
                restDays={restDays}
                selectMode={false}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarWeekView;
