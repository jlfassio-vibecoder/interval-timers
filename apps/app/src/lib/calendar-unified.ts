/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unified calendar events: program + AMRAP + timer logs + readiness in one list.
 */

import {
  getCalendarEventsForRange,
  type CalendarEvent,
  type ProgramForCalendar,
} from '@/lib/calendar-events';
import {
  getAmrapCompletedEventsForRange,
  getAmrapScheduledEventsForRange,
  getScheduledWorkoutEventsForRange,
  getTimerLogEventsForRange,
  getReadinessEventsForRange,
} from '@/lib/supabase/client/calendar-unified';

export type { CalendarEvent };

export interface GetUnifiedCalendarEventsOptions {
  programs: ProgramForCalendar[];
  loggedMap: Map<string, Set<string>>;
}

/**
 * Fetch all calendar events (program, AMRAP completed/scheduled, timer apps, readiness) for the range.
 * Merges and sorts by date ascending.
 */
export async function getUnifiedCalendarEvents(
  userId: string,
  rangeStart: string,
  rangeEnd: string,
  options: GetUnifiedCalendarEventsOptions
): Promise<CalendarEvent[]> {
  const { programs, loggedMap } = options;

  const [
    programEvents,
    amrapCompleted,
    amrapScheduled,
    scheduledWorkoutEvents,
    timerEvents,
    readinessEvents,
  ] = await Promise.all([
    Promise.resolve(getCalendarEventsForRange(rangeStart, rangeEnd, programs, loggedMap)),
    getAmrapCompletedEventsForRange(userId, rangeStart, rangeEnd),
    getAmrapScheduledEventsForRange(userId, rangeStart, rangeEnd),
    getScheduledWorkoutEventsForRange(userId, rangeStart, rangeEnd),
    getTimerLogEventsForRange(userId, rangeStart, rangeEnd),
    getReadinessEventsForRange(userId, rangeStart, rangeEnd),
  ]);

  const merged: CalendarEvent[] = [
    ...programEvents,
    ...amrapCompleted,
    ...amrapScheduled,
    ...scheduledWorkoutEvents,
    ...timerEvents,
    ...readinessEvents,
  ];

  return merged.sort((a, b) => a.date.localeCompare(b.date));
}
