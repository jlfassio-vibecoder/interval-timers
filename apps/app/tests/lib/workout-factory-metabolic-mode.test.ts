import { describe, expect, it } from 'vitest';
import {
  getFactoryMetabolicModeFromAiChainMetadata,
  parseFactoryMetabolicModeFromApi,
} from '@/lib/trainer-live/workout-factory-metabolic-mode';

describe('parseFactoryMetabolicModeFromApi', () => {
  it('returns null for unknown or invalid values', () => {
    expect(parseFactoryMetabolicModeFromApi(undefined)).toBeNull();
    expect(parseFactoryMetabolicModeFromApi(null)).toBeNull();
    expect(parseFactoryMetabolicModeFromApi('')).toBeNull();
    expect(parseFactoryMetabolicModeFromApi('amrap_density ')).toBeNull();
    expect(parseFactoryMetabolicModeFromApi({})).toBeNull();
  });

  it('accepts each known union member', () => {
    expect(parseFactoryMetabolicModeFromApi('amrap_density')).toBe('amrap_density');
    expect(parseFactoryMetabolicModeFromApi('tabata_balanced')).toBe('tabata_balanced');
    expect(parseFactoryMetabolicModeFromApi('hiit')).toBe('hiit');
    expect(parseFactoryMetabolicModeFromApi('emom_factory')).toBe('emom_factory');
  });
});

describe('getFactoryMetabolicModeFromAiChainMetadata', () => {
  it('returns null for null, non-object, or missing workoutConfig', () => {
    expect(getFactoryMetabolicModeFromAiChainMetadata(null)).toBeNull();
    expect(getFactoryMetabolicModeFromAiChainMetadata(undefined)).toBeNull();
    expect(getFactoryMetabolicModeFromAiChainMetadata('x')).toBeNull();
    expect(getFactoryMetabolicModeFromAiChainMetadata({})).toBeNull();
    expect(getFactoryMetabolicModeFromAiChainMetadata({ workoutConfig: null })).toBeNull();
  });

  it('prefers tabata over amrap and hiit when multiple flags are truthy', () => {
    const meta = {
      workoutConfig: {
        tabataBalancedMode: true,
        amrapDensityMode: true,
        hiitMode: true,
      },
    };
    expect(getFactoryMetabolicModeFromAiChainMetadata(meta)).toBe('tabata_balanced');
  });

  it('returns amrap_density when only amrapDensityMode is true', () => {
    expect(
      getFactoryMetabolicModeFromAiChainMetadata({
        workoutConfig: { amrapDensityMode: true, hiitMode: false },
      })
    ).toBe('amrap_density');
  });

  it('returns tabata_balanced when tabataBalancedMode is true', () => {
    expect(
      getFactoryMetabolicModeFromAiChainMetadata({
        workoutConfig: { tabataBalancedMode: true },
      })
    ).toBe('tabata_balanced');
  });

  it('returns hiit when only hiitMode is true', () => {
    expect(
      getFactoryMetabolicModeFromAiChainMetadata({
        workoutConfig: { hiitMode: true },
      })
    ).toBe('hiit');
  });

  it('returns emom_factory when emomMode is true', () => {
    expect(
      getFactoryMetabolicModeFromAiChainMetadata({
        workoutConfig: { emomMode: true },
      })
    ).toBe('emom_factory');
  });

  it('returns null when no metabolic flags are set', () => {
    expect(
      getFactoryMetabolicModeFromAiChainMetadata({
        workoutConfig: { hiitMode: false, amrapDensityMode: false },
      })
    ).toBeNull();
  });
});
