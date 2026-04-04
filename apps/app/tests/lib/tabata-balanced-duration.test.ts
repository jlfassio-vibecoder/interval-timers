import { describe, expect, it } from 'vitest';
import {
  snapTabataRoundCountToPattern,
  tabataBalancedExerciseCount,
  tabataBalancedRoundsPerExercise,
  tabataBalancedSessionMinutes,
} from '@/lib/tabata-balanced-duration';

describe('tabataBalancedSessionMinutes', () => {
  it('8 rounds => 4 min (ceil of 240s)', () => {
    expect(tabataBalancedSessionMinutes(8)).toBe(4);
  });
  it('4 rounds => 2 min', () => {
    expect(tabataBalancedSessionMinutes(4)).toBe(2);
  });
});

describe('snapTabataRoundCountToPattern', () => {
  it('four_station snaps 6 to 8', () => {
    expect(snapTabataRoundCountToPattern('four_station', 6)).toBe(8);
  });
  it('eight_station keeps 8', () => {
    expect(snapTabataRoundCountToPattern('eight_station', 8)).toBe(8);
  });
});

describe('tabataBalancedRoundsPerExercise', () => {
  it('splits 8 rounds across 2 exercises', () => {
    expect(tabataBalancedRoundsPerExercise('antagonist_pair', 8)).toBe(4);
    expect(tabataBalancedExerciseCount('antagonist_pair')).toBe(2);
  });
});
