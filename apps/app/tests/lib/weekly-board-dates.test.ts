/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  addDaysDateOnly,
  isLocalMondayDateOnly,
  isScheduledDateInWeek,
  isValidDateOnly,
  mondayOfWeekContainingLocal,
  rollingSevenDatesEndingToday,
  truncateCardTitle,
  uniqueMondaysForDates,
} from '@/lib/performance-lab/weekly-board-dates';

describe('weekly-board-dates', () => {
  it('isValidDateOnly', () => {
    expect(isValidDateOnly('2026-04-06')).toBe(true);
    expect(isValidDateOnly('2026-4-6')).toBe(false);
    expect(isValidDateOnly('')).toBe(false);
    expect(isValidDateOnly('2026-02-30')).toBe(false);
    expect(isValidDateOnly('2026-13-01')).toBe(false);
  });

  it('isLocalMondayDateOnly', () => {
    expect(isLocalMondayDateOnly('2026-04-06')).toBe(true);
    expect(isLocalMondayDateOnly('2026-04-07')).toBe(false);
  });

  it('mondayOfWeekContainingLocal — Wednesday → that week Monday', () => {
    const wed = new Date(2026, 3, 8); // Apr 8 2026 = Wed
    expect(mondayOfWeekContainingLocal(wed)).toBe('2026-04-06');
  });

  it('mondayOfWeekContainingLocal — Sunday → previous Monday', () => {
    const sun = new Date(2026, 3, 12); // Apr 12 2026 = Sun
    expect(mondayOfWeekContainingLocal(sun)).toBe('2026-04-06');
  });

  it('isScheduledDateInWeek', () => {
    expect(isScheduledDateInWeek('2026-04-08', '2026-04-06')).toBe(true);
    expect(isScheduledDateInWeek('2026-04-12', '2026-04-06')).toBe(true);
    expect(isScheduledDateInWeek('2026-04-13', '2026-04-06')).toBe(false);
    expect(isScheduledDateInWeek('2026-04-05', '2026-04-06')).toBe(false);
  });

  it('addDaysDateOnly', () => {
    expect(addDaysDateOnly('2026-04-06', 1)).toBe('2026-04-07');
    expect(addDaysDateOnly('2026-04-06', -1)).toBe('2026-04-05');
  });

  it('rollingSevenDatesEndingToday returns 7 dates', () => {
    const fixed = new Date(2026, 3, 8, 15, 0, 0);
    const dates = rollingSevenDatesEndingToday(fixed);
    expect(dates).toHaveLength(7);
    expect(dates[6]).toBe('2026-04-08');
    expect(dates[0]).toBe('2026-04-02');
  });

  it('uniqueMondaysForDates spans two weeks when needed', () => {
    const mons = uniqueMondaysForDates(['2026-04-05', '2026-04-06']);
    expect(mons.sort()).toEqual(['2026-03-30', '2026-04-06']);
  });

  it('truncateCardTitle', () => {
    expect(truncateCardTitle('short')).toBe('short');
    expect(truncateCardTitle('01234567890123456789')).toBe('01234567890123456789');
    expect(truncateCardTitle('this is longer than twenty')).toBe(
      `${'this is longer than twenty'.slice(0, 20)}…`
    );
  });
});
