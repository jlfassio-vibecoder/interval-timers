/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  calendarDateInZone,
  formatTimeInZone,
  localDateTimeToUtcIso,
  reschedulePreservingViewerLocalTime,
  timeHmInZone,
  uniqueMondaysForDatesInZone,
} from '@/lib/performance-lab/trainer-calendar-time';

describe('trainer-calendar-time', () => {
  it('formats the same instant as 7:00 AM PT and 9:00 AM CT in June (DST)', () => {
    const iso = '2026-06-15T14:00:00.000Z';
    expect(formatTimeInZone(iso, 'America/Los_Angeles')).toMatch(/7:00/);
    expect(formatTimeInZone(iso, 'America/Chicago')).toMatch(/9:00/);
  });

  it('timeHmInZone returns HH:mm for time inputs (Pacific)', () => {
    const iso = '2026-06-15T14:00:00.000Z';
    expect(timeHmInZone(iso, 'America/Los_Angeles')).toBe('07:00');
  });

  it('maps viewer-local wall time to UTC (summer Pacific)', () => {
    const utc = localDateTimeToUtcIso('2026-06-15', '07:00', 'America/Los_Angeles');
    expect(utc).toBe('2026-06-15T14:00:00.000Z');
  });

  it('preserves viewer local time when moving to another calendar day', () => {
    const moved = reschedulePreservingViewerLocalTime(
      '2026-06-15T14:00:00.000Z',
      '2026-06-17',
      'America/Los_Angeles',
      '07:00'
    );
    expect(moved).toBe('2026-06-17T14:00:00.000Z');
  });

  it('groups coach instances by viewer-local date near UTC midnight', () => {
    const iso = '2026-06-16T06:00:00.000Z';
    expect(calendarDateInZone(iso, 'America/Los_Angeles')).toBe('2026-06-15');
    expect(calendarDateInZone(iso, 'UTC')).toBe('2026-06-16');
  });

  it('uniqueMondaysForDatesInZone returns one Monday for a single week strip', () => {
    const mondays = uniqueMondaysForDatesInZone(
      [
        '2026-06-15',
        '2026-06-16',
        '2026-06-17',
        '2026-06-18',
        '2026-06-19',
        '2026-06-20',
        '2026-06-21',
      ],
      'America/Chicago'
    );
    expect(mondays).toEqual(['2026-06-15']);
  });
});
