/**
 * Pure heuristic alignment of a workout log against a frozen goal snapshot (spec §4).
 * Scores are not persisted; bump ALIGNMENT_SCORER_VERSION when tables change.
 */

import type { WorkoutLog } from '@/types';
import type { PhysiologicalCalibration } from '@/lib/calculations';
import { type FitnessGoalId, normalizeFitnessGoalRanking } from '@/lib/fitness-goal-taxonomy';
import { deriveWorkoutFormat, deriveWorkoutType } from '@/lib/supabase/client/training-log';

export const ALIGNMENT_SCORER_VERSION = '1.2.0' as const;

export type { PhysiologicalCalibration } from '@/lib/calculations';

export interface GoalAlignmentResult {
  byGoalId: Partial<Record<FitnessGoalId, number>>;
  composite: number;
  scorerVersion: typeof ALIGNMENT_SCORER_VERSION;
}

export type GoalAlignmentTier = 'high' | 'mid' | 'low';

export interface GoalAlignmentAverage {
  averageComposite: number | null;
  scoredSessions: number;
  totalSessions: number;
}

/** Per-goal 0–100 hints from deriveWorkoutType (v1 tables, spec §4.3). */
const TYPE_SCORES: Partial<Record<string, Record<FitnessGoalId, number>>> = {
  Conditioning: {
    fat_loss: 76,
    cardiovascular_endurance: 78,
    muscle_hypertrophy: 64,
    longevity: 58,
    athletic_performance: 80,
    functional_strength: 70,
    mobility_flexibility: 48,
    stress_management: 52,
    weight_maintenance: 68,
    power_speed: 78,
  },
  'Cardiovascular Fitness': {
    fat_loss: 70,
    cardiovascular_endurance: 92,
    muscle_hypertrophy: 44,
    longevity: 60,
    athletic_performance: 85,
    functional_strength: 50,
    mobility_flexibility: 44,
    stress_management: 62,
    weight_maintenance: 66,
    power_speed: 72,
  },
  Mobility: {
    fat_loss: 34,
    cardiovascular_endurance: 40,
    muscle_hypertrophy: 30,
    longevity: 56,
    athletic_performance: 42,
    functional_strength: 48,
    mobility_flexibility: 90,
    stress_management: 70,
    weight_maintenance: 52,
    power_speed: 30,
  },
  Endurance: {
    fat_loss: 54,
    cardiovascular_endurance: 86,
    muscle_hypertrophy: 46,
    longevity: 80,
    athletic_performance: 72,
    functional_strength: 58,
    mobility_flexibility: 52,
    stress_management: 74,
    weight_maintenance: 78,
    power_speed: 58,
  },
  Other: {
    fat_loss: 50,
    cardiovascular_endurance: 50,
    muscle_hypertrophy: 50,
    longevity: 50,
    athletic_performance: 50,
    functional_strength: 50,
    mobility_flexibility: 50,
    stress_management: 50,
    weight_maintenance: 50,
    power_speed: 50,
  },
};

const FORMAT_SCORES: Record<string, Record<FitnessGoalId, number>> = {
  Tabata: {
    fat_loss: 82,
    cardiovascular_endurance: 88,
    muscle_hypertrophy: 50,
    longevity: 52,
    athletic_performance: 86,
    functional_strength: 52,
    mobility_flexibility: 38,
    stress_management: 44,
    weight_maintenance: 62,
    power_speed: 88,
  },
  AMRAP: {
    fat_loss: 78,
    cardiovascular_endurance: 84,
    muscle_hypertrophy: 58,
    longevity: 54,
    athletic_performance: 82,
    functional_strength: 60,
    mobility_flexibility: 40,
    stress_management: 46,
    weight_maintenance: 64,
    power_speed: 84,
  },
  EMOM: {
    fat_loss: 76,
    cardiovascular_endurance: 82,
    muscle_hypertrophy: 54,
    longevity: 56,
    athletic_performance: 80,
    functional_strength: 58,
    mobility_flexibility: 42,
    stress_management: 48,
    weight_maintenance: 63,
    power_speed: 82,
  },
  HIIT: {
    fat_loss: 83,
    cardiovascular_endurance: 86,
    muscle_hypertrophy: 52,
    longevity: 53,
    athletic_performance: 84,
    functional_strength: 54,
    mobility_flexibility: 38,
    stress_management: 45,
    weight_maintenance: 64,
    power_speed: 86,
  },
  Circuit: {
    fat_loss: 74,
    cardiovascular_endurance: 76,
    muscle_hypertrophy: 70,
    longevity: 58,
    athletic_performance: 74,
    functional_strength: 78,
    mobility_flexibility: 50,
    stress_management: 58,
    weight_maintenance: 70,
    power_speed: 62,
  },
  Mobility: {
    fat_loss: 36,
    cardiovascular_endurance: 42,
    muscle_hypertrophy: 32,
    longevity: 60,
    athletic_performance: 40,
    functional_strength: 48,
    mobility_flexibility: 92,
    stress_management: 72,
    weight_maintenance: 54,
    power_speed: 34,
  },
  'Steady State': {
    fat_loss: 48,
    cardiovascular_endurance: 74,
    muscle_hypertrophy: 42,
    longevity: 86,
    athletic_performance: 52,
    functional_strength: 58,
    mobility_flexibility: 62,
    stress_management: 82,
    weight_maintenance: 72,
    power_speed: 46,
  },
  unknown: {
    fat_loss: 54,
    cardiovascular_endurance: 56,
    muscle_hypertrophy: 52,
    longevity: 54,
    athletic_performance: 54,
    functional_strength: 54,
    mobility_flexibility: 54,
    stress_management: 54,
    weight_maintenance: 54,
    power_speed: 54,
  },
};

