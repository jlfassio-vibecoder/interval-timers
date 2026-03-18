/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Default display order for calendar event types and sort helper (Phase 5.9).
 */

import type { CalendarEvent, CalendarEventType } from '@/lib/calendar-events';

/** Default order when user has not set a preference. Matches MultiActivityDayDrawer TYPE_ORDER. */
export const DEFAULT_EVENT_TYPE_ORDER: CalendarEventType[] = [
  'program',
  'amrap',
  'amrap_scheduled',
  'timer',
  'timer_scheduled',
  'readiness',
];

/**
 * Sort events by type order. Types not in typeOrder get rank after all listed types.
 * Stable sort.
 */
export function sortEventsByTypeOrder(
  events: CalendarEvent[],
  typeOrder: CalendarEventType[]
): CalendarEvent[] {
  const rank = new Map<CalendarEventType, number>();
  typeOrder.forEach((t, i) => rank.set(t, i));
  const getRank = (t: CalendarEventType): number => rank.get(t) ?? typeOrder.length;

  return [...events].sort((a, b) => getRank(a.type) - getRank(b.type));
}
