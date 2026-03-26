import { describe, expect, it } from 'vitest';
import type { WorkoutLog } from '@/types';
import { computeTimeStreakWeeks, computeTrainingLogQuickStats } from './training-log-quick-stats';

function log(overrides: Partial<WorkoutLog>): WorkoutLog {
  return {
    id: '1',
    userId: 'u1',
    workoutName: 'Workout',
    date: '2025-03-10',
    effort: 5,
    rating: 4,
    notes: '',
    durationSeconds: 1200,
    ...overrides,
  };
}

describe('computeTrainingLogQuickStats', () => {
  it('computes week streak from Monday week boundaries', () => {
    const logs = [
      log({ id: 'a', date: '2025-03-11' }), // current week
      log({ id: 'b', date: '2025-03-05' }), // previous week
      log({ id: 'c', date: '2025-02-24' }), // two weeks back
      log({ id: 'd', date: '2025-02-10' }), // gap before this
    ];
    const out = computeTrainingLogQuickStats(logs, '2025-03-12');
    expect(out.weekStreak).toBe(3);
  });

  it('counts sessions and minutes this month including multiple same-day sessions', () => {
    const logs = [
      log({ id: 'a', date: '2025-03-01', durationSeconds: 600 }),
      log({ id: 'b', date: '2025-03-01', durationSeconds: 1800 }),
      log({ id: 'c', date: '2025-03-15', durationSeconds: undefined }),
      log({ id: 'd', date: '2025-02-28', durationSeconds: 600 }),
    ];
    const out = computeTrainingLogQuickStats(logs, '2025-03-20');
    expect(out.sessionsThisMonth).toBe(3);
    expect(out.minutesThisMonth).toBe(40);
  });

  it('uses forgiving day streak start (yesterday when today is empty)', () => {
    const logs = [
      log({ id: 'a', date: '2025-03-11' }),
      log({ id: 'b', date: '2025-03-10' }),
      log({ id: 'c', date: '2025-03-09' }),
    ];
    const out = computeTrainingLogQuickStats(logs, '2025-03-12');
    expect(out.dayStreak).toBe(3);
  });

  it('returns zeroed stats for empty logs', () => {
    const out = computeTrainingLogQuickStats([], '2025-03-12');
    expect(out).toEqual({
      weekStreak: 0,
      sessionsThisMonth: 0,
      dayStreak: 0,
      minutesThisMonth: 0,
    });
  });

  it('computes target-based time streak from weekly minutes', () => {
    const logs = [
      log({ id: 'a', date: '2025-03-10', durationSeconds: 3600 }), // current week 60
      log({ id: 'b', date: '2025-03-11', durationSeconds: 3000 }), // current week +50 => 110
      log({ id: 'c', date: '2025-03-04', durationSeconds: 4200 }), // previous week 70
      log({ id: 'd', date: '2025-03-03', durationSeconds: 3000 }), // previous week +50 => 120
      log({ id: 'e', date: '2025-02-25', durationSeconds: 2400 }), // two weeks back 40 (break)
    ];
    expect(computeTimeStreakWeeks(logs, 100, '2025-03-12')).toBe(2);
    expect(computeTimeStreakWeeks(logs, 120, '2025-03-12')).toBe(0);
  });
});
