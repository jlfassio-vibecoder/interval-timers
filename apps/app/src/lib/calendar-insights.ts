/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Aggregated stats from calendar events for day tooltips and summaries.
 */

import type { CalendarEvent } from '@/lib/calendar-events';

export interface DayInsights {
  count: number;
  totalMinutes: number;
  avgEffort: number | null;
}

/**
 * Aggregate count, total duration, and average effort from a day's calendar events.
 * Duration from metadata.durationSeconds and metadata.durationMinutes; effort from metadata.effort (timer events).
 */
export function getDayInsights(events: CalendarEvent[]): DayInsights {
  let totalMinutes = 0;
  const efforts: number[] = [];
  for (const ev of events) {
    const m = ev.metadata;
    if (m?.durationSeconds != null) totalMinutes += m.durationSeconds / 60;
    if (m?.durationMinutes != null) totalMinutes += m.durationMinutes;
    if (m?.effort != null && Number.isFinite(m.effort)) efforts.push(m.effort);
  }
  const avgEffort = efforts.length > 0 ? efforts.reduce((a, b) => a + b, 0) / efforts.length : null;
  return {
    count: events.length,
    totalMinutes: Math.round(totalMinutes),
    avgEffort: avgEffort != null ? Math.round(avgEffort * 10) / 10 : null,
  };
}

/**
 * Build tooltip string for a day's events, e.g. "3 workouts, 90 min total, avg effort 7/10".
 */
export function formatDayTooltip(events: CalendarEvent[]): string {
  if (events.length === 0) return '';
  const { count, totalMinutes, avgEffort } = getDayInsights(events);
  const workoutLabel = count === 1 ? 'workout' : 'workouts';
  const parts = [`${count} ${workoutLabel}`];
  if (totalMinutes > 0) parts.push(`${totalMinutes} min total`);
  if (avgEffort != null) parts.push(`avg effort ${avgEffort}/10`);
  return parts.join(', ');
}