const DURATION_SCORES: Record<'short' | 'mid' | 'long', Record<FitnessGoalId, number>> = {
  short: {
    fat_loss: 58,
    cardiovascular_endurance: 60,
    muscle_hypertrophy: 48,
    longevity: 44,
    athletic_performance: 72,
    functional_strength: 46,
    mobility_flexibility: 42,
    stress_management: 40,
    weight_maintenance: 52,
    power_speed: 78,
  },
  mid: {
    fat_loss: 74,
    cardiovascular_endurance: 74,
    muscle_hypertrophy: 68,
    longevity: 70,
    athletic_performance: 76,
    functional_strength: 70,
    mobility_flexibility: 60,
    stress_management: 68,
    weight_maintenance: 72,
    power_speed: 68,
  },
  long: {
    fat_loss: 68,
    cardiovascular_endurance: 76,
    muscle_hypertrophy: 72,
    longevity: 84,
    athletic_performance: 62,
    functional_strength: 74,
    mobility_flexibility: 68,
    stress_management: 80,
    weight_maintenance: 78,
    power_speed: 52,
  },
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function durationBucket(minutes: number): 'short' | 'mid' | 'long' {
  if (minutes < 15) return 'short';
  if (minutes <= 45) return 'mid';
  return 'long';
}

/** Goals that receive a small HR-calibration nudge when profile physiology is known. */
const CARDIO_CALIBRATION_GOALS: ReadonlySet<FitnessGoalId> = new Set([
  'fat_loss',
  'cardiovascular_endurance',
  'athletic_performance',
  'power_speed',
]);

/** Expected relative intensity (0–1) by workout format for effort–format consistency checks. */
const FORMAT_EXPECTED_INTENSITY: Readonly<Record<string, number>> = {
  Tabata: 0.88,
  AMRAP: 0.85,
  EMOM: 0.83,
  HIIT: 0.87,
  Circuit: 0.72,
  Mobility: 0.52,
  'Steady State': 0.68,
  unknown: 0.65,
};

function impliedIntensityFromEffort(effort: number): number {
  const e = Number.isFinite(effort) ? effort : 5;
  return Math.max(0, Math.min(1, (e - 1) / 9));
}

/**
 * Bonus points when logged effort matches format-expected intensity and HR profile is calibrated.
 */
function physiologicalCalibrationAdjustment(
  goal: FitnessGoalId,
  log: WorkoutLog,
  calibration: PhysiologicalCalibration | null | undefined
): number {
  if (!calibration || calibration.tier === 'none') return 0;
  if (!CARDIO_CALIBRATION_GOALS.has(goal)) return 0;

  const formatKey = deriveWorkoutFormat(log) ?? 'unknown';
  const expected = FORMAT_EXPECTED_INTENSITY[formatKey] ?? FORMAT_EXPECTED_INTENSITY.unknown;
  const implied = impliedIntensityFromEffort(log.effort ?? 5);
  const gap = Math.abs(expected - implied);

  if (calibration.tier === 'full') {
    if (gap <= 0.15) return 2;
    if (gap <= 0.28) return 1;
    return 0;
  }
  if (gap <= 0.15) return 1;
  return 0;
}

function scoreOneGoal(
  goal: FitnessGoalId,
  log: WorkoutLog,
  calibration?: PhysiologicalCalibration | null
): number {
  const workoutType = deriveWorkoutType(log);
  const formatKey = deriveWorkoutFormat(log) ?? 'unknown';
  const formatLookup = FORMAT_SCORES[formatKey] ? formatKey : 'unknown';

  const t = TYPE_SCORES[workoutType]?.[goal] ?? TYPE_SCORES.Other![goal]!;
  const f = FORMAT_SCORES[formatLookup]![goal]!;
  const mins = Math.round((log.durationSeconds ?? 0) / 60);
  const d = DURATION_SCORES[durationBucket(mins)][goal]!;

  let combined = 0.35 * t + 0.35 * f + 0.3 * d;

  const effort = log.effort ?? 5;
  const effortDelta = (effort - 5) * 1.15;
  if (goal === 'fat_loss' || goal === 'muscle_hypertrophy') {
    combined += effortDelta * 0.18;
  } else if (goal === 'cardiovascular_endurance') {
    combined += effortDelta * 0.14;
  } else if (goal === 'power_speed' || goal === 'athletic_performance') {
    combined += effortDelta * 0.16;
  } else if (goal === 'functional_strength') {
    combined += effortDelta * 0.17;
  } else if (goal === 'weight_maintenance') {
    combined += effortDelta * 0.08;
  } else {
    combined -= effortDelta * 0.1;
  }

  const inten = (log.intensity ?? '').toLowerCase();
  if (inten.includes('high') || inten.includes('max') || inten.includes('vigorous')) {
    if (goal === 'longevity' || goal === 'stress_management' || goal === 'mobility_flexibility') {
      combined -= 7;
    }
    if (goal === 'fat_loss' || goal === 'cardiovascular_endurance') combined += 5;
    if (goal === 'muscle_hypertrophy') combined += 4;
    if (goal === 'power_speed' || goal === 'athletic_performance') combined += 6;
    if (goal === 'functional_strength') combined += 4;
    if (goal === 'weight_maintenance') combined += 2;
  }
  if (inten.includes('low') || inten.includes('easy') || inten.includes('recovery')) {
    if (goal === 'longevity' || goal === 'stress_management' || goal === 'mobility_flexibility') {
      combined += 6;
    }
    if (goal === 'fat_loss') combined -= 4;
    if (goal === 'power_speed' || goal === 'athletic_performance') combined -= 5;
    if (goal === 'weight_maintenance') combined += 3;
  }

  combined += physiologicalCalibrationAdjustment(goal, log, calibration);

  combined = clamp(combined, 0, 100);
  if (log.isActiveRest) {
    combined = Math.min(combined, 36);
  }
  return Math.round(combined);
}

/** Rank-weighted composite (spec §4.2). */
export function goalAlignmentComposite(
  orderedGoals: FitnessGoalId[],
  byGoalId: Partial<Record<FitnessGoalId, number>>
): number {
  const n = orderedGoals.length;
  if (n === 0) return 0;
  const weights = n === 1 ? [1] : n === 2 ? [0.625, 0.375] : [0.5, 0.3, 0.2];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const g = orderedGoals[i]!;
    sum += weights[i]! * (byGoalId[g] ?? 0);
  }
  return Math.round(clamp(sum, 0, 100));
}

