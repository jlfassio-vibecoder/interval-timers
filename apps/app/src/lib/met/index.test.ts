import { describe, expect, it } from 'vitest';
import type { WorkoutLog } from '@/types';
import {
  computeTotalActiveMultiplier,
  estimateSessionKcalFromLog,
  getWorkoutMetSessionData,
  lifestyleBaselineFromLegacyActivity,
  legacyActivityLevelFromLifestyle,
  TAM_MAX,
  type ProfileBaseline,
} from './index';

const fullBaseline: ProfileBaseline = {
  dateOfBirth: '1990-06-01',
  biologicalSex: 'male',
  weightKg: 80,
  heightCm: 180,
};

const baseLog = (over: Partial<WorkoutLog> = {}): WorkoutLog => ({
  id: 'log-1',
  userId: 'user-1',
  workoutName: 'HIIT',
  date: '2025-03-01',
  effort: 6,
  rating: 4,
  notes: '',
  durationSeconds: 1800,
  source: 'hiit_timer',
  ...over,
});

describe('computeTotalActiveMultiplier', () => {
  it('adds lifestyle and workout modifier', () => {
    expect(computeTotalActiveMultiplier('sedentary', 'none')).toBe(1.2);
    expect(computeTotalActiveMultiplier('sedentary', 'hard')).toBe(1.6);
    expect(computeTotalActiveMultiplier('highly_active', 'light')).toBe(1.9);
  });

  it('never exceeds TAM_MAX', () => {
    expect(computeTotalActiveMultiplier('highly_active', 'pro')).toBeLessThanOrEqual(TAM_MAX);
    expect(computeTotalActiveMultiplier('highly_active', 'pro')).toBe(2.3);
  });
});

describe('getWorkoutMetSessionData', () => {
  it('returns null when baseline is null', () => {
    expect(getWorkoutMetSessionData(baseLog(), null)).toBeNull();
  });

  it('returns null when baseline is incomplete', () => {
    const partial: ProfileBaseline = { ...fullBaseline, dateOfBirth: null };
    expect(getWorkoutMetSessionData(baseLog(), partial)).toBeNull();
  });

  it('returns null when duration is missing or non-positive', () => {
    expect(getWorkoutMetSessionData(baseLog({ durationSeconds: undefined }), fullBaseline)).toBeNull();
    expect(getWorkoutMetSessionData(baseLog({ durationSeconds: 0 }), fullBaseline)).toBeNull();
  });

  it('returns met, durationMinutes, and rounded kcal for HIIT', () => {
    const result = getWorkoutMetSessionData(baseLog({ source: 'hiit' }), fullBaseline);
    expect(result).toEqual({
      met: 8,
      durationMinutes: 30,
      estimatedKcal: 320,
    });
  });

  it('uses AMRAP MET when source matches', () => {
    const result = getWorkoutMetSessionData(baseLog({ source: 'amrap_session' }), fullBaseline);
    expect(result?.met).toBe(7.5);
    expect(result?.estimatedKcal).toBe(300);
  });
});

describe('estimateSessionKcalFromLog', () => {
  it('matches getWorkoutMetSessionData estimatedKcal for HIIT', () => {
    const log = baseLog({ source: 'hiit' });
    expect(estimateSessionKcalFromLog(log, fullBaseline)).toBe(
      getWorkoutMetSessionData(log, fullBaseline)?.estimatedKcal ?? null
    );
    expect(estimateSessionKcalFromLog(log, fullBaseline)).toBe(320);
  });

  it('returns null when baseline is null', () => {
    expect(estimateSessionKcalFromLog(baseLog(), null)).toBeNull();
  });

  it('returns null when duration is non-positive', () => {
    expect(estimateSessionKcalFromLog(baseLog({ durationSeconds: 0 }), fullBaseline)).toBeNull();
  });
});

describe('legacy mapping', () => {
  it('maps old activity_level to lifestyle ids', () => {
    expect(lifestyleBaselineFromLegacyActivity('lightly_active')).toBe('low_active');
    expect(lifestyleBaselineFromLegacyActivity('moderately_active')).toBe('active');
    expect(lifestyleBaselineFromLegacyActivity('very_active')).toBe('highly_active');
  });

  it('maps lifestyle back to legacy enum strings', () => {
    expect(legacyActivityLevelFromLifestyle('low_active')).toBe('lightly_active');
    expect(legacyActivityLevelFromLifestyle('active')).toBe('moderately_active');
  });
});
