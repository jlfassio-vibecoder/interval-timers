/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Schedule Zone: calendar with log markers + click-to-open drawer + 7-day upcoming strip.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { fetchUserPrograms, getProgramWithSchedule } from '@/lib/supabase/client/user-programs';
import { getLoggedDatesForCalendar } from '@/lib/supabase/client/calendar-completion';
import {
  getCalendarEventsForRange,
  getMonthRange,
  type CalendarEvent,
  type ProgramForCalendar,
} from '@/lib/calendar-events';
import AppCalendar from './AppCalendar';
import UpcomingStrip from './UpcomingStrip';
import type { UpcomingStripDay } from './UpcomingStrip';
import WorkoutEventDrawer from './WorkoutEventDrawer';
import WorkoutPlayer from '@/components/react/tracking/WorkoutPlayer';
import { getAmrapScheduledSessionsForUser } from '@/lib/supabase/client/amrap-scheduled-sessions';
import type { ProgramSchedule } from '@/types/ai-program';

function getAmrapWorkoutLabel(workoutList: string[]): string {
  return workoutList?.[0]?.trim() ?? 'AMRAP';
}

type WorkoutFromSchedule = ProgramSchedule['workouts'][number];

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface ScheduleZoneProps {
  /** When changed, refetches programs and events. */
  refreshKey?: number;
  /** Called when user taps View Log on a completed calendar event (scroll to History Zone). */
  onViewLog?: () => void;
}

