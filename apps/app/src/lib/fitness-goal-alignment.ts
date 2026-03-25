/**
 * Pure heuristic alignment of a workout log against a frozen goal snapshot (spec §4).
 * Scores are not persisted; bump ALIGNMENT_SCORER_VERSION when tables change.
 */

import type { WorkoutLog } from '@/types';
import { type FitnessGoalId, normalizeFitnessGoalRanking } from '@/lib/fitness-goal-taxonomy';
import { deriveWorkoutFormat, deriveWorkoutType } from '@/lib/supabase/client/training-log';

export const ALIGNMENT_SCORER_VERSION = '1.0.0' as const;

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
  },
  'Cardiovascular Fitness': {
    fat_loss: 70,
    cardiovascular_endurance: 92,
    muscle_hypertrophy: 44,
    longevity: 60,
  },
  Mobility: {
    fat_loss: 34,
    cardiovascular_endurance: 40,
    muscle_hypertrophy: 30,
    longevity: 56,
  },
  Endurance: {
    fat_loss: 54,
    cardiovascular_endurance: 86,
    muscle_hypertrophy: 46,
    longevity: 80,
  },
  Other: {
    fat_loss: 50,
    cardiovascular_endurance: 50,
    muscle_hypertrophy: 50,
    longevity: 50,
  },
};

const FORMAT_SCORES: Record<string, Record<FitnessGoalId, number>> = {
  Tabata: {
    fat_loss: 82,
    cardiovascular_endurance: 88,
    muscle_hypertrophy: 50,
    longevity: 52,
  },
  AMRAP: {
    fat_loss: 78,
    cardiovascular_endurance: 84,
    muscle_hypertrophy: 58,
    longevity: 54,
  },
  EMOM: {
    fat_loss: 76,
    cardiovascular_endurance: 82,
    muscle_hypertrophy: 54,
    longevity: 56,
  },
  HIIT: {
    fat_loss: 83,
    cardiovascular_endurance: 86,
    muscle_hypertrophy: 52,
    longevity: 53,
  },
  Circuit: {
    fat_loss: 74,
    cardiovascular_endurance: 76,
    muscle_hypertrophy: 70,
    longevity: 58,
  },
  Mobility: {
    fat_loss: 36,
    cardiovascular_endurance: 42,
    muscle_hypertrophy: 32,
    longevity: 60,
  },
  'Steady State': {
    fat_loss: 48,
    cardiovascular_endurance: 74,
    muscle_hypertrophy: 42,
    longevity: 86,
  },
  unknown: {
    fat_loss: 54,
    cardiovascular_endurance: 56,
    muscle_hypertrophy: 52,
    longevity: 54,
  },
};

const DURATION_SCORES: Record<'short' | 'mid' | 'long', Record<FitnessGoalId, number>> = {
  short: {
    fat_loss: 58,
    cardiovascular_endurance: 60,
    muscle_hypertrophy: 48,
    longevity: 44,
  },
  mid: {
    fat_loss: 74,
    cardiovascular_endurance: 74,
    muscle_hypertrophy: 68,
    longevity: 70,
  },
  long: {
    fat_loss: 68,
    cardiovascular_endurance: 76,
    muscle_hypertrophy: 72,
    longevity: 84,
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

function scoreOneGoal(goal: FitnessGoalId, log: WorkoutLog): number {
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
  } else {
    combined -= effortDelta * 0.1;
  }

  const inten = (log.intensity ?? '').toLowerCase();
  if (inten.includes('high') || inten.includes('max') || inten.includes('vigorous')) {
    if (goal === 'longevity') combined -= 7;
    if (goal === 'fat_loss' || goal === 'cardiovascular_endurance') combined += 5;
    if (goal === 'muscle_hypertrophy') combined += 4;
  }
  if (inten.includes('low') || inten.includes('easy') || inten.includes('recovery')) {
    if (goal === 'longevity') combined += 6;
    combined -= goal === 'fat_loss' ? 4 : 0;
  }

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
 */
export function computeGoalAlignment(
  log: WorkoutLog,
  goalSnapshot: string[] | null | undefined
): GoalAlignmentResult | null {
  if (goalSnapshot == null || goalSnapshot.length === 0) return null;

  const ordered = normalizeFitnessGoalRanking(goalSnapshot);
  if (ordered.length === 0) return null;

  const byGoalId: Partial<Record<FitnessGoalId, number>> = {};
  for (const g of ordered) {
    byGoalId[g] = scoreOneGoal(g, log);
  }

  return {
    byGoalId,
    composite: goalAlignmentComposite(ordered, byGoalId),
    scorerVersion: ALIGNMENT_SCORER_VERSION,
  };
}

/** Composite for one log using persisted snapshot (or null if not scoreable). */
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
