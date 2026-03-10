/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Horizontal 7-day strip: day name, date, workout or "Rest". Chip click opens drawer or rest message.
 */

import React from 'react';
import type { CalendarEvent } from '@/lib/calendar-events';

export interface UpcomingStripDay {
  date: string;
  event: CalendarEvent | null;
}

export interface UpcomingStripProps {
  /** Next 7 days with optional event per day (null = Rest). */
  days: UpcomingStripDay[];
  /** ISO date for today (highlight active chip). */
  todayISO: string;
  /** Called when a day chip is clicked; event is null for Rest. */
  onDayClick: (date: string, event: CalendarEvent | null) => void;
}

function formatDayName(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('default', { weekday: 'short' });
}

function formatDateNum(iso: string): string {
  return new Date(iso + 'T12:00:00Z').getDate().toString();
}

const UpcomingStrip: React.FC<UpcomingStripProps> = ({ days, todayISO, onDayClick }) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {days.map(({ date, event }) => {
        const isToday = date === todayISO;
        return (
          <button
            key={date}
            type="button"
            onClick={() => onDayClick(date, event)}
            className={`min-w-[80px] shrink-0 rounded-2xl border px-3 py-3 text-left transition-colors ${
              isToday
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
            <p className="mt-1 truncate font-mono text-[10px] text-white/70">
              {event ? event.workoutTitle : 'Rest'}
            </p>
          </button>
        );
      })}
    </div>
  );
};

export default UpcomingStrip;
