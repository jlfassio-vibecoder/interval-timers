/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Training Log session-level intensity estimate (0-100).
 */

import type { WorkoutLog } from '@/types';
import type { ProfileBaseline } from '@/lib/met';
import { hasBaselineForMET, inferMETFromWorkout } from '@/lib/met';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Same effort semantics as goal-alignment: 1..10 -> 0..1. */
export function impliedIntensityFromEffort(effort: number): number {
  const e = Number.isFinite(effort) ? effort : 5;
  return clamp01((e - 1) / 9);
}

/** Display-oriented upper MET bound for normalization to 0..1. */
export const INTENSITY_MET_MAX = 12;
export const INTENSITY_EFFORT_WEIGHT = 0.6;
export const INTENSITY_MET_WEIGHT = 0.4;

export interface SessionIntensityContext {
  profileBaseline: ProfileBaseline | null;
}

export interface SessionIntensityEstimate {
  percent: number;
  effortFraction: number;
  metFraction: number;
  metValue: number | null;
  usedEffortWeight: number;
  usedMetWeight: number;
}

function normalizeMet(metValue: number): number {
  return clamp01((metValue - 1) / (INTENSITY_MET_MAX - 1));
}

/**
 * Blend subjective effort + workout-modality MET into a single 0..100 estimate.
 * When baseline is missing, MET is omitted and effort takes full weight.
 */
export function estimateSessionIntensity(
  log: WorkoutLog,
  context: SessionIntensityContext
): SessionIntensityEstimate {
  const effortFraction = impliedIntensityFromEffort(log.effort ?? 5);
  const hasMetContext =
    context.profileBaseline != null && hasBaselineForMET(context.profileBaseline);
  const metValue = hasMetContext ? inferMETFromWorkout(log.source, log.workoutFormat) : null;
  const metFraction = metValue != null ? normalizeMet(metValue) : 0;

  const usedEffortWeight = metValue != null ? INTENSITY_EFFORT_WEIGHT : 1;
  const usedMetWeight = metValue != null ? INTENSITY_MET_WEIGHT : 0;
  const combined = effortFraction * usedEffortWeight + metFraction * usedMetWeight;

  return {
    percent: Math.round(clamp01(combined) * 100),
    effortFraction,
    metFraction,
    metValue,
    usedEffortWeight,
    usedMetWeight,
  };
}

export function estimateSessionIntensityPercent(
  log: WorkoutLog,
  context: SessionIntensityContext
): number {
  return estimateSessionIntensity(log, context).percent;
}
