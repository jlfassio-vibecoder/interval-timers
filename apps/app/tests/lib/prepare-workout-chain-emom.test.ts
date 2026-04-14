import { describe, expect, it } from 'vitest';
import { prepareWorkoutChainRequest } from '@/lib/workout-chain/prepare-workout-chain-request';

function basePersona(overrides: Record<string, unknown> = {}) {
  return {
    demographics: {
      ageRange: '26-35',
      sex: 'Male' as const,
      weight: 180,
      experienceLevel: 'intermediate' as const,
    },
    medical: { injuries: '', conditions: '' },
    goals: { primary: 'Strength', secondary: 'Endurance' },
    weeklyTimeMinutes: 180,
    sessionsPerWeek: 3,
    sessionDurationMinutes: 12,
    splitType: 'full_body' as const,
    lifestyle: 'active' as const,
    twoADay: false,
    ...overrides,
  };
}

describe('prepareWorkoutChainRequest — EMOM', () => {
  it('accepts valid single-movement EMOM', async () => {
    const r = await prepareWorkoutChainRequest(
      basePersona({
        emomMode: true,
        emomOptions: { structure: 'single_movement', totalRounds: 12 },
      }),
      false
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.emomMode).toBe(true);
      expect(r.data.emomOptions?.structure).toBe('single_movement');
      expect(r.data.emomOptions?.totalRounds).toBe(12);
    }
  });

  it('rejects when sessionDurationMinutes does not match EMOM rounds', async () => {
    const r = await prepareWorkoutChainRequest(
      basePersona({
        emomMode: true,
        emomOptions: { structure: 'single_movement', totalRounds: 12 },
        sessionDurationMinutes: 20,
      }),
      false
    );
    expect(r.ok).toBe(false);
  });

  it('rejects alternating when totalRounds is not divisible by stationsPerCycle', async () => {
    const r = await prepareWorkoutChainRequest(
      basePersona({
        emomMode: true,
        emomOptions: {
          structure: 'alternating',
          totalRounds: 13,
          stationsPerCycle: 3,
        },
        sessionDurationMinutes: 13,
      }),
      false
    );
    expect(r.ok).toBe(false);
  });

  it('rejects multiple metabolic modes', async () => {
    const r = await prepareWorkoutChainRequest(
      basePersona({
        hiitMode: true,
        emomMode: true,
        emomOptions: { structure: 'single_movement', totalRounds: 12 },
        sessionDurationMinutes: 12,
      }),
      false
    );
    expect(r.ok).toBe(false);
  });
});
