/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit tests for schedule normalization module.
 */

import { describe, expect, it } from 'vitest';
import {
  normalizeWorkoutForEditor,
  normalizeProgramSchedule,
  normalizeWorkoutSet,
  getExercisesFromWorkout,
  type ProgramWorkout,
} from '@/lib/program-schedule-utils';

describe('normalizeWorkoutForEditor', () => {
  it('converts legacy blocks to exerciseBlocks with name Main', () => {
    const workout: ProgramWorkout = {
      title: 'Day 1',
      description: 'Upper',
      blocks: [
        {
          order: 1,
          exerciseName: 'Bench Press',
          sets: 3,
          reps: '8-10',
        },
      ],
    };
    const out = normalizeWorkoutForEditor(workout);
    expect(out.exerciseBlocks).toHaveLength(1);
    expect(out.exerciseBlocks![0]).toMatchObject({ order: 1, name: 'Main' });
    expect(out.exerciseBlocks![0].exercises).toHaveLength(1);
    expect(out.exerciseBlocks![0].exercises[0]).toMatchObject({
      exerciseName: 'Bench Press',
      sets: 3,
      reps: '8-10',
    });
    expect(out.blocks).toBeUndefined();
  });

  it('keeps exerciseBlocks structure and normalizes reps number to string', () => {
    const workout: ProgramWorkout = {
      title: 'Session 1',
      description: 'Push',
      exerciseBlocks: [
        {
          order: 1,
          name: 'Main',
          exercises: [
            { order: 1, exerciseName: 'Push-up', sets: 3, reps: 10 as unknown as string },
          ],
        },
      ],
    };
    const out = normalizeWorkoutForEditor(workout);
    expect(out.exerciseBlocks).toHaveLength(1);
    expect(out.exerciseBlocks![0].exercises[0].reps).toBe('10');
    expect(typeof out.exerciseBlocks![0].exercises[0].reps).toBe('string');
  });

  it('empty blocks produces single empty exerciseBlock', () => {
    const workout: ProgramWorkout = {
      title: 'Empty',
      description: 'No exercises',
      blocks: [],
    };
    const out = normalizeWorkoutForEditor(workout);
    expect(out.exerciseBlocks).toHaveLength(1);
    expect(out.exerciseBlocks![0]).toMatchObject({ order: 1, name: '' });
    expect(out.exerciseBlocks![0].exercises).toEqual([]);
  });

  it('block with empty exercises array is preserved', () => {
    const workout: ProgramWorkout = {
      title: 'Mixed',
      description: 'Desc',
      exerciseBlocks: [
        { order: 1, name: 'Main', exercises: [] },
        {
          order: 2,
          name: 'Finisher',
          exercises: [{ order: 1, exerciseName: 'Plank', sets: 2, reps: '30s' }],
        },
      ],
    };
    const out = normalizeWorkoutForEditor(workout);
    expect(out.exerciseBlocks).toHaveLength(2);
    expect(out.exerciseBlocks![0].exercises).toEqual([]);
    expect(out.exerciseBlocks![1].exercises).toHaveLength(1);
  });

  it('does not mutate input', () => {
    const workout: ProgramWorkout = {
      title: 'T',
      description: 'D',
      blocks: [{ order: 1, exerciseName: 'Squat', sets: 3, reps: '5' }],
    };
    const out = normalizeWorkoutForEditor(workout);
    expect(workout.blocks).toHaveLength(1);
    expect(out).not.toBe(workout);
    expect(out.exerciseBlocks).toBeDefined();
  });
});

