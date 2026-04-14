import { describe, expect, it } from 'vitest';
import { validateWorkoutMathematicianOutput } from '@/lib/prompt-chain/step4-workout-mathematician';

const blockOptions = {
  includeWarmup: true,
  mainBlockCount: 1 as const,
  includeFinisher: false,
  includeCooldown: false,
};

describe('validateWorkoutMathematicianOutput — EMOM factory', () => {
  it('accepts single-movement EMOM timer schema', () => {
    const data = {
      workouts: [
        {
          title: 'Session 1',
          description: 'EMOM test',
          warmupBlocks: [],
          exerciseBlocks: [
            {
              order: 1,
              name: 'EMOM',
              exercises: [
                {
                  order: 1,
                  exerciseName: 'Swing',
                  exerciseQuery: 'swing',
                  workSeconds: 40,
                  restSeconds: 20,
                  rounds: 10,
                },
              ],
            },
          ],
          finisherBlocks: [],
          cooldownBlocks: [],
        },
      ],
    };
    const r = validateWorkoutMathematicianOutput(
      data,
      1,
      blockOptions,
      false,
      undefined,
      false,
      false,
      undefined,
      true,
      { structure: 'single_movement', totalRounds: 10 }
    );
    expect(r.valid).toBe(true);
  });

  it('rejects single-movement when more than one exercise', () => {
    const data = {
      workouts: [
        {
          title: 'Session 1',
          description: 'bad',
          warmupBlocks: [],
          exerciseBlocks: [
            {
              order: 1,
              name: 'EMOM',
              exercises: [
                {
                  order: 1,
                  exerciseName: 'A',
                  exerciseQuery: 'a',
                  workSeconds: 40,
                  restSeconds: 20,
                  rounds: 10,
                },
                {
                  order: 2,
                  exerciseName: 'B',
                  exerciseQuery: 'b',
                  workSeconds: 40,
                  restSeconds: 20,
                  rounds: 10,
                },
              ],
            },
          ],
          finisherBlocks: [],
          cooldownBlocks: [],
        },
      ],
    };
    const r = validateWorkoutMathematicianOutput(
      data,
      1,
      blockOptions,
      false,
      undefined,
      false,
      false,
      undefined,
      true,
      { structure: 'single_movement', totalRounds: 10 }
    );
    expect(r.valid).toBe(false);
  });
});
