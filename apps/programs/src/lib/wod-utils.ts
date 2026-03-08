/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Utility functions for WOD operations including protocol recommendation.
 */

import type { WorkoutDetail } from '@/types';
import type { GeneratedWODDoc } from '@/types/generated-wod';
import type { OverloadProtocol } from '@/types/overload-protocol';

/**
 * Extract all exercise names from a WorkoutDetail structure.
 */
export function extractAllExercises(workoutDetail: WorkoutDetail): string[] {
  const exercises: string[] = [];

  if (workoutDetail.warmup?.exercises) {
    exercises.push(...workoutDetail.warmup.exercises);
  }
  if (workoutDetail.main?.exercises) {
    exercises.push(...workoutDetail.main.exercises);
  }
  if (workoutDetail.finisher?.exercises) {
    exercises.push(...workoutDetail.finisher.exercises);
  }
  if (workoutDetail.cooldown?.exercises) {
    exercises.push(...workoutDetail.cooldown.exercises);
  }

  return exercises;
}

/**
 * Check if any exercises contain barbell-related keywords.
 */
function hasBarbellExercises(exercises: string[]): boolean {
  const barbellKeywords = [
    'barbell',
    'deadlift',
    'squat',
    'bench press',
    'overhead press',
    'clean',
    'snatch',
    'jerk',
    'row',
  ];

  return exercises.some((ex) => {
    const lower = ex.toLowerCase();
    return barbellKeywords.some((keyword) => lower.includes(keyword));
  });
}

/**
 * Check if all exercises are bodyweight-only (no external equipment).
 */
function isBodyweightOnly(exercises: string[]): boolean {
  const equipmentKeywords = [
    'dumbbell',
    'kettlebell',
    'barbell',
    'cable',
    'machine',
    'band',
    'plate',
    'medicine ball',
    'slam ball',
    'sandbag',
  ];

  return exercises.every((ex) => {
    const lower = ex.toLowerCase();
    return !equipmentKeywords.some((keyword) => lower.includes(keyword));
  });
}

/**
 * Get the recommended overload protocol based on the WOD's exercise composition.
 *
 * - linear_load: Recommended for barbell compounds (deadlifts, squats, presses)
 * - density_leverage: Recommended for bodyweight/calisthenics workouts
 * - double_progression: Default for mixed equipment (dumbbells, kettlebells, machines)
 */
export function getRecommendedProtocol(wod: GeneratedWODDoc): OverloadProtocol {
  const exercises = extractAllExercises(wod.workoutDetail);

  if (exercises.length === 0) {
    return 'double_progression';
  }

  // Check for barbell exercises first (strength focus)
  if (hasBarbellExercises(exercises)) {
    return 'linear_load';
  }

  // Check for bodyweight-only workouts
  if (isBodyweightOnly(exercises)) {
    return 'density_leverage';
  }

  // Default to double progression for mixed equipment
  return 'double_progression';
}

/**
 * Generate a unique lineage ID for tracking WOD iteration chains.
 * Requires crypto.randomUUID (browsers and Node 19+ / 18.15+). Throws if unavailable so we never emit weak IDs.
 */
export function generateLineageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fail explicitly: lineage tracking requires guaranteed uniqueness (per PR review; no Math.random fallback).
  throw new Error(
    'generateLineageId requires crypto.randomUUID. Use Node 18.15+ or a modern browser.'
  );
}

/**
 * Calculate the next iteration number for a WOD chain.
 * If the source WOD has no iteration metadata, this is iteration 1.
 * Otherwise, increment the source's iteration number.
 */
export function getNextIterationNumber(sourceWOD: GeneratedWODDoc): number {
  if (sourceWOD.iteration?.iteration_number) {
    return sourceWOD.iteration.iteration_number + 1;
  }
  return 1;
}

/**
 * Get the lineage ID for a new iteration.
 * If the source WOD has a lineage, continue it. Otherwise, start a new one.
 */
export function getLineageId(sourceWOD: GeneratedWODDoc): string {
  if (sourceWOD.iteration?.lineage_id) {
    return sourceWOD.iteration.lineage_id;
  }
  return generateLineageId();
}
