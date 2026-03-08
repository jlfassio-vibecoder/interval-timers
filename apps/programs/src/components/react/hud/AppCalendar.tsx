/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Native in-app calendar: month view with program workouts as events.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { fetchUserPrograms, getProgramWithSchedule } from '@/lib/supabase/client/user-programs';
import type { ProgramForCalendar } from '@/lib/calendar-events';
import {
  getCalendarEventsForRange,
  getMonthRange,
  type CalendarEvent,
} from '@/lib/calendar-events';

export interface AppCalendarProps {
  /** When changed, calendar refetches synced programs and events (only when events is not provided). */
  refreshKey?: number;
  /** When provided, use these events instead of fetching (e.g. from ScheduleZone). */
  events?: CalendarEvent[];
  /** When provided, event rows are clickable and this is called on click. */
  onEventClick?: (event: CalendarEvent) => void;
  /** When provided, called when user navigates to another month (so parent can refetch). */
  onMonthChange?: (year: number, month: number) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDaysInMonth(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const startPad = first.getDay();
  const days: (Date | null)[] = Array(startPad).fill(null);
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month - 1, d));
  }
  return days;
}

function dateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const STATUS_STYLES: Record<CalendarEvent['status'], { border: string; bg: string; text: string }> =
  {
    scheduled: {
      border: 'border-orange-light',
      bg: 'bg-orange-light/10',
      text: 'text-orange-light',
    },
    completed: { border: 'border-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
    missed: { border: 'border-white/30', bg: 'bg-white/5', text: 'text-white/50' },
  };

const AppCalendar: React.FC<AppCalendarProps> = ({
  refreshKey = 0,
  events: eventsProp,
  onEventClick,
  onMonthChange,
}) => {
  const { user } = useAppContext();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [internalEvents, setInternalEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const events = eventsProp ?? internalEvents;

  useEffect(() => {
    if (eventsProp !== undefined) {
      setLoading(false);
      return;
    }
    if (!user?.uid) {
      setInternalEvents([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const accessList = await fetchUserPrograms(user.uid);
        const withStart = accessList.filter((a) => a.startDate);
        const programResults = await Promise.all(
          withStart.map(async (a) => {
            const prog = await getProgramWithSchedule(a.programId);
            if (prog && a.startDate) {
              return {
                programId: prog.programId,
                title: prog.title,
                startDate: a.startDate,
                schedule: prog.schedule,
              } as ProgramForCalendar;
            }
            return null;
          })
        );
        const programs = programResults.filter((p): p is ProgramForCalendar => p !== null);
        if (cancelled) return;
        const { start, end } = getMonthRange(year, month);
        const ev = getCalendarEventsForRange(start, end, programs);
        setInternalEvents(ev);
      } catch (e) {
        if (import.meta.env.DEV) console.error('[AppCalendar]', e);
        if (!cancelled) setInternalEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, year, month, refreshKey, eventsProp]);

  const days = useMemo(() => getDaysInMonth(year, month), [year, month]);
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return map;
  }, [events]);

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => {
        const newY = y - 1;
        onMonthChange?.(newY, 12);
        return newY;
      });
    } else {
      setMonth((m) => {
        const newM = m - 1;
        onMonthChange?.(year, newM);
        return newM;
      });
    }
  };
  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => {
        const newY = y + 1;
        onMonthChange?.(newY, 1);
        return newY;
      });
    } else {
      setMonth((m) => {
        const newM = m + 1;
        onMonthChange?.(year, newM);
        return newM;
      });
    }
  };
  const monthLabel = `${new Date(year, month - 1).toLocaleString('default', { month: 'long' })} ${year}`;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm md:p-8">
      <div className="border-orange-light/20 mb-4 flex items-center justify-between border-b pb-4">
        <h4 className="font-mono text-[10px] uppercase tracking-[0.4em] text-orange-light">
          Calendar
        </h4>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-white transition-colors hover:bg-white/10"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[140px] text-center font-heading text-sm font-black uppercase text-white">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-white transition-colors hover:bg-white/10"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center font-mono text-[10px] uppercase text-white/40">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-px border border-white/10 bg-white/5">
            {WEEKDAYS.map((wd) => (
              <div
                key={wd}
                className="bg-bg-dark py-2 text-center font-mono text-[10px] uppercase text-white/50"
              >
                {wd}
              </div>
            ))}
            {days.map((d, i) => {
              const iso = d ? dateToISO(d) : '';
              const dayEvents: CalendarEvent[] = iso ? (eventsByDate.get(iso) ?? []) : [];
              return (
                <div
                  key={i}
                  className="min-h-[80px] border border-white/5 bg-bg-dark p-1 md:min-h-[100px]"
                >
                  {d ? (
                    <>
                      <span className="font-mono text-[10px] text-white/60">{d.getDate()}</span>
                      <ul className="mt-1 space-y-0.5">
                        {dayEvents.slice(0, 3).map((ev: CalendarEvent, j: number) => {
                          const style = STATUS_STYLES[ev.status];
                          return (
                            <li
                              key={j}
                              role={onEventClick ? 'button' : undefined}
                              tabIndex={onEventClick ? 0 : undefined}
                              className={`truncate rounded border-l-2 px-1 py-0.5 font-mono text-[9px] ${style.border} ${style.bg} ${style.text} ${onEventClick ? 'cursor-pointer hover:opacity-90' : ''}`}
                              title={`${ev.workoutTitle} — ${ev.programTitle}`}
                              onClick={onEventClick ? () => onEventClick(ev) : undefined}
                              onKeyDown={
                                onEventClick
                                  ? (e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        onEventClick(ev);
                                      }
                                    }
                                  : undefined
                              }
                            >
                              {ev.workoutTitle}
                            </li>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <li className="font-mono text-[9px] text-white/40">
                            +{dayEvents.length - 3} more
                          </li>
                        )}
                      </ul>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
          {events.length === 0 && !loading && (
            <p className="mt-4 text-center text-sm italic text-white/40">
              No workouts on calendar. Sync a program from Saved Programs.
            </p>
          )}
        </>
      )}
    </section>
  );
};

export default AppCalendar;
