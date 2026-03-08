/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Compute calendar events from program schedule + start date (MVP: consecutive days).
 */

import type { ProgramSchedule } from '@/types/ai-program';

export type CalendarEventStatus = 'scheduled' | 'completed' | 'missed';

export interface CalendarEvent {
  date: string;
  programId: string;
  programTitle: string;
  weekNumber: number;
  workoutTitle: string;
  workoutIndex: number;
  /** For WorkoutPlayer; matches week-${weekNumber} and String(workoutIndex). */
  workoutId: string;
  weekId: string;
  status: CalendarEventStatus;
}

export interface ProgramForCalendar {
  programId: string;
  title: string;
  startDate: string;
  schedule: ProgramSchedule[];
}

/**
 * Parse ISO YYYY-MM-DD and add days.
 */
function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Composite key for completion lookup: programId:weekId:workoutId */
export function eventCompletionKey(
  ev: Pick<CalendarEvent, 'programId' | 'weekId' | 'workoutId'>
): string {
  return `${ev.programId}:${ev.weekId}:${ev.workoutId}`;
}

const todayISO = (): string => new Date().toISOString().slice(0, 10);

/**
 * Generate all calendar events for the given programs (with startDate and schedule) that fall within [rangeStart, rangeEnd].
 * MVP mapping: Week 1 Day 1 = startDate, Week 1 Day 2 = startDate + 1, ... (consecutive calendar days).
 * When loggedDates is provided, sets status: completed if key in set, missed if date < today, else scheduled.
 */
export function getCalendarEventsForRange(
  rangeStart: string,
  rangeEnd: string,
  programs: ProgramForCalendar[],
  loggedDates?: Map<string, Set<string>>
): CalendarEvent[] {
  const today = todayISO();
  const events: CalendarEvent[] = [];
  for (const program of programs) {
    const { programId, title, startDate, schedule } = program;
    let globalDayOffset = 0;
    for (const week of [...schedule].sort((a, b) => a.weekNumber - b.weekNumber)) {
      for (let i = 0; i < week.workouts.length; i++) {
        const date = addDays(startDate, globalDayOffset);
        globalDayOffset += 1;
        if (date >= rangeStart && date <= rangeEnd) {
          const weekId = `week-${week.weekNumber}`;
          const workoutId = String(i);
          const key = `${programId}:${weekId}:${workoutId}`;
          let status: CalendarEventStatus = 'scheduled';
          if (loggedDates) {
            if (loggedDates.get(date)?.has(key)) status = 'completed';
            else if (date < today) status = 'missed';
          }
          events.push({
            date,
            programId,
            programTitle: title,
            weekNumber: week.weekNumber,
            workoutTitle: week.workouts[i]?.title ?? `Workout ${i + 1}`,
            workoutIndex: i,
            workoutId,
            weekId,
            status,
          });
        }
      }
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get start and end of month as ISO YYYY-MM-DD.
 */
export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}
