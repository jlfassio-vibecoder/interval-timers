/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  expandWeeklyOccurrenceSlots,
  luxonWeekdayToJs,
  seriesMetaFromFirstSlot,
} from '@/lib/live-schedule-series-expand';

describe('live-schedule-series-expand', () => {
  it('maps Luxon Sunday to JS 0', () => {
    expect(luxonWeekdayToJs(7)).toBe(0);
    expect(luxonWeekdayToJs(1)).toBe(1);
  });

  it('extracts meta from first slot', () => {
    const m = seriesMetaFromFirstSlot(
      '2026-04-10T15:00:00.000Z',
      '2026-04-10T16:00:00.000Z',
      'America/Los_Angeles'
    );
    expect(m.durationMinutes).toBe(60);
    expect(m.ianaTimezone).toBe('America/Los_Angeles');
    expect(typeof m.weekday).toBe('number');
    expect(m.localStartTime).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('expands N weekly slots with stable duration', () => {
    const slots = expandWeeklyOccurrenceSlots(
      '2026-04-10T15:00:00.000Z',
      '2026-04-10T16:00:00.000Z',
      'UTC',
      3
    );
    expect(slots).toHaveLength(3);
    const d0 = new Date(slots[0]!.scheduledEndAt).getTime() - new Date(slots[0]!.scheduledStartAt).getTime();
    const d1 = new Date(slots[1]!.scheduledEndAt).getTime() - new Date(slots[1]!.scheduledStartAt).getTime();
    expect(d0).toBe(d1);
    expect(new Date(slots[1]!.scheduledStartAt).getTime() - new Date(slots[0]!.scheduledStartAt).getTime()).toBe(
      7 * 24 * 60 * 60 * 1000
    );
  });
});
