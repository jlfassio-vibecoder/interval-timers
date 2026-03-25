import { describe, expect, it } from 'vitest';
import type { WorkoutLog } from '@/types';
import { exportTrainingLogToCsv } from './training-log-export';
import { alignmentCompositeForLog } from './fitness-goal-alignment';

function buildLog(over: Partial<WorkoutLog> = {}): WorkoutLog {
  return {
    id: 'log-1',
    userId: 'user-1',
    workoutName: 'Tabata',
    date: '2026-03-24',
    effort: 6,
    rating: 4,
    notes: '',
    durationSeconds: 20 * 60,
    source: 'tabata',
    ...over,
  };
}

describe('exportTrainingLogToCsv', () => {
  it('includes goal snapshot and computed composite columns', () => {
    const withGoals = buildLog({
      id: 'with-goals',
      goalSnapshot: ['fat_loss', 'longevity'],
    });
    const withoutGoals = buildLog({
      id: 'without-goals',
      goalSnapshot: null,
    });

    const csv = exportTrainingLogToCsv([withGoals, withoutGoals]);
    const lines = csv.split('\n');
    const header = lines[0]!;
    const rowWithGoals = lines[1]!;
    const rowWithoutGoals = lines[2]!;

    expect(header).toContain('goal_snapshot');
    expect(header).toContain('goal_alignment_composite');

    const expectedComposite = String(alignmentCompositeForLog(withGoals));
    expect(rowWithGoals).toContain('fat_loss|longevity');
    expect(rowWithGoals).toContain(expectedComposite);

    expect(rowWithoutGoals.endsWith(',,')).toBe(true);
  });
});