/**
 * @returns null when there is no snapshot to score (legacy / no goals on file).
 * @param physiologicalCalibration - Optional profile HR/DOB calibration; when omitted, scores match pre-1.2.0 behavior for the same log.
 */
export function computeGoalAlignment(
  log: WorkoutLog,
  goalSnapshot: string[] | null | undefined,
  physiologicalCalibration?: PhysiologicalCalibration | null
): GoalAlignmentResult | null {
  if (goalSnapshot == null || goalSnapshot.length === 0) return null;

  const ordered = normalizeFitnessGoalRanking(goalSnapshot);
  if (ordered.length === 0) return null;

  const byGoalId: Partial<Record<FitnessGoalId, number>> = {};
  for (const g of ordered) {
    byGoalId[g] = scoreOneGoal(g, log, physiologicalCalibration);
  }

  return {
    byGoalId,
    composite: goalAlignmentComposite(ordered, byGoalId),
    scorerVersion: ALIGNMENT_SCORER_VERSION,
  };
}

/**
 * Composite for one log using persisted snapshot (or null if not scoreable).
 * Does not pass physiological calibration so exports and aggregates stay comparable without a user profile.
 */
export function alignmentCompositeForLog(log: WorkoutLog): number | null {
  return computeGoalAlignment(log, log.goalSnapshot)?.composite ?? null;
}

/** Mean composite over scoreable sessions only, with explicit coverage counts. */
export function averageAlignmentComposite(logs: WorkoutLog[]): GoalAlignmentAverage {
  let sum = 0;
  let scoredSessions = 0;
  for (const log of logs) {
    const composite = alignmentCompositeForLog(log);
    if (composite == null) continue;
    sum += composite;
    scoredSessions += 1;
  }
  return {
    averageComposite: scoredSessions > 0 ? Math.round(sum / scoredSessions) : null,
    scoredSessions,
    totalSessions: logs.length,
  };
}

export function alignmentTierFromComposite(composite: number): GoalAlignmentTier {
  if (composite >= 70) return 'high';
  if (composite >= 40) return 'mid';
  return 'low';
}
