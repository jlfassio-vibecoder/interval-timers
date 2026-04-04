import { describe, expect, it } from 'vitest';
import { validateWorkoutMathematicianOutput } from '@/lib/prompt-chain/step4-workout-mathematician';
import type { BlockOptions } from '@/types/ai-workout';

const blockOptions: BlockOptions = {
  includeWarmup: false,
  mainBlockCount: 1,
  includeFinisher: false,
  includeCooldown: false,
};

function tabataWorkoutGood() {
  return {
    workouts: [
      {
        title: 'Session 1',
        description: 'Tabata test',
        warmupBlocks: [],
        exerciseBlocks: [
          {
            order: 1,
            name: 'Balanced Tabata',
            exercises: [
              {
                order: 1,
                exerciseName: 'Push-up',
                exerciseQuery: 'push-up',
                workSeconds: 20,
                restSeconds: 10,
                rounds: 4,
              },
              {
                order: 2,
                exerciseName: 'Row',
                exerciseQuery: 'row',
                workSeconds: 20,
                restSeconds: 10,
                rounds: 4,
              },
            ],
          },
        ],
        finisherBlocks: [],
        cooldownBlocks: [],
      },
    ],
  };
}

describe('validateWorkoutMathematicianOutput — Balanced Tabata', () => {
  it('accepts valid 20/10 timer schema', () => {
    const r = validateWorkoutMathematicianOutput(
      tabataWorkoutGood(),
      1,
      blockOptions,
      false,
      undefined,
      false,
      true,
      { pairingPattern: 'antagonist_pair', roundCount: 8 }
    );
    expect(r.valid).toBe(true);
  });

  it('rejects non-empty warmupBlocks with Balanced Tabata in the error text', () => {
    const bad = structuredClone(tabataWorkoutGood()) as Record<string, unknown>;
    const w = bad.workouts as Record<string, unknown>[];
    w[0].warmupBlocks = [{ order: 1, exerciseName: 'x', instructions: ['y'] }];
    const r = validateWorkoutMathematicianOutput(
      bad,
      1,
      blockOptions,
      false,
      undefined,
      false,
      true,
      { pairingPattern: 'antagonist_pair', roundCount: 8 }
    );
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toContain('Balanced Tabata');
  });

  it('rejects wrong workSeconds', () => {
    const bad = structuredClone(tabataWorkoutGood()) as Record<string, unknown>;
    const w = bad.workouts as Record<string, unknown>[];
    const eb = w[0].exerciseBlocks as { exercises: { workSeconds: number }[] }[];
    eb[0].exercises[0].workSeconds = 30;
    const r = validateWorkoutMathematicianOutput(
      bad,
      1,
      blockOptions,
      false,
      undefined,
      false,
      true,
      { pairingPattern: 'antagonist_pair', roundCount: 8 }
    );
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toContain('workSeconds');
  });
});
