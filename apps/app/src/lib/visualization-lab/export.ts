/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Export utilities for Visualization Lab: download image and metadata.
 */

import {
  parseBiomechanicalPoints,
  transformSearchResultsToSources,
} from '@/lib/parse-biomechanics';
import type { ParsedBiomechanics, ExerciseSource } from '@/types/generated-exercise';
import type { BiomechanicalPoints } from '@/lib/visualization-lab/types';

export interface VizLabExportMetadata {
  exerciseName: string;
  exportedAt: string;
  formInputs: {
    complexityLevel: string;
    visualStyle: string;
    outputMode?: 'single' | 'sequence';
    demographics: string;
    movementPhase: string;
    bodySide: string;
    bodySideStart?: string;
    bodySideEnd?: string;
    formCuesToEmphasize?: string;
    misrenderingsToAvoid?: string;
    domainContext?: string;
  };
  biomechanicalPoints: string[];
  parsedBiomechanics: ParsedBiomechanics;
  kineticChainType: string;
  sources: ExerciseSource[];
  imagePrompt: string;
  /** Present when outputMode=sequence; length 3 */
  images?: string[];
  /** Present when outputMode=sequence; exactly 3 prompts for start, mid, end */
  imagePrompts?: string[];
}

/** Trigger browser download of a Blob */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Build export metadata from result and form state (no image data URL) */
export function buildExportMetadata(params: {
  exerciseTopic: string;
  complexityLevel: string;
  visualStyle: string;
  outputMode?: 'single' | 'sequence';
  demographics: string;
  movementPhase: string;
  bodySide: string;
  bodySideStart?: string;
  bodySideEnd?: string;
  formCuesToEmphasize?: string;
  misrenderingsToAvoid?: string;
  domainContext?: string;
  result: BiomechanicalPoints;
}): VizLabExportMetadata {
  const {
    exerciseTopic,
    complexityLevel,
    visualStyle,
    outputMode,
    demographics,
    movementPhase,
    bodySide,
    bodySideStart,
    bodySideEnd,
    formCuesToEmphasize,
    misrenderingsToAvoid,
    domainContext,
    result,
  } = params;
  const { biomechanics, kineticChainType } = parseBiomechanicalPoints(result.biomechanicalPoints);
  const sources = transformSearchResultsToSources(result.searchResults ?? [], exerciseTopic.trim());

  return {
    exerciseName: exerciseTopic.trim(),
    exportedAt: new Date().toISOString(),
    formInputs: {
      complexityLevel,
      visualStyle,
      ...(outputMode && { outputMode }),
      demographics,
      movementPhase,
      bodySide,
      ...(bodySideStart && { bodySideStart }),
      ...(bodySideEnd && { bodySideEnd }),
      ...(formCuesToEmphasize && { formCuesToEmphasize }),
      ...(misrenderingsToAvoid && { misrenderingsToAvoid }),
      ...(domainContext && { domainContext }),
    },
    biomechanicalPoints: result.biomechanicalPoints,
    parsedBiomechanics: biomechanics,
    kineticChainType,
    sources,
    imagePrompt: result.imagePrompt ?? '',
    ...(result.images && result.images.length === 3 && { images: result.images }),
    ...(result.imagePrompts &&
      result.imagePrompts.length === 3 && {
        imagePrompts: result.imagePrompts,
      }),
  };
}
