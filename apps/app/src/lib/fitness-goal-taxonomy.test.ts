import { describe, expect, it } from 'vitest';
import {
  normalizeFitnessGoalRanking,
  toggleFitnessGoalRanking,
  type FitnessGoalId,
} from './fitness-goal-taxonomy';

describe('normalizeFitnessGoalRanking', () => {
  it('filters unknown ids', () => {
    expect(normalizeFitnessGoalRanking(['fat_loss', 'bogus', 'longevity'])).toEqual([
      'fat_loss',
      'longevity',
    ]);
  });

  it('dedupes preserving first order', () => {
    expect(
      normalizeFitnessGoalRanking(['fat_loss', 'longevity', 'fat_loss', 'muscle_hypertrophy'])
    ).toEqual(['fat_loss', 'longevity', 'muscle_hypertrophy']);
  });

  it('caps at three', () => {
    expect(
      normalizeFitnessGoalRanking([
        'fat_loss',
        'longevity',
        'muscle_hypertrophy',
        'cardiovascular_endurance',
      ])
    ).toEqual(['fat_loss', 'longevity', 'muscle_hypertrophy']);
    expect(
      normalizeFitnessGoalRanking([
        'power_speed',
        'mobility_flexibility',
        'stress_management',
        'weight_maintenance',
      ])
    ).toEqual(['power_speed', 'mobility_flexibility', 'stress_management']);
  });

  it('returns empty for empty', () => {
    expect(normalizeFitnessGoalRanking([])).toEqual([]);
  });
});

describe('toggleFitnessGoalRanking', () => {
  it('appends when not present and under max', () => {
    const { next, rejectedMax } = toggleFitnessGoalRanking([], 'fat_loss');
    expect(rejectedMax).toBeUndefined();
    expect(next).toEqual(['fat_loss']);
  });

  it('removes when present', () => {
    const { next } = toggleFitnessGoalRanking(['fat_loss', 'longevity'], 'fat_loss');
    expect(next).toEqual(['longevity']);
  });

  it('rejects fourth distinct goal', () => {
    const base: FitnessGoalId[] = ['fat_loss', 'longevity', 'muscle_hypertrophy'];
    const { next, rejectedMax } = toggleFitnessGoalRanking(base, 'cardiovascular_endurance');
    expect(rejectedMax).toBe(true);
    expect(next).toEqual(base);
  });

  it('normalizes dirty input before toggle', () => {
    const { next } = toggleFitnessGoalRanking(['fat_loss', 'invalid'], 'longevity');
    expect(next).toEqual(['fat_loss', 'longevity']);
  });
});