describe('normalizeProgramSchedule', () => {
  it('normalizes single week with legacy blocks', () => {
    const program = {
      title: 'P',
      description: 'D',
      difficulty: 'intermediate' as const,
      durationWeeks: 1,
      schedule: [
        {
          weekNumber: 1,
          workouts: [
            {
              title: 'Day 1',
              description: 'Upper',
              blocks: [{ order: 1, exerciseName: 'Row', sets: 3, reps: '8' }],
            },
          ],
        },
      ],
    };
    const out = normalizeProgramSchedule(program);
    expect(out.schedule).toHaveLength(1);
    expect(out.schedule![0].workouts[0].exerciseBlocks).toHaveLength(1);
    expect(out.schedule![0].workouts[0].exerciseBlocks![0].exercises[0].exerciseName).toBe('Row');
  });

  it('normalizes multiple weeks with mixed blocks and exerciseBlocks', () => {
    const program = {
      schedule: [
        {
          weekNumber: 1,
          workouts: [
            {
              title: 'W1',
              description: 'D',
              blocks: [{ order: 1, exerciseName: 'A', sets: 1, reps: '5' }],
            },
          ],
        },
        {
          weekNumber: 2,
          workouts: [
            {
              title: 'W2',
              description: 'D',
              exerciseBlocks: [
                {
                  order: 1,
                  name: 'Main',
                  exercises: [
                    { order: 1, exerciseName: 'B', sets: 1, reps: 6 as unknown as string },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const out = normalizeProgramSchedule(program);
    expect(out.schedule![0].workouts[0].exerciseBlocks![0].exercises[0].exerciseName).toBe('A');
    expect(out.schedule![1].workouts[0].exerciseBlocks![0].exercises[0].reps).toBe('6');
  });

  it('empty schedule returns unchanged', () => {
    const program = { schedule: [] };
    const out = normalizeProgramSchedule(program);
    expect(out.schedule).toEqual([]);
    expect(out).toBe(program);
  });

  it('missing schedule returns unchanged', () => {
    const program = { title: 'P' };
    const out = normalizeProgramSchedule(program);
    expect(out).toBe(program);
  });
});

describe('normalizeWorkoutSet', () => {
  it('normalizes flat workouts with legacy blocks', () => {
    const set = {
      title: 'Set',
      description: 'D',
      difficulty: 'beginner' as const,
      workouts: [
        {
          title: 'S1',
          description: 'D',
          blocks: [{ order: 1, exerciseName: 'Lunge', sets: 2, reps: '10' }],
        },
      ],
    };
    const out = normalizeWorkoutSet(set);
    expect(out.workouts).toHaveLength(1);
    expect(out.workouts![0].exerciseBlocks).toHaveLength(1);
    expect(out.workouts![0].exerciseBlocks![0].exercises[0].exerciseName).toBe('Lunge');
  });

  it('empty workouts array returns unchanged', () => {
    const set = { title: 'S', description: 'D', workouts: [] };
    const out = normalizeWorkoutSet(set);
    expect(out.workouts).toEqual([]);
    expect(out).toBe(set);
  });

  it('missing workouts returns unchanged', () => {
    const set = { title: 'S', description: 'D' };
    const out = normalizeWorkoutSet(set);
    expect(out).toBe(set);
  });
});

describe('getExercisesFromWorkout', () => {
  it('returns blocks when only blocks present', () => {
    const workout: ProgramWorkout = {
      title: 'T',
      description: 'D',
      blocks: [
        { order: 1, exerciseName: 'A', sets: 1, reps: '5' },
        { order: 2, exerciseName: 'B', sets: 1, reps: '5' },
      ],
    };
    const exs = getExercisesFromWorkout(workout);
    expect(exs).toHaveLength(2);
    expect(exs[0].exerciseName).toBe('A');
    expect(exs[1].exerciseName).toBe('B');
  });

  it('returns flatMapped exercises when exerciseBlocks present', () => {
    const workout: ProgramWorkout = {
      title: 'T',
      description: 'D',
      exerciseBlocks: [
        { order: 1, name: 'M', exercises: [{ order: 1, exerciseName: 'X', sets: 1, reps: '5' }] },
        { order: 2, name: 'F', exercises: [{ order: 1, exerciseName: 'Y', sets: 1, reps: '5' }] },
      ],
    };
    const exs = getExercisesFromWorkout(workout);
    expect(exs).toHaveLength(2);
    expect(exs[0].exerciseName).toBe('X');
    expect(exs[1].exerciseName).toBe('Y');
  });

  it('exerciseBlocks wins when both blocks and exerciseBlocks present', () => {
    const workout: ProgramWorkout = {
      title: 'T',
      description: 'D',
      blocks: [{ order: 1, exerciseName: 'Legacy', sets: 1, reps: '1' }],
      exerciseBlocks: [
        {
          order: 1,
          name: 'Main',
          exercises: [{ order: 1, exerciseName: 'Canonical', sets: 1, reps: '1' }],
        },
      ],
    };
    const exs = getExercisesFromWorkout(workout);
    expect(exs).toHaveLength(1);
    expect(exs[0].exerciseName).toBe('Canonical');
  });

  it('returns empty array when neither blocks nor exerciseBlocks', () => {
    const workout: ProgramWorkout = { title: 'T', description: 'D' };
    const exs = getExercisesFromWorkout(workout);
    expect(exs).toEqual([]);
  });

  it('returns empty array for empty exerciseBlocks', () => {
    const workout: ProgramWorkout = {
      title: 'T',
      description: 'D',
      exerciseBlocks: [],
    };
    const exs = getExercisesFromWorkout(workout);
    expect(exs).toEqual([]);
  });
});
