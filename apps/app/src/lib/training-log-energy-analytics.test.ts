import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { WorkoutLog } from '@/types';
import type { ProfileBaseline } from '@/lib/met';
import { computeTrainingLogEnergyAggregates } from './training-log-energy-analytics';

const fullBaseline: ProfileBaseline = {
  dateOfBirth: '1990-01-01',
  biologicalSex: 'male',
  weightKg: 80,
  heightCm: 180,
};

function log(over: Partial<WorkoutLog>): WorkoutLog {
  return {
    id: '1',
    userId: 'u',
    workoutName: 'HIIT',
    date: '2025-03-10',
    effort: 5,
    rating: 4,
    notes: '',
    durationSeconds: 1800,
    source: 'hiit',
    ...over,
  };
}

describe('computeTrainingLogEnergyAggregates', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-12T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when baseline is null', () => {
    expect(computeTrainingLogEnergyAggregates([log({})], null)).toBeNull();
  });

  it('returns null when baseline incomplete', () => {
    const partial: ProfileBaseline = { ...fullBaseline, weightKg: null };
    expect(computeTrainingLogEnergyAggregates([log({})], partial)).toBeNull();
  });

  it('sums week and month with Monday week boundary (local date)', () => {
    // Mar 12 2025 is Wednesday; week Monday = 2025-03-10
    const logs = [
      log({ id: 'a', date: '2025-03-10', durationSeconds: 600 }),
      log({ id: 'b', date: '2025-03-11', durationSeconds: 600 }),
      log({ id: 'c', date: '2025-03-01', durationSeconds: 1800 }),
    ];
    const result = computeTrainingLogEnergyAggregates(logs, fullBaseline);
    expect(result).not.toBeNull();
    // 10 min + 10 min HIIT @ 8 MET, 80kg: each 10 min -> 8*80*(10/60) ≈ 106.67 -> 107 each -> 214 week
    expect(result!.weekEstimatedKcal).toBe(214);
    // March: all three logs; Mar 1: 30 min -> 320; Mar 10-11: 214 -> total 534
    expect(result!.monthEstimatedKcal).toBe(534);
    expect(result!.monthSessionCount).toBe(3);
    expect(result!.monthSessionsWithEstimate).toBe(3);
    expect(result!.monthAvgEstimatedKcal).toBe(178);
  });

  it('excludes logs without duration from kcal sums but counts month sessions', () => {
    const logs = [
      log({ id: 'a', date: '2025-03-10', durationSeconds: 1800 }),
      log({ id: 'b', date: '2025-03-11', durationSeconds: undefined }),
    ];
    const result = computeTrainingLogEnergyAggregates(logs, fullBaseline);
    expect(result!.weekEstimatedKcal).toBe(320);
    expect(result!.monthSessionCount).toBe(2);
    expect(result!.monthSessionsWithEstimate).toBe(1);
    expect(result!.monthAvgEstimatedKcal).toBe(320);
  });

  it('returns null month avg when no session in month has estimate', () => {
    const logs = [log({ id: 'b', date: '2025-03-11', durationSeconds: 0 })];
    const result = computeTrainingLogEnergyAggregates(logs, fullBaseline);
    expect(result!.monthSessionCount).toBe(1);
    expect(result!.monthSessionsWithEstimate).toBe(0);
    expect(result!.monthAvgEstimatedKcal).toBeNull();
  });

  it('excludes logs dated in the next calendar month from month totals', () => {
    const logs = [
      log({ id: 'a', date: '2025-03-10', durationSeconds: 600 }),
      log({ id: 'next', date: '2025-04-01', durationSeconds: 600 }),
    ];
    const result = computeTrainingLogEnergyAggregates(logs, fullBaseline);
    expect(result!.monthSessionCount).toBe(1);
    expect(result!.monthEstimatedKcal).toBe(107);
    expect(result!.monthSessionsWithEstimate).toBe(1);
  });
});
