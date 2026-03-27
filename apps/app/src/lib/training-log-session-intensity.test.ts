import { describe, expect, it } from 'vitest';
import type { WorkoutLog } from '@/types';
import type { ProfileBaseline } from '@/lib/met';
import {
  estimateSessionIntensity,
  estimateSessionIntensityPercent,
  impliedIntensityFromEffort,
} from './training-log-session-intensity';

const baseline: ProfileBaseline = {
  dateOfBirth: '1990-06-01',
  biologicalSex: 'male',
  weightKg: 82,
  heightCm: 180,
};

const baseLog = (over: Partial<WorkoutLog> = {}): WorkoutLog => ({
  id: 'log-1',
  userId: 'user-1',
  workoutName: 'Session',
  date: '2026-03-10',
  effort: 5,
  rating: 3,
  notes: '',
  durationSeconds: 1800,
  source: 'hiit_timer',
  ...over,
});

describe('impliedIntensityFromEffort', () => {
  it('maps 1..10 to 0..1', () => {
    expect(impliedIntensityFromEffort(1)).toBe(0);
    expect(impliedIntensityFromEffort(10)).toBe(1);
    expect(impliedIntensityFromEffort(5)).toBeCloseTo(4 / 9, 6);
  });
});

describe('estimateSessionIntensity', () => {
  it('falls back to effort-only when baseline is missing', () => {
    const out = estimateSessionIntensity(baseLog({ effort: 8 }), { profileBaseline: null });
    expect(out.usedEffortWeight).toBe(1);
    expect(out.usedMetWeight).toBe(0);
    expect(out.metValue).toBeNull();
    expect(out.percent).toBe(78);
  });

  it('blends effort and MET when baseline is complete', () => {
    const out = estimateSessionIntensity(baseLog({ effort: 8, source: 'tabata' }), {
      profileBaseline: baseline,
    });
    expect(out.metValue).toBe(8);
    expect(out.percent).toBeGreaterThan(70);
    expect(out.percent).toBeLessThan(90);
  });

  it('uses swimming MET branch', () => {
    const out = estimateSessionIntensity(baseLog({ effort: 6, source: 'swimming_laps' }), {
      profileBaseline: baseline,
    });
    expect(out.metValue).toBe(7);
    expect(out.percent).toBeGreaterThan(50);
  });

  it('returns same numeric value via convenience helper', () => {
    const log = baseLog({ effort: 7, workoutFormat: 'AMRAP' });
    const full = estimateSessionIntensity(log, { profileBaseline: baseline }).percent;
    expect(estimateSessionIntensityPercent(log, { profileBaseline: baseline })).toBe(full);
  });
});