const ScheduleZone: React.FC<ScheduleZoneProps> = ({ refreshKey = 0, onViewLog }) => {
  const { user, activeProgramId } = useAppContext();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [_programs, setPrograms] = useState<ProgramForCalendar[]>([]);
  const [monthEvents, setMonthEvents] = useState<CalendarEvent[]>([]);
  const [stripDays, setStripDays] = useState<UpcomingStripDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [workoutPlayer, setWorkoutPlayer] = useState<{
    workout: WorkoutFromSchedule;
    programId: string;
    weekId: string;
    workoutId: string;
  } | null>(null);
  const [restDayMessage, setRestDayMessage] = useState<string | null>(null);
  const [amrapSessions, setAmrapSessions] = useState<
    Array<{
      id: string;
      workout_list: string[];
      duration_minutes: number;
      scheduled_start_at: string;
    }>
  >([]);

  const today = todayISO();

  const loadPrograms = useCallback(async () => {
    if (!user?.uid) return [];
    const accessList = await fetchUserPrograms(user.uid);
    const withStart = accessList.filter((a) => a.startDate);
    const results = await Promise.all(
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
    return results.filter((p): p is ProgramForCalendar => p !== null);
  }, [user?.uid]);

  const loadMonth = useCallback(
    async (
      y: number,
      m: number,
      progList: ProgramForCalendar[],
      loggedMap: Map<string, Set<string>>
    ) => {
      const { start, end } = getMonthRange(y, m);
      return getCalendarEventsForRange(start, end, progList, loggedMap);
    },
    []
  );

  const loadStrip = useCallback(
    async (progList: ProgramForCalendar[], loggedMap: Map<string, Set<string>>) => {
      const start = today;
      const end = addDays(today, 6);
      const events = getCalendarEventsForRange(start, end, progList, loggedMap);
      const eventsByDate = new Map<string, CalendarEvent[]>();
      for (const e of events) {
        const list = eventsByDate.get(e.date) ?? [];
        list.push(e);
        eventsByDate.set(e.date, list);
      }
      const days: UpcomingStripDay[] = [];
      for (let i = 0; i < 7; i++) {
        const date = addDays(today, i);
        const list = eventsByDate.get(date) ?? [];
        const event =
          activeProgramId != null
            ? (list.find((e) => e.programId === activeProgramId) ?? list[0] ?? null)
            : (list[0] ?? null);
        days.push({ date, event: event ?? null });
      }
      return days;
    },
    [today, activeProgramId]
  );

  useEffect(() => {
    if (!user?.uid) {
      setPrograms([]);
      setMonthEvents([]);
      setStripDays([]);
      setAmrapSessions([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const progList = await loadPrograms();
        if (cancelled) return;
        setPrograms(progList);
        const { start: monthStart, end: monthEnd } = getMonthRange(year, month);
        const stripEnd = addDays(today, 6);
        const rangeStart = monthStart < today ? monthStart : today;
        const rangeEnd = monthEnd > stripEnd ? monthEnd : stripEnd;
        const loggedMap = await getLoggedDatesForCalendar(user.uid, rangeStart, rangeEnd);
        if (cancelled) return;
        const [monthEv, strip] = await Promise.all([
          loadMonth(year, month, progList, loggedMap),
          loadStrip(progList, loggedMap),
        ]);
        if (cancelled) return;
        setMonthEvents(monthEv);
        setStripDays(strip);
        const amrap = await getAmrapScheduledSessionsForUser(user.uid, rangeStart, rangeEnd);
        if (!cancelled) setAmrapSessions(amrap);
      } catch (e) {
        if (import.meta.env.DEV) console.error('[ScheduleZone]', e);
        if (!cancelled) {
          setMonthEvents([]);
          setStripDays([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, year, month, today, refreshKey, loadPrograms, loadMonth, loadStrip]);

  const handleMonthChange = useCallback((newYear: number, newMonth: number) => {
    setYear(newYear);
    setMonth(newMonth);
  }, []);

  const handleDayClick = useCallback((date: string, event: CalendarEvent | null) => {
    if (event) {
      setSelectedEvent(event);
    } else {
      setRestDayMessage('Rest day — focus on recovery.');
      setTimeout(() => setRestDayMessage(null), 3000);
    }
  }, []);

  const handleStartWorkout = useCallback(
    (workout: WorkoutFromSchedule, programId: string, weekId: string, workoutId: string) => {
      setSelectedEvent(null);
      setWorkoutPlayer({ workout, programId, weekId, workoutId });
    },
    []
  );

  return (
    <div>
      <AppCalendar
        refreshKey={refreshKey}
        events={monthEvents}
        onEventClick={(ev) => setSelectedEvent(ev)}
        onMonthChange={handleMonthChange}
      />
      {!loading && stripDays.length > 0 && (
        <div className="mt-6">
          <h4 className="mb-3 font-mono text-[10px] uppercase tracking-[0.4em] text-orange-light">
            Next 7 days
          </h4>
          <UpcomingStrip days={stripDays} todayISO={today} onDayClick={handleDayClick} />
        </div>
      )}
      {!loading && amrapSessions.length > 0 && (
        <div className="mt-6">
          <h4 className="mb-3 font-mono text-[10px] uppercase tracking-[0.4em] text-orange-light">
            AMRAP With Friends
          </h4>
          <ul className="space-y-2">
            {amrapSessions.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
              >
                <span className="font-medium text-white/90">
                  {getAmrapWorkoutLabel(s.workout_list)}
                </span>
                <span className="ml-2 text-white/60">{s.duration_minutes} min</span>
                <span className="ml-2 font-mono text-[10px] text-white/40">
                  {new Date(s.scheduled_start_at).toLocaleString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
                <a
                  href={`/amrap/with-friends/session/${s.id}`}
                  className="text-orange-400 ml-2 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {restDayMessage && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-mono text-[10px] text-white/70">
          {restDayMessage}
        </div>
      )}
      {selectedEvent && (
        <WorkoutEventDrawer
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onStartWorkout={handleStartWorkout}
          onViewLog={onViewLog}
        />
      )}
      {workoutPlayer && (
        <WorkoutPlayer
          workout={workoutPlayer.workout}
          programId={workoutPlayer.programId}
          weekId={workoutPlayer.weekId}
          workoutId={workoutPlayer.workoutId}
          onClose={() => setWorkoutPlayer(null)}
          onComplete={() => setWorkoutPlayer(null)}
        />
      )}
    </div>
  );
};

export default ScheduleZone;
