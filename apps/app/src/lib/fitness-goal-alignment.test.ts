import { describe, expect, it } from 'vitest';
import type { WorkoutLog } from '@/types';
import { buildPhysiologicalCalibration } from '@/lib/calculations';
import type { FitnessGoalId } from '@/lib/fitness-goal-taxonomy';
import {
  ALIGNMENT_SCORER_VERSION,
  alignmentCompositeForLog,
  alignmentTierFromComposite,
  averageAlignmentComposite,
  computeGoalAlignment,
  goalAlignmentComposite,
} from './fitness-goal-alignment';

function baseLog(over: Partial<WorkoutLog> = {}): WorkoutLog {
  return {
    id: 'log-1',
    userId: 'user-1',
    workoutName: 'Tabata',
    date: '2025-03-01',
    effort: 5,
    rating: 4,
    notes: '',
    durationSeconds: 20 * 60,
    source: 'tabata',
    ...over,
  };
}

describe('computeGoalAlignment', () => {
  it('returns null for empty or missing snapshot', () => {
    expect(computeGoalAlignment(baseLog(), null)).toBeNull();
    expect(computeGoalAlignment(baseLog(), undefined)).toBeNull();
    expect(computeGoalAlignment(baseLog(), [])).toBeNull();
  });

  it('returns scorer version with result', () => {
    const r = computeGoalAlignment(baseLog(), ['fat_loss']);
    expect(r?.scorerVersion).toBe(ALIGNMENT_SCORER_VERSION);
  });

  it('golden: tabata 20m effort 5 three-goal snapshot', () => {
    const r = computeGoalAlignment(baseLog(), [
      'fat_loss',
      'cardiovascular_endurance',
      'longevity',
    ]);
    expect(r).not.toBeNull();
    expect(r!.byGoalId.fat_loss).toBe(75);
    expect(r!.byGoalId.cardiovascular_endurance).toBe(85);
    expect(r!.byGoalId.longevity).toBe(60);
    expect(r!.composite).toBe(75);
  });

  it('full physiological calibration increases cardio goal score when effort matches format', () => {
    const ref = new Date(Date.UTC(2025, 0, 1));
    const cal = buildPhysiologicalCalibration({
      dateOfBirth: '1990-05-01',
      manualMaxHrBpm: 192,
      restingHrBpm: 58,
      referenceDate: ref,
    });
    expect(cal.tier).toBe('full');
    const log = baseLog({ effort: 9 });
    const without = computeGoalAlignment(log, ['fat_loss'])!.byGoalId.fat_loss!;
    const withCal = computeGoalAlignment(log, ['fat_loss'], cal)!.byGoalId.fat_loss!;
    expect(withCal).toBe(without + 2);
  });

  it('scores extended goal ids for mobility-style warmup', () => {
    const r = computeGoalAlignment(
      baseLog({ source: 'daily-warmup', durationSeconds: 15 * 60, effort: 5 }),
      ['mobility_flexibility']
    );
    expect(r).not.toBeNull();
    const v = r!.byGoalId.mobility_flexibility!;
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(100);
    expect(v).toBeGreaterThan(70);
  });

  it('golden: active rest caps scores', () => {
    const r = computeGoalAlignment(
      baseLog({ isActiveRest: true, effort: 9 }),
      ['fat_loss', 'cardiovascular_endurance']
    );
    expect(r).not.toBeNull();
    expect(r!.byGoalId.fat_loss).toBeLessThanOrEqual(36);
    expect(r!.byGoalId.cardiovascular_endurance).toBeLessThanOrEqual(36);
  });

  it('ignores invalid snapshot ids', () => {
    const r = computeGoalAlignment(baseLog(), ['bogus', 'not_a_goal']);
    expect(r).toBeNull();
  });

  it('scores stay within 0–100 for random-ish logs', () => {
    const snapshots: FitnessGoalId[][] = [
      ['fat_loss'],
      ['muscle_hypertrophy', 'longevity'],
      ['cardiovascular_endurance', 'fat_loss', 'longevity'],
      ['power_speed', 'athletic_performance', 'functional_strength'],
      ['stress_management', 'weight_maintenance'],
    ];
    for (const snap of snapshots) {
      for (let d = 0; d <= 120; d += 20) {
        for (let e = 1; e <= 10; e++) {
          const log = baseLog({
            durationSeconds: d * 60,
            effort: e,
            source: e % 2 === 0 ? 'amrap' : 'daily-warmup',
            intensity: e > 7 ? 'High' : 'Moderate',
          });
          const r = computeGoalAlignment(log, snap);
          expect(r).not.toBeNull();
          for (const g of snap) {
            const v = r!.byGoalId[g];
            expect(v).toBeDefined();
            expect(v!).toBeGreaterThanOrEqual(0);
            expect(v!).toBeLessThanOrEqual(100);
          }
          expect(r!.composite).toBeGreaterThanOrEqual(0);
          expect(r!.composite).toBeLessThanOrEqual(100);
        }
      }
    }
  });
});

describe('goalAlignmentComposite', () => {
  it('renormalizes weights for two goals', () => {
    const by: Partial<Record<FitnessGoalId, number>> = {
      fat_loss: 80,
      longevity: 40,
    };
    expect(goalAlignmentComposite(['fat_loss', 'longevity'], by)).toBe(
      Math.round(0.625 * 80 + 0.375 * 40)
    );
  });

  it('single goal uses full weight', () => {
    expect(goalAlignmentComposite(['fat_loss'], { fat_loss: 73 })).toBe(73);
  });
});

describe('alignmentCompositeForLog', () => {
  it('returns null when log has no goal snapshot', () => {
    expect(alignmentCompositeForLog(baseLog({ goalSnapshot: null }))).toBeNull();
  });

  it('returns same composite as computeGoalAlignment', () => {
    const log = baseLog({
      goalSnapshot: ['fat_loss', 'cardiovascular_endurance', 'longevity'],
    });
    const fromHelper = alignmentCompositeForLog(log);
    const fromCompute = computeGoalAlignment(log, log.goalSnapshot)?.composite ?? null;
    expect(fromHelper).toBe(fromCompute);
  });
});

describe('averageAlignmentComposite', () => {
  it('averages only scoreable sessions and returns counts', () => {
    const scoredA = baseLog({ id: 'a', goalSnapshot: ['fat_loss'] });
    const scoredB = baseLog({
      id: 'b',
      source: 'amrap',
      durationSeconds: 45 * 60,
      goalSnapshot: ['cardiovascular_endurance'],
    });
    const unscored = baseLog({ id: 'c', goalSnapshot: null });
    const a = alignmentCompositeForLog(scoredA)!;
    const b = alignmentCompositeForLog(scoredB)!;
    const avg = averageAlignmentComposite([scoredA, scoredB, unscored]);
    expect(avg.scoredSessions).toBe(2);
    expect(avg.totalSessions).toBe(3);
    expect(avg.averageComposite).toBe(Math.round((a + b) / 2));
  });
});

describe('alignmentTierFromComposite', () => {
  it('maps thresholds consistently', () => {
    expect(alignmentTierFromComposite(70)).toBe('high');
    expect(alignmentTierFromComposite(69)).toBe('mid');
    expect(alignmentTierFromComposite(40)).toBe('mid');
    expect(alignmentTierFromComposite(39)).toBe('low');
  });
});
