/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Mission Control Performance Lab calendar: zoned wall times for coach scheduling vs client display.
 */

import { DateTime } from 'luxon';

/** Normalize IANA id; fall back to UTC if invalid. */
export function safeIanaZone(zone: string | undefined | null): string {
  const z = typeof zone === 'string' && zone.trim() ? zone.trim() : 'UTC';
  const probe = DateTime.now().setZone(z);
  return probe.isValid ? z : 'UTC';
}

/** Monday 00:00 calendar date (YYYY-MM-DD) of the week containing `nowMs`, in `zone`. */
export function mondayOfWeekForZone(nowMs: number, zone: string): string {
  const z = safeIanaZone(zone);
  const dt = DateTime.fromMillis(nowMs, { zone: z });
  if (!dt.isValid) return DateTime.utc().toISODate()!;
  const monday = dt.minus({ days: dt.weekday - 1 });
  return monday.toISODate()!;
}

/** Add calendar days to a date-only string in a specific zone (DST-safe). */
export function addCalendarDaysInZone(dateYmd: string, days: number, zone: string): string {
  const z = safeIanaZone(zone);
  const dt = DateTime.fromISO(dateYmd, { zone: z });
  if (!dt.isValid) return dateYmd;
  return dt.plus({ days }).toISODate()!;
}

/** Seven consecutive calendar days starting Monday `mondayYmd` in `zone`. */
export function weekDayListFromMonday(mondayYmd: string, zone: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addCalendarDaysInZone(mondayYmd, i, zone));
}

/** YYYY-MM-DD for the instant in the given IANA zone. */
export function calendarDateInZone(isoUtc: string, zone: string): string {
  const z = safeIanaZone(zone);
  const dt = DateTime.fromISO(isoUtc, { setZone: true });
  if (!dt.isValid) return isoUtc.slice(0, 10);
  return dt.setZone(z).toISODate()!;
}

/** Distinct week-start Mondays (ISO Mon–Sun weeks) for each date, interpreted in `zone`. */
export function uniqueMondaysForDatesInZone(dates: string[], zone: string): string[] {
  const z = safeIanaZone(zone);
  const set = new Set<string>();
  for (const d of dates) {
    const dt = DateTime.fromISO(d, { zone: z });
    if (!dt.isValid) continue;
    const monday = dt.minus({ days: dt.weekday - 1 });
    const iso = monday.toISODate();
    if (iso) set.add(iso);
  }
  return [...set];
}

/**
 * Wall clock in `zone` at `dateYmd` + `timeHm` ("HH:mm") → UTC ISO string for APIs.
 */
export function localDateTimeToUtcIso(dateYmd: string, timeHm: string, zone: string): string {
  const z = safeIanaZone(zone);
  const [ys, ms, ds] = dateYmd.split('-').map(Number);
  const [hh, mm] = timeHm.split(':').map((x) => parseInt(x, 10));
  const hour = Number.isFinite(hh) ? hh : 0;
  const minute = Number.isFinite(mm) ? mm : 0;
  const dt = DateTime.fromObject(
    {
      year: ys,
      month: ms,
      day: ds,
      hour,
      minute,
      second: 0,
      millisecond: 0,
    },
    { zone: z }
  );
  if (!dt.isValid) {
    return DateTime.utc().toISO()!;
  }
  return dt.toUTC().toISO()!;
}

/** Move to `newDateYmd` in viewer zone while preserving local time-of-day; fallback time if parse fails. */
export function reschedulePreservingViewerLocalTime(
  scheduledAtIso: string,
  newDateYmd: string,
  viewerZone: string,
  fallbackTimeHm: string
): string {
  const z = safeIanaZone(viewerZone);
  const prev = DateTime.fromISO(scheduledAtIso, { setZone: true });
  if (!prev.isValid) {
    return localDateTimeToUtcIso(newDateYmd, fallbackTimeHm, z);
  }
  const inViewer = prev.setZone(z);
  const hour = inViewer.hour;
  const minute = inViewer.minute;
  const second = inViewer.second;
  const millisecond = inViewer.millisecond;
  const [ys, ms, ds] = newDateYmd.split('-').map(Number);
  const next = DateTime.fromObject(
    { year: ys, month: ms, day: ds, hour, minute, second, millisecond },
    { zone: z }
  );
  if (!next.isValid) {
    return localDateTimeToUtcIso(newDateYmd, fallbackTimeHm, z);
  }
  return next.toUTC().toISO()!;
}

export function formatTimeInZone(isoUtc: string, zone: string): string {
  const dt = DateTime.fromISO(isoUtc, { setZone: true });
  if (!dt.isValid) return '';
  return dt.setZone(safeIanaZone(zone)).toFormat('h:mm a');
}

/** 24h `HH:mm` in `zone` for `<input type="time" />`. */
export function timeHmInZone(isoUtc: string, zone: string): string {
  const dt = DateTime.fromISO(isoUtc, { setZone: true });
  if (!dt.isValid) return '07:00';
  return dt.setZone(safeIanaZone(zone)).toFormat('HH:mm');
}

/** Short zone label e.g. "PDT", "CDT" for badge context. */
export function shortZoneName(isoUtc: string, zone: string): string {
  const dt = DateTime.fromISO(isoUtc, { setZone: true });
  if (!dt.isValid) return '';
  return dt.setZone(safeIanaZone(zone)).toFormat('z');
}
