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
import { getLiveScheduledCalendarEventsForRange } from '@/lib/supabase/client/live-scheduled-calendar';
import { getClientCoachScheduleLiveEventsForRange } from '@/lib/supabase/client/coach-schedule-live';

export type { CalendarEvent };

export interface GetUnifiedCalendarEventsOptions {
  programs: ProgramForCalendar[];
  loggedMap: Map<string, Set<string>>;
  /** When set (IANA), scheduled live session invites are merged using this zone for calendar day keys. */
  displayTimeZone?: string;
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
  const { programs, loggedMap, displayTimeZone } = options;

  const tz =
    typeof displayTimeZone === 'string' && displayTimeZone.trim().length > 0
      ? displayTimeZone.trim()
      : null;
  const liveScheduledPromise = tz
    ? getLiveScheduledCalendarEventsForRange(userId, rangeStart, rangeEnd, tz)
    : Promise.resolve([] as CalendarEvent[]);
  const coachLivePromise = tz
    ? getClientCoachScheduleLiveEventsForRange(userId, rangeStart, rangeEnd, tz)
    : Promise.resolve([] as CalendarEvent[]);

  const [
    programEvents,
    amrapCompleted,
    amrapScheduled,
    scheduledWorkoutEvents,
    timerEvents,
    readinessEvents,
    liveScheduledEvents,
    coachLiveEvents,
  ] = await Promise.all([
    Promise.resolve(getCalendarEventsForRange(rangeStart, rangeEnd, programs, loggedMap)),
    getAmrapCompletedEventsForRange(userId, rangeStart, rangeEnd),
    getAmrapScheduledEventsForRange(userId, rangeStart, rangeEnd),
    getScheduledWorkoutEventsForRange(userId, rangeStart, rangeEnd),
    getTimerLogEventsForRange(userId, rangeStart, rangeEnd),
    getReadinessEventsForRange(userId, rangeStart, rangeEnd),
    liveScheduledPromise,
    coachLivePromise,
  ]);

  const merged: CalendarEvent[] = [
    ...programEvents,
    ...amrapCompleted,
    ...amrapScheduled,
    ...scheduledWorkoutEvents,
    ...timerEvents,
    ...readinessEvents,
    ...liveScheduledEvents,
    ...coachLiveEvents,
  ];

  return merged.sort((a, b) => a.date.localeCompare(b.date));
}
