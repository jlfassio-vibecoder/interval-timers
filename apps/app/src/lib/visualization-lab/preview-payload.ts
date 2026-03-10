/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared preview payload for Visualization Lab "Save Exercise" flow.
 */

import { generateSlug } from '@/lib/parse-biomechanics';
import { generateUniqueSlug } from '@/lib/supabase/client/generated-exercises';
import {
  parseBiomechanicalPoints,
  transformSearchResultsToSources,
} from '@/lib/parse-biomechanics';
import type { ParsedBiomechanics, ExerciseSource } from '@/types/generated-exercise';
import type { BiomechanicalPoints } from '@/lib/visualization-lab/types';

export interface SaveExercisePreviewPayload {
  image: string;
  /** Present when outputMode=sequence; length 3 for start, mid, end */
  images?: string[];
  exerciseName: string;
  slug: string;
  kineticChainType: string;
  biomechanics: ParsedBiomechanics;
  sources: ExerciseSource[];
  complexityLevel: string;
  visualStyle: string;
  imagePrompt: string;
  /** Present when outputMode=sequence; exactly 3 prompts for start, mid, end */
  imagePrompts?: string[];
}

export async function buildSaveExercisePreview(
  result: BiomechanicalPoints,
  exerciseTopic: string,
  complexityLevel: string,
  visualStyle: string
): Promise<SaveExercisePreviewPayload> {
  const baseSlug = generateSlug(exerciseTopic);
  const uniqueSlug = await generateUniqueSlug(baseSlug);
  const { biomechanics, kineticChainType } = parseBiomechanicalPoints(result.biomechanicalPoints);
  const sources = transformSearchResultsToSources(result.searchResults ?? [], exerciseTopic.trim());
  return {
    image: result.image,
    images: result.images,
    exerciseName: exerciseTopic.trim(),
    slug: uniqueSlug,
    kineticChainType,
    biomechanics,
    sources,
    complexityLevel,
    visualStyle,
    imagePrompt: result.imagePrompt ?? '',
    ...(result.imagePrompts &&
      result.imagePrompts.length === 3 && {
        imagePrompts: result.imagePrompts,
      }),
  };
}
