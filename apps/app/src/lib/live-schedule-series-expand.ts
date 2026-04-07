/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * P1: Weekly materialization for scheduled live series (Luxon).
 */

import { DateTime } from 'luxon';

/** JavaScript Sunday=0 .. Saturday=6 (Date.getDay). */
export function luxonWeekdayToJs(luxonWeekday: number): number {
  return luxonWeekday === 7 ? 0 : luxonWeekday;
}

export function seriesMetaFromFirstSlot(
  firstStartUtcIso: string,
  firstEndUtcIso: string,
  ianaTimezone: string
): {
  weekday: number;
  durationMinutes: number;
  localStartTime: string;
  ianaTimezone: string;
} {
  const startUtc = DateTime.fromISO(firstStartUtcIso, { zone: 'utc' });
  const endUtc = DateTime.fromISO(firstEndUtcIso, { zone: 'utc' });
  const dur = endUtc.diff(startUtc, 'minutes').minutes;
  if (!Number.isFinite(dur) || dur <= 0) {
    throw new Error('Invalid first slot duration');
  }
  const z = startUtc.setZone(ianaTimezone);
  const weekday = luxonWeekdayToJs(z.weekday);
  const localStartTime = z.toFormat('HH:mm:ss');
  return {
    weekday,
    durationMinutes: Math.round(dur),
    localStartTime,
    ianaTimezone,
  };
}

/**
 * Materialize N weekly slots starting from the first occurrence wall time in `ianaTimezone`.
 */
export function expandWeeklyOccurrenceSlots(
  firstStartUtcIso: string,
  firstEndUtcIso: string,
  ianaTimezone: string,
  weeks: number
): Array<{ scheduledStartAt: string; scheduledEndAt: string }> {
  const startUtc = DateTime.fromISO(firstStartUtcIso, { zone: 'utc' });
  const endUtc = DateTime.fromISO(firstEndUtcIso, { zone: 'utc' });
  const durMin = endUtc.diff(startUtc, 'minutes').minutes;
  if (!Number.isFinite(durMin) || durMin <= 0) {
    throw new Error('Invalid slot duration');
  }
  const zStart = startUtc.setZone(ianaTimezone);
  const out: Array<{ scheduledStartAt: string; scheduledEndAt: string }> = [];
  const safeWeeks = Math.max(1, Math.min(104, Math.floor(weeks)));
  for (let i = 0; i < safeWeeks; i++) {
    const s = zStart.plus({ weeks: i });
    const e = s.plus({ minutes: durMin });
    out.push({
      scheduledStartAt: s.toUTC().toISO()!,
      scheduledEndAt: e.toUTC().toISO()!,
    });
  }
  return out;
}
