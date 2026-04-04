/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  workoutBlocksToAmrapExerciseNames,
  workoutRowToAmrapAttachParams,
} from '@/lib/trainer-live/amrap-workout-list-adapter';

describe('workoutBlocksToAmrapExerciseNames', () => {
  it('flattens warmup, main, finisher, cooldown in stable order', () => {
    const names = workoutBlocksToAmrapExerciseNames([
      {
        type: 'main',
        name: 'Main',
        order: 2,
        exercises: [{ name: 'Squat' }],
      },
      {
        type: 'warmup',
        name: 'W',
        order: 1,
        exercises: [{ name: '  Skip  ' }],
      },
      {
        type: 'cooldown',
        name: 'C',
        order: 9,
        exercises: [{ name: 'Stretch' }],
      },
    ]);
    expect(names).toEqual(['Skip', 'Squat', 'Stretch']);
  });

  it('skips empty names', () => {
    expect(
      workoutBlocksToAmrapExerciseNames([
        {
          type: 'main',
          name: 'M',
          order: 1,
          exercises: [{ name: '' }, { name: 'Push-up' }],
        },
      ])
    ).toEqual(['Push-up']);
  });
});

describe('workoutRowToAmrapAttachParams', () => {
  it('uses duration from row when valid', () => {
    const r = workoutRowToAmrapAttachParams({
      blocks: [{ type: 'main', name: 'M', order: 1, exercises: [{ name: 'A' }] }],
      durationMinutes: 20,
    });
    expect(r.workoutList).toEqual(['A']);
    expect(r.durationMinutes).toBe(20);
  });

  it('defaults duration when missing or out of range', () => {
    const r = workoutRowToAmrapAttachParams({
      blocks: [{ type: 'main', name: 'M', order: 1, exercises: [{ name: 'A' }] }],
      durationMinutes: null,
    });
    expect(r.durationMinutes).toBe(15);
  });

  it('throws when no exercises', () => {
    expect(() =>
      workoutRowToAmrapAttachParams({
        blocks: [{ type: 'main', name: 'M', order: 1, exercises: [] }],
        durationMinutes: 10,
      })
    ).toThrow(/no exercises/);
  });
});
