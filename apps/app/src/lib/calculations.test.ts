import { describe, expect, it } from 'vitest';
import {
  buildPhysiologicalCalibration,
  calculateAgeYears,
  estimateMaxHrTanaka,
  getEffectiveMaxHrBpm,
  getHeartRateAtIntensity,
  getUserHeartRateZones,
} from './calculations';

describe('calculateAgeYears', () => {
  it('returns null for empty input', () => {
    expect(calculateAgeYears(null)).toBeNull();
    expect(calculateAgeYears(undefined)).toBeNull();
    expect(calculateAgeYears('')).toBeNull();
  });

  it('computes age at UTC calendar boundary', () => {
    const ref = new Date(Date.UTC(2025, 2, 15));
    expect(calculateAgeYears('1990-03-14', ref)).toBe(35);
    expect(calculateAgeYears('1990-03-15', ref)).toBe(35);
    expect(calculateAgeYears('1990-03-16', ref)).toBe(34);
  });

  it('returns null for future birth', () => {
    const ref = new Date(Date.UTC(2025, 0, 1));
    expect(calculateAgeYears('2030-01-01', ref)).toBeNull();
  });
});

describe('estimateMaxHrTanaka', () => {
  it('matches formula 208 - 0.7 * age', () => {
    expect(estimateMaxHrTanaka(40)).toBe(Math.round(208 - 0.7 * 40));
    expect(estimateMaxHrTanaka(40)).toBe(180);
  });

  it('returns null outside supported band', () => {
    expect(estimateMaxHrTanaka(9)).toBeNull();
    expect(estimateMaxHrTanaka(101)).toBeNull();
  });
});

describe('getEffectiveMaxHrBpm', () => {
  it('prefers manual in valid range', () => {
    expect(
      getEffectiveMaxHrBpm({ manualMaxHrBpm: 175, estimatedMaxHrBpm: 180 })
    ).toBe(175);
  });

  it('falls back to estimate when manual invalid', () => {
    expect(
      getEffectiveMaxHrBpm({ manualMaxHrBpm: 50, estimatedMaxHrBpm: 180 })
    ).toBe(180);
    expect(
      getEffectiveMaxHrBpm({ manualMaxHrBpm: null, estimatedMaxHrBpm: 180 })
    ).toBe(180);
  });
});

describe('getHeartRateAtIntensity', () => {
  it('uses percent of max without resting', () => {
    expect(
      getHeartRateAtIntensity({ maxHrBpm: 200, restingHrBpm: null, intensity: 0.75 })
    ).toBe(150);
  });

  it('uses Karvonen when resting is valid', () => {
    // (200 - 60) * 0.75 + 60 = 105 + 60 = 165
    expect(
      getHeartRateAtIntensity({ maxHrBpm: 200, restingHrBpm: 60, intensity: 0.75 })
    ).toBe(165);
  });

  it('ignores resting when resting >= max', () => {
    expect(
      getHeartRateAtIntensity({ maxHrBpm: 200, restingHrBpm: 200, intensity: 0.5 })
    ).toBe(100);
  });

  it('clamps intensity', () => {
    expect(
      getHeartRateAtIntensity({ maxHrBpm: 100, restingHrBpm: null, intensity: 2 })
    ).toBe(100);
  });
});

describe('getUserHeartRateZones', () => {
  it('returns null without max HR', () => {
    expect(
      getUserHeartRateZones({
        dateOfBirth: null,
        manualMaxHrBpm: null,
        restingHrBpm: null,
      })
    ).toBeNull();
  });

  it('returns monotonic zones from DOB + Tanaka', () => {
    const ref = new Date(Date.UTC(2025, 6, 1));
    const zones = getUserHeartRateZones({
      dateOfBirth: '1985-06-01',
      manualMaxHrBpm: null,
      restingHrBpm: null,
      referenceDate: ref,
    });
    expect(zones).not.toBeNull();
    expect(zones!).toHaveLength(5);
    for (let i = 0; i < zones!.length; i++) {
      expect(zones![i].bpmMin).toBeLessThanOrEqual(zones![i].bpmMax);
      if (i > 0) {
        expect(zones![i].bpmMin).toBeGreaterThanOrEqual(zones![i - 1].bpmMin);
      }
    }
  });
});

describe('buildPhysiologicalCalibration', () => {
  it('tier none without DOB or manual max', () => {
    const c = buildPhysiologicalCalibration({
      dateOfBirth: null,
      manualMaxHrBpm: null,
      restingHrBpm: 55,
    });
    expect(c.tier).toBe('none');
    expect(c.effectiveMaxHrBpm).toBeNull();
  });

  it('tier max_only with DOB only', () => {
    const c = buildPhysiologicalCalibration({
      dateOfBirth: '1990-01-15',
      manualMaxHrBpm: null,
      restingHrBpm: null,
      referenceDate: new Date(Date.UTC(2025, 0, 15)),
    });
    expect(c.tier).toBe('max_only');
    expect(c.effectiveMaxHrBpm).toBe(estimateMaxHrTanaka(35));
    expect(c.restingHrBpm).toBeNull();
  });

  it('tier full with manual max and valid resting', () => {
    const c = buildPhysiologicalCalibration({
      dateOfBirth: null,
      manualMaxHrBpm: 185,
      restingHrBpm: 58,
    });
    expect(c.tier).toBe('full');
    expect(c.effectiveMaxHrBpm).toBe(185);
    expect(c.restingHrBpm).toBe(58);
  });
});
