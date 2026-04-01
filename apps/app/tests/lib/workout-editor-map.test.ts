/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { blocksToWorkoutInSet, workoutInSetToBlocks } from '@/lib/admin/workout-editor-map';
import type { WorkoutInSet } from '@/types/ai-workout';

describe('workout-editor-map', () => {
  it('maps finisherBlocks to a finisher WorkoutBlock and round-trips without merging into exerciseBlocks', () => {
    const prev: WorkoutInSet = {
      title: 'Day A',
      description: 'Legs',
      exerciseBlocks: [
        {
          order: 1,
          name: 'Strength',
          exercises: [
            {
              order: 1,
              exerciseName: 'Back Squat',
              sets: 4,
              reps: '5',
              restSeconds: 180,
              coachNotes: '',
            },
          ],
        },
      ],
      finisherBlocks: [
        { order: 1, exerciseName: 'Assault Bike', instructions: [] },
      ],
    };

    const blocks = workoutInSetToBlocks(prev);
    const finisherUi = blocks.filter((b) => b.type === 'finisher');
    expect(finisherUi).toHaveLength(1);
    expect(finisherUi[0].exercises[0]?.name).toBe('Assault Bike');

    const next = blocksToWorkoutInSet(blocks, prev, {
      title: 'Day A',
      description: 'Legs',
    });

    expect(next.exerciseBlocks).toHaveLength(1);
    expect(next.exerciseBlocks![0].name).toBe('Strength');
    expect(next.finisherBlocks).toHaveLength(1);
    expect(next.finisherBlocks![0]).toMatchObject({
      exerciseName: 'Assault Bike',
      instructions: [],
    });
  });

  it('does not treat exercise block names containing "finish" as finisher — contract uses finisherBlocks', () => {
    const prev: WorkoutInSet = {
      title: 'X',
      description: 'Y',
      exerciseBlocks: [
        {
          order: 1,
          name: 'Finisher-style circuit',
          exercises: [
            {
              order: 1,
              exerciseName: 'Row',
              sets: 3,
              reps: '10',
              restSeconds: 60,
            },
          ],
        },
      ],
    };

    const blocks = workoutInSetToBlocks(prev);
    expect(blocks.some((b) => b.type === 'finisher')).toBe(false);
    expect(blocks.find((b) => b.type === 'main')?.name).toContain('Finisher');
  });

  it('round-trips warmup/cooldown empty notes to empty instructions arrays', () => {
    const prev: WorkoutInSet = {
      title: 'Z',
      description: 'W',
      warmupBlocks: [{ order: 1, exerciseName: 'Jump Rope', instructions: [] }],
      exerciseBlocks: [
        {
          order: 1,
          name: 'Main',
          exercises: [
            {
              order: 1,
              exerciseName: 'Push-up',
              sets: 3,
              reps: '10',
              restSeconds: 60,
            },
          ],
        },
      ],
      cooldownBlocks: [{ order: 1, exerciseName: 'Walk', instructions: [] }],
    };

    const blocks = workoutInSetToBlocks(prev);
    const next = blocksToWorkoutInSet(blocks, prev, { title: 'Z', description: 'W' });

    expect(next.warmupBlocks![0].instructions).toEqual([]);
    expect(next.cooldownBlocks![0].instructions).toEqual([]);
  });

  it('preserves warmup / finisher / cooldown exercise ids through load → save', () => {
    const prev: WorkoutInSet = {
      title: 'T',
      description: 'D',
      warmupBlocks: [
        { order: 1, exerciseName: 'Arm circles', instructions: ['Easy pace'], id: 'warm-id-1' },
      ],
      exerciseBlocks: [
        {
          order: 1,
          name: 'Main',
          exercises: [
            {
              order: 1,
              exerciseName: 'Squat',
              sets: 3,
              reps: '5',
              restSeconds: 120,
              id: 'main-ex-1',
            },
          ],
        },
      ],
      finisherBlocks: [{ order: 1, exerciseName: 'Sprint', instructions: [], id: 'fin-id-1' }],
      cooldownBlocks: [{ order: 1, exerciseName: 'Stretch', instructions: [], id: 'cool-id-1' }],
    };

    const blocks = workoutInSetToBlocks(prev);
    expect(blocks.find((b) => b.type === 'warmup')?.exercises[0]?.id).toBe('warm-id-1');
    expect(blocks.find((b) => b.type === 'finisher')?.exercises[0]?.id).toBe('fin-id-1');
    expect(blocks.find((b) => b.type === 'cooldown')?.exercises[0]?.id).toBe('cool-id-1');
    expect(blocks.find((b) => b.type === 'main')?.exercises[0]?.id).toBe('main-ex-1');

    const next = blocksToWorkoutInSet(blocks, prev, { title: 'T', description: 'D' });
    expect(next.warmupBlocks![0].id).toBe('warm-id-1');
    expect(next.finisherBlocks![0].id).toBe('fin-id-1');
    expect(next.cooldownBlocks![0].id).toBe('cool-id-1');
    expect(next.exerciseBlocks![0].exercises[0].id).toBe('main-ex-1');
  });
});
