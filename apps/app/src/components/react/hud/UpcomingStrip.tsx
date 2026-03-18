/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Horizontal 7-day strip: day name, date, workout or "Rest". Chip click opens drawer or rest message.
 * When droppable, day chips accept drag-and-drop reschedule.
 */

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { CalendarEvent } from '@/lib/calendar-events';

export interface UpcomingStripDay {
  date: string;
  /** All events for this day (can be empty). */
  events: CalendarEvent[];
}

export interface UpcomingStripProps {
  /** Next 7 days with events per day. */
  days: UpcomingStripDay[];
  /** ISO date for today (highlight active chip). */
  todayISO: string;
  /** Called when a day chip is clicked; receives date and all events for that day. */
  onDayClick: (date: string, events: CalendarEvent[]) => void;
  /** When true, chips are droppable for drag-and-drop reschedule. */
  droppable?: boolean;
  /** Set of ISO date strings for days marked as rest (empty days in this set show "Rest"). */
  restDays?: Set<string>;
}

function formatDayName(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('default', { weekday: 'short' });
}

function formatDateNum(iso: string): string {
  return new Date(iso + 'T12:00:00Z').getDate().toString();
}

const UpcomingStrip: React.FC<UpcomingStripProps> = ({
  days,
  todayISO,
  onDayClick,
  droppable = false,
  restDays,
}) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {days.map(({ date, events }) => {
        const isToday = date === todayISO;
        const _primary = events[0] ?? null;
        return (
          <DroppableChip
            key={date}
            date={date}
            events={events}
            isToday={isToday}
            onDayClick={onDayClick}
            droppable={droppable}
            isRestDay={restDays?.has(date) ?? false}
          />
        );
      })}
    </div>
  );
};

interface DroppableChipProps {
  date: string;
  events: CalendarEvent[];
  isToday: boolean;
  onDayClick: (date: string, events: CalendarEvent[]) => void;
  droppable: boolean;
  isRestDay: boolean;
}

function DroppableChip({
  date,
  events,
  isToday,
  onDayClick,
  droppable,
  isRestDay,
}: DroppableChipProps) {
  const { setNodeRef, isOver } = useDroppable(droppable ? { id: date } : { id: `strip-${date}` });
  const primary = events[0] ?? null;
  const emptyLabel = events.length === 0 ? (isRestDay ? 'Rest' : '—') : null;
  const subtitle = primary
    ? `${primary.workoutTitle}${events.length > 1 ? ` +${events.length - 1}` : ''}`
    : (emptyLabel ?? '—');
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onDayClick(date, events)}
      className={`min-w-[80px] shrink-0 rounded-2xl border px-3 py-3 text-left transition-colors ${
        isOver
          ? 'border-orange-light/60 bg-orange-light/20 ring-orange-light/40 ring-2'
          : isToday
            ? 'border-orange-light/60 bg-orange-light/20'
            : 'border-white/10 bg-white/5 hover:bg-white/10'
      }`}
    >
      <p className="font-mono text-[10px] uppercase text-white/50">{formatDayName(date)}</p>
      <p
        className={`mt-0.5 font-heading text-sm font-black ${isToday ? 'text-orange-light' : 'text-white'}`}
      >
        {formatDateNum(date)}
      </p>
      <p className="mt-1 truncate font-mono text-[10px] text-white/70">{subtitle}</p>
    </button>
  );
}

export default UpcomingStrip;
