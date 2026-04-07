/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Client HUD schedule: calendar dates and Sun–Sat weeks in a chosen IANA zone.
 */

import { DateTime } from 'luxon';
import { addCalendarDaysInZone, safeIanaZone } from '@/lib/performance-lab/trainer-calendar-time';

/** Calendar date (YYYY-MM-DD) for `now` in `zone`. */
export function todayISOInZone(zone: string, nowMs: number = Date.now()): string {
  const z = safeIanaZone(zone);
  const iso = DateTime.fromMillis(nowMs, { zone: z }).toISODate();
  return iso ?? DateTime.utc().toISODate()!;
}

/**
 * Sunday (inclusive) start of the week containing `nowMs` in `zone`.
 * Week strip is Sun–Sat to match existing HUD week views.
 */
export function sundayWeekStartForInstantInZone(nowMs: number, zone: string): string {
  const z = safeIanaZone(zone);
  const dt = DateTime.fromMillis(nowMs, { zone: z });
  if (!dt.isValid) return todayISOInZone(zone, nowMs);
  const wd = dt.weekday;
  const daysBack = wd === 7 ? 0 : wd;
  const sun = dt.minus({ days: daysBack });
  return sun.toISODate() ?? dt.toISODate()!;
}

export function sundayWeekStartContainingDateInZone(dateYmd: string, zone: string): string {
  const z = safeIanaZone(zone);
  const dt = DateTime.fromISO(dateYmd, { zone: z });
  if (!dt.isValid) return dateYmd.slice(0, 10);
  const wd = dt.weekday;
  const daysBack = wd === 7 ? 0 : wd;
  return dt.minus({ days: daysBack }).toISODate()!;
}

/** Add calendar days to a date-only string in `zone` (DST-safe). */
export function addDaysInScheduleZone(isoDate: string, days: number, zone: string): string {
  return addCalendarDaysInZone(isoDate.slice(0, 10), days, zone);
}

/** True if `dateYmd` falls in the Sun–Sat week containing `nowMs` in `zone`. */
export function isDateInThisWeekInZone(dateYmd: string, nowMs: number, zone: string): boolean {
  const start = sundayWeekStartForInstantInZone(nowMs, zone);
  const end = addDaysInScheduleZone(start, 6, zone);
  const d = dateYmd.slice(0, 10);
  return d >= start && d <= end;
}
