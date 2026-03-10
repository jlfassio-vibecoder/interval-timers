/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared logic for building approved-exercise maps from GeneratedExercise list.
 * Used by AppIslands, ActiveProgramView, and ProgramSalesView for unified
 * exercise resolution and canonical slug lookup.
 */

import type { Exercise } from '@/types';
import type { GeneratedExercise } from '@/types/generated-exercise';
import type { ExtendedBiomechanics } from '@/components/react/ExerciseDetailModal';
import { parseBiomechanicalPoints, FULL_BIOMECHANICS_CARD_LENGTH } from '@/lib/parse-biomechanics';

/**
 * Normalizes an exercise name to a consistent lookup key (e.g. "Arm Circles" → "arm circles").
 * Used when matching against the approved exercise map so that static data, WOD overrides,
 * and program workout exercise names resolve to canonical data when they match an approved
 * GeneratedExercise. Exercise names in static data (workouts, wod, tabata, complexes) and
 * in program schedules should match this normalized form for proper resolution and slug lookup.
 */
export function normalizeExerciseName(name: string): string {
  return name.toLowerCase().trim();
}

export interface ApprovedExerciseMaps {
  exerciseMap: Map<string, Exercise>;
  extendedMap: Map<string, ExtendedBiomechanics>;
  slugMap: Map<string, string>;
}

/**
 * Build name→Exercise, name→ExtendedBiomechanics, and name→slug maps from
 * an approved GeneratedExercise list. Uses normalized names (lowercase, trimmed) as keys.
 */
export function buildApprovedExerciseMaps(list: GeneratedExercise[]): ApprovedExerciseMaps {
  const exerciseMap = new Map<string, Exercise>();
  const extendedMap = new Map<string, ExtendedBiomechanics>();
  const slugMap = new Map<string, string>();

  list.forEach((genEx) => {
    const key = normalizeExerciseName(genEx.exerciseName);
    slugMap.set(key, genEx.slug);

    const rawCues = genEx.biomechanics?.performanceCues ?? [];
    let instructions: string[];
    let extended: ExtendedBiomechanics | undefined;

    if (rawCues.length >= FULL_BIOMECHANICS_CARD_LENGTH) {
      try {
        const parsed = parseBiomechanicalPoints(rawCues);
        instructions =
          parsed.biomechanics.performanceCues.length > 0
            ? parsed.biomechanics.performanceCues
            : [rawCues[FULL_BIOMECHANICS_CARD_LENGTH - 1]];
        extended = {
          biomechanicalChain: parsed.biomechanics.biomechanicalChain || undefined,
          pivotPoints: parsed.biomechanics.pivotPoints || undefined,
          stabilizationNeeds: parsed.biomechanics.stabilizationNeeds || undefined,
          commonMistakes:
            (parsed.biomechanics.commonMistakes?.length ?? 0) > 0
              ? parsed.biomechanics.commonMistakes
              : undefined,
        };
      } catch {
        instructions = rawCues;
        extended = genEx.biomechanics
          ? {
              biomechanicalChain: genEx.biomechanics.biomechanicalChain,
              pivotPoints: genEx.biomechanics.pivotPoints,
              stabilizationNeeds: genEx.biomechanics.stabilizationNeeds,
              commonMistakes: genEx.biomechanics.commonMistakes,
            }
          : undefined;
      }
    } else {
      instructions = rawCues;
      extended = genEx.biomechanics
        ? {
            biomechanicalChain: genEx.biomechanics.biomechanicalChain,
            pivotPoints: genEx.biomechanics.pivotPoints,
            stabilizationNeeds: genEx.biomechanics.stabilizationNeeds,
            commonMistakes: genEx.biomechanics.commonMistakes,
          }
        : undefined;
    }

    const primaryVideoUrl =
      genEx.videos && genEx.videos.length > 0
        ? (genEx.videos.find((v) => !v.hidden) ?? genEx.videos[0])?.videoUrl
        : genEx.videoUrl;
    exerciseMap.set(key, {
      name: genEx.exerciseName,
      images: genEx.imageUrl ? [genEx.imageUrl] : [],
      instructions,
      ...(primaryVideoUrl && { videoUrl: primaryVideoUrl }),
    });
    if (extended) {
      extendedMap.set(key, extended);
    }
  });

  return { exerciseMap, extendedMap, slugMap };
}
