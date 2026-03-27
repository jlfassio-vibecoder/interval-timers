/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Readiness fit: compares ReadinessCheckIn form state to workout intensity/focus/duration.
 * Pure functions for WorkoutSummaryModal and tests.
 */

import type { WorkoutLog } from '@/types';
import { inferMETFromWorkout } from '@/lib/met';
import {
  type DailyCheckInFormState,
  type MuscleGroupArea,
  clampInt,
  getSorenessLevel,
} from '@/lib/readiness-daily-check-in';

export interface ReadinessFitResult {
  overall: number;
  energy: number;
  sleepQuality: number;
  stress: number;
  motivation: number;
  soreness: number;
  focus: number;
}

const W = 1 / 6;

function clampPercent(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** How close `actual` is to `ideal` on a 1–10 scale → 0–100. */
function linearFit10(actual: number, ideal: number): number {
  const diff = Math.abs(actual - ideal);
  return clampPercent(100 - diff * (100 / 9));
}

/**
 * Map MET (~3–10) to expected energy level (1–10) for the session.
 */
export function metToRequiredEnergyLevel(met: number): number {
  const t = Math.max(0, Math.min(1, (met - 3) / 6));
  return Math.round(4 + t * 5);
}

/**
 * Ideal raw stress level (1–10): harder sessions expect lower stress.
 */
export function stressIdealForMet(met: number): number {
  const t = Math.max(0, Math.min(1, (met - 3) / 6));
  return Math.round(9 - t * 6);
}

function sleepRequiredQuality(met: number, durationMinutes: number): number {
  const durFactor = Math.min(1, durationMinutes / 90);
  const metBoost = Math.round(((met - 3) / 6) * 3);
  const base = 5 + metBoost + Math.round(durFactor * 2);
  return clampInt(base, 5, 9);
}

function motivationIdeal(met: number, durationMinutes: number): number {
  const t = Math.max(0, Math.min(1, (met - 3) / 6));
  const dur = Math.min(1, durationMinutes / 90);
  return clampInt(Math.round(5 + t * 4 + dur), 5, 10);
}

/** Map training-log focus_area string to muscle group; null if unknown. */
export function focusAreaToMuscleGroup(focusArea: string | undefined | null): MuscleGroupArea | null {
  if (!focusArea) return null;
  const lower = focusArea.toLowerCase();
  const groups: MuscleGroupArea[] = ['legs', 'chest', 'back', 'shoulders', 'arms', 'core'];
  for (const g of groups) {
    if (lower.includes(g)) return g;
  }
  if (
    lower.includes('leg') ||
    lower.includes('quad') ||
    lower.includes('glute') ||
    lower.includes('lower body')
  ) {
    return 'legs';
  }
  if (lower.includes('chest') || lower.includes('pec')) return 'chest';
  if (lower.includes('lat') || lower.includes('lower back') || lower.includes('lower-back')) {
    return 'back';
  }
  if (lower.includes('back')) return 'back';
  if (lower.includes('shoulder') || lower.includes('delt')) return 'shoulders';
  if (lower.includes('bicep') || lower.includes('tricep') || lower.includes('arm')) return 'arms';
  if (lower.includes('core') || lower.includes('ab')) return 'core';
  return null;
}

function sorenessFitForMuscle(
  form: DailyCheckInFormState,
  muscle: MuscleGroupArea | null
): number {
  if (!muscle) return 85;
  const level = getSorenessLevel(form.soreness_areas, muscle);
  if (level === null) return 95;
  return clampPercent(100 - (level - 1) * (100 / 9));
}

function focusFitForMuscle(
  form: DailyCheckInFormState,
  muscle: MuscleGroupArea | null
): number {
  if (!muscle) return 70;
  const g = form.muscle_group_focus.find((x) => x.area === muscle);
  if (!g) return 45;
  return clampPercent(g.percentage);
}

/**
 * Compute readiness fit for a workout log and a daily check-in form.
 * Uses MET from source/format and duration; maps focus_area to muscle groups for soreness/focus bars.
 */
export function computeReadinessFit(
  form: DailyCheckInFormState,
  workout: Pick<WorkoutLog, 'source' | 'workoutFormat' | 'durationSeconds' | 'focusArea'>
): ReadinessFitResult {
  const met = inferMETFromWorkout(workout.source, workout.workoutFormat);
  const durationMinutes =
    workout.durationSeconds != null && workout.durationSeconds > 0
      ? workout.durationSeconds / 60
      : 30;

  const requiredEnergy = metToRequiredEnergyLevel(met);
  const energy = linearFit10(form.energy_level, requiredEnergy);

  const requiredSleep = sleepRequiredQuality(met, durationMinutes);
  const sleepQuality = linearFit10(form.sleep_quality, requiredSleep);

  const stressIdeal = stressIdealForMet(met);
  const stress = linearFit10(form.stress_level, stressIdeal);

  const motivationIdealVal = motivationIdeal(met, durationMinutes);
  const motivation = linearFit10(form.motivation_level, motivationIdealVal);

  const muscle = focusAreaToMuscleGroup(workout.focusArea);
  const soreness = sorenessFitForMuscle(form, muscle);
  const focus = focusFitForMuscle(form, muscle);

  const overall = clampPercent(
    energy * W + sleepQuality * W + stress * W + motivation * W + soreness * W + focus * W
  );

  return {
    overall,
    energy: clampPercent(energy),
    sleepQuality: clampPercent(sleepQuality),
    stress: clampPercent(stress),
    motivation: clampPercent(motivation),
    soreness: clampPercent(soreness),
    focus: clampPercent(focus),
  };
}
