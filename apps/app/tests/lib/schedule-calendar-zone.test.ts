/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  addDaysInScheduleZone,
  isDateInThisWeekInZone,
  sundayWeekStartContainingDateInZone,
  sundayWeekStartForInstantInZone,
  todayISOInZone,
} from '@/lib/schedule-calendar-zone';

describe('schedule-calendar-zone', () => {
  it('todayISOInZone returns calendar date in zone', () => {
    const ms = new Date('2026-06-16T07:00:00.000Z').getTime();
    expect(todayISOInZone('America/Los_Angeles', ms)).toBe('2026-06-16');
    expect(todayISOInZone('Asia/Tokyo', ms)).toBe('2026-06-16');
  });

  it('sundayWeekStartForInstantInZone returns Sunday for a Monday in Chicago', () => {
    const ms = new Date('2026-06-15T12:00:00.000Z').getTime();
    expect(sundayWeekStartForInstantInZone(ms, 'America/Chicago')).toBe('2026-06-14');
  });

  it('sundayWeekStartContainingDateInZone returns Sunday for mid-week date', () => {
    expect(sundayWeekStartContainingDateInZone('2026-06-17', 'UTC')).toBe('2026-06-14');
  });

  it('addDaysInScheduleZone adds calendar days', () => {
    expect(addDaysInScheduleZone('2026-06-14', 6, 'America/New_York')).toBe('2026-06-20');
  });

  it('isDateInThisWeekInZone is true for dates inside Sun–Sat strip', () => {
    const ms = new Date('2026-06-16T12:00:00.000Z').getTime();
    expect(isDateInThisWeekInZone('2026-06-14', ms, 'UTC')).toBe(true);
    expect(isDateInThisWeekInZone('2026-06-20', ms, 'UTC')).toBe(true);
    expect(isDateInThisWeekInZone('2026-06-13', ms, 'UTC')).toBe(false);
    expect(isDateInThisWeekInZone('2026-06-21', ms, 'UTC')).toBe(false);
  });
});
