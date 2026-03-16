/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit tests for engagement analytics windowing (WAU/MAU cutoffs, date keys).
 * Guards against regressions in date-only comparison and boundary handling.
 */

import { describe, expect, it } from 'vitest';

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function computeWauMauCutoffs(toDate: Date): { from7: string; from30: string } {
  const sevenDaysAgo = new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  return {
    from7: dateKey(sevenDaysAgo),
    from30: dateKey(thirtyDaysAgo),
  };
}

function countInWindow(
  dauByDayMap: Map<string, Set<string>>,
  from7: string,
  from30: string
): { wau: number; mau: number } {
  let wauSet = new Set<string>();
  let mauSet = new Set<string>();
  for (const [date, set] of dauByDayMap) {
    if (date >= from7) set.forEach((u) => wauSet.add(u));
    if (date >= from30) set.forEach((u) => mauSet.add(u));
  }
  return { wau: wauSet.size, mau: mauSet.size };
}

describe('engagement windowing', () => {
  it('dateKey returns YYYY-MM-DD', () => {
    expect(dateKey(new Date('2025-03-15T12:00:00Z'))).toBe('2025-03-15');
    expect(dateKey(new Date('2025-01-01T00:00:00Z'))).toBe('2025-01-01');
  });

  it('WAU/MAU cutoffs use date-only so string comparison is correct', () => {
    const toDate = new Date('2025-03-15T14:00:00Z');
    const { from7, from30 } = computeWauMauCutoffs(toDate);
    expect(from7).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(from30).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(from7).toBe('2025-03-08');
    expect(from30).toBe('2025-02-13');
  });

  it('boundary day is included in WAU when date equals from7', () => {
    const toDate = new Date('2025-03-15T00:00:00Z');
    const { from7 } = computeWauMauCutoffs(toDate);
    const dauByDayMap = new Map<string, Set<string>>();
    dauByDayMap.set(from7, new Set(['user1']));
    dauByDayMap.set('2025-03-10', new Set(['user2']));
    const { wau } = countInWindow(dauByDayMap, from7, '2020-01-01');
    expect(wau).toBe(2);
  });

  it('day before from7 is excluded from WAU', () => {
    const toDate = new Date('2025-03-15T00:00:00Z');
    const { from7 } = computeWauMauCutoffs(toDate);
    const dauByDayMap = new Map<string, Set<string>>();
    dauByDayMap.set('2025-03-07', new Set(['user1']));
    dauByDayMap.set('2025-03-10', new Set(['user2']));
    const { wau } = countInWindow(dauByDayMap, from7, '2020-01-01');
    expect(wau).toBe(1);
  });
});
