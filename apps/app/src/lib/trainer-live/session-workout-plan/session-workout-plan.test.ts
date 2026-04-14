import { describe, expect, it } from 'vitest';
import { savedWorkoutRowToSessionPlan } from './importSavedWorkout';
import { getFirstAmrapBlock, getFirstEmomBlock, getFirstTabataBlock, getPreferredOrFirstBlock } from './prefill';
import { parseTrainerLiveSessionWorkoutPlan } from './parse';
import { nonEmptyTrimmedExerciseLines } from './exerciseLines';
import { segmentLabelFromPlanExercises } from './warmupCooldownLabel';
import { applyImportedBlockToPlan } from './sessionPlanImport';

describe('parseTrainerLiveSessionWorkoutPlan', () => {
  it('parses valid blocks', () => {
    const p = parseTrainerLiveSessionWorkoutPlan({
      blocks: [
        { id: 'a', kind: 'warmup', exercises: ['A', 'B'] },
        {
          id: 'b',
          kind: 'amrap',
          durationMinutes: 12,
          exercises: ['C'],
        },
      ],
    });
    expect(p.blocks).toHaveLength(2);
    expect(p.blocks[0]?.kind).toBe('warmup');
    expect(p.blocks[1]?.kind).toBe('amrap');
    if (p.blocks[1]?.kind === 'amrap') {
      expect(p.blocks[1].durationMinutes).toBe(12);
    }
  });

  it('drops invalid blocks', () => {
    const p = parseTrainerLiveSessionWorkoutPlan({
      blocks: [{ kind: 'amrap', durationMinutes: 0, exercises: ['x'] }],
    });
    expect(p.blocks).toHaveLength(0);
  });
});

describe('prefill helpers', () => {
  it('returns first matching kind in order', () => {
    const plan = parseTrainerLiveSessionWorkoutPlan({
      blocks: [
        { id: '1', kind: 'tabata', roundCount: 8, exercises: ['a'] },
        { id: '2', kind: 'amrap', durationMinutes: 10, exercises: ['b'] },
        { id: '3', kind: 'amrap', durationMinutes: 20, exercises: ['c'] },
      ],
    });
    expect(getFirstAmrapBlock(plan)?.durationMinutes).toBe(10);
    expect(getFirstTabataBlock(plan)?.roundCount).toBe(8);
  });

  it('getFirstEmomBlock', () => {
    const plan = parseTrainerLiveSessionWorkoutPlan({
      blocks: [{ id: '1', kind: 'emom', roundCount: 12, exercises: ['x'] }],
    });
    expect(getFirstEmomBlock(plan)?.roundCount).toBe(12);
  });
});

describe('nonEmptyTrimmedExerciseLines', () => {
  it('trims and drops empties but preserves internal spacing in a line', () => {
    expect(nonEmptyTrimmedExerciseLines(['  Neck roll  ', '', 'Squat'])).toEqual([
      'Neck roll',
      'Squat',
    ]);
  });
});

describe('segmentLabelFromPlanExercises', () => {
  it('uses fallback when no exercises', () => {
    expect(segmentLabelFromPlanExercises(undefined, [], 'Warm-up')).toBe('Warm-up');
  });

  it('joins exercises', () => {
    expect(segmentLabelFromPlanExercises('Prep', ['Jump rope', 'Squats'], 'Warm-up')).toBe(
      'Prep — Jump rope · Squats'
    );
  });
});

describe('savedWorkoutRowToSessionPlan', () => {
  it('maps blocks to a single AMRAP block', () => {
    const p = savedWorkoutRowToSessionPlan({
      title: 'Test',
      blocks: [
        {
          type: 'warmup',
          order: 0,
          exercises: [{ name: 'Air squat', reps: '10' }],
        },
      ],
      durationMinutes: 20,
    });
    expect(p.blocks).toHaveLength(1);
    expect(p.blocks[0]?.kind).toBe('amrap');
    if (p.blocks[0]?.kind === 'amrap') {
      expect(p.blocks[0].durationMinutes).toBe(20);
      expect(p.blocks[0].exercises.length).toBeGreaterThan(0);
    }
  });
});

describe('sessionPlanImport', () => {
  it('replaces target block in-place', () => {
    const plan = parseTrainerLiveSessionWorkoutPlan({
      blocks: [
        { id: 'a', kind: 'warmup', exercises: ['one'] },
        { id: 'b', kind: 'amrap', durationMinutes: 10, exercises: ['old'] },
      ],
    });
    const next = applyImportedBlockToPlan(
      plan,
      { id: 'new', kind: 'amrap', durationMinutes: 20, exercises: ['new'], label: 'Loaded' },
      { kind: 'amrap', mode: 'replace_block', blockId: 'b' }
    );
    expect(next.blocks).toHaveLength(2);
    expect(next.blocks[1]?.id).toBe('b');
    if (next.blocks[1]?.kind === 'amrap') {
      expect(next.blocks[1].durationMinutes).toBe(20);
    }
  });
});

describe('getPreferredOrFirstBlock', () => {
  it('uses preferred id when present and valid', () => {
    const plan = parseTrainerLiveSessionWorkoutPlan({
      blocks: [
        { id: 'a', kind: 'amrap', durationMinutes: 10, exercises: ['a'] },
        { id: 'b', kind: 'amrap', durationMinutes: 20, exercises: ['b'] },
      ],
    });
    const selected = getPreferredOrFirstBlock(plan, 'amrap', 'b');
    expect(selected?.id).toBe('b');
  });
});
