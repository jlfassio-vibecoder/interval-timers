/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit tests for getCurrentWeek (user program schedule / progress).
 * Covers edge cases that drive schedule resolution and derived notifications.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/supabase-instance', () => ({ supabase: {} }));

import { getCurrentWeek } from '@/lib/supabase/client/user-programs';

describe('getCurrentWeek', () => {
  // Fixed "today" for deterministic tests: 2025-02-27 (Thursday)
  const TODAY = new Date('2025-02-27T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('no startDate', () => {
    it('returns not_started when startDate is null', () => {
      expect(getCurrentWeek(null, 6)).toEqual({
        current: 0,
        total: 6,
        status: 'not_started',
      });
    });

    it('returns not_started when startDate is undefined', () => {
      expect(getCurrentWeek(undefined, 6)).toEqual({
        current: 0,
        total: 6,
        status: 'not_started',
      });
    });
  });

  describe('startDate in future', () => {
    it('returns not_started when start is after today', () => {
      expect(getCurrentWeek('2026-01-15', 6)).toEqual({
        current: 0,
        total: 6,
        status: 'not_started',
      });
    });

    it('returns not_started when start is next week', () => {
      expect(getCurrentWeek('2025-03-10', 6)).toEqual({
        current: 0,
        total: 6,
        status: 'not_started',
      });
    });
  });

  describe('start of final week', () => {
    it('returns week 6 in_progress on first day of final week (6-week program)', () => {
      // Start 2025-01-20 → 38 days before 2025-02-27 → week 5 complete, now in week 6
      // daysSinceStart = 37 (0-indexed: 37 days) → floor(37/7)+1 = 6, 37 < 42 so in_progress
      expect(getCurrentWeek('2025-01-20', 6)).toEqual({
        current: 6,
        total: 6,
        status: 'in_progress',
      });
    });

    it('returns final week in_progress on last day of program', () => {
      // 6-week program = 42 days. Start 2025-01-16 → 42 days later = 2025-02-27 (today)
      // daysSinceStart = 42 → status = complete (>= 42)
      expect(getCurrentWeek('2025-01-16', 6)).toEqual({
        current: 6,
        total: 6,
        status: 'complete',
      });
    });
  });

  describe('after end of program', () => {
    it('returns complete when today is past last day of program', () => {
      // Start 2025-01-01 → 57 days before 2025-02-27 → 8+ weeks, capped at 6
      expect(getCurrentWeek('2025-01-01', 6)).toEqual({
        current: 6,
        total: 6,
        status: 'complete',
      });
    });

    it('returns complete when one day after program end', () => {
      // 6 weeks = 42 days. Start 2025-01-15 → day 43 = 2025-02-27 (today)
      expect(getCurrentWeek('2025-01-15', 6)).toEqual({
        current: 6,
        total: 6,
        status: 'complete',
      });
    });
  });

  describe('in_progress and duration edge cases', () => {
    it('returns week 1 in_progress on start date', () => {
      expect(getCurrentWeek('2025-02-27', 6)).toEqual({
        current: 1,
        total: 6,
        status: 'in_progress',
      });
    });

    it('returns week 2 in_progress after 7 days', () => {
      expect(getCurrentWeek('2025-02-20', 6)).toEqual({
        current: 2,
        total: 6,
        status: 'in_progress',
      });
    });

    it('clamps total to at least 1 when durationWeeks is 0', () => {
      expect(getCurrentWeek('2025-01-01', 0)).toEqual({
        current: 1,
        total: 1,
        status: 'complete',
      });
    });
  });
});
