import { describe, expect, it } from 'vitest';
import {
  clampEmomTotalRounds,
  emomAlternatingRoundsPerStation,
  emomSessionMinutes,
  snapEmomTotalRoundsToCycle,
} from '@/lib/emom-factory-duration';

describe('emomSessionMinutes', () => {
  it('equals totalRounds', () => {
    expect(emomSessionMinutes({ structure: 'single_movement', totalRounds: 15 })).toBe(15);
  });
});

describe('snapEmomTotalRoundsToCycle', () => {
  it('returns value unchanged when already divisible', () => {
    expect(snapEmomTotalRoundsToCycle(12, 3)).toBe(12);
  });

  it('snaps upward when within max', () => {
    expect(snapEmomTotalRoundsToCycle(11, 3)).toBe(12);
  });

  it('clamps before snapping', () => {
    const out = snapEmomTotalRoundsToCycle(7, 4);
    expect(out % 4).toBe(0);
    expect(out).toBeGreaterThanOrEqual(8);
  });
});

describe('clampEmomTotalRounds', () => {
  it('clamps to bounds', () => {
    expect(clampEmomTotalRounds(4)).toBe(8);
    expect(clampEmomTotalRounds(40)).toBe(30);
    expect(clampEmomTotalRounds(12)).toBe(12);
  });
});

describe('emomAlternatingRoundsPerStation', () => {
  it('divides total rounds by stations', () => {
    expect(emomAlternatingRoundsPerStation(12, 3)).toBe(4);
  });
});
