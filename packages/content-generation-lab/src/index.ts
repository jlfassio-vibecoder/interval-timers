/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * @interval-timers/content-generation-lab
 *
 * Reusable hooks for AI content generation flows (exercise images, insights, etc.).
 * Extracted from Visualization Lab for use across admin-dash-astro and programs.
 */

export { useReferenceImage } from './useReferenceImage';
export type { UseReferenceImageOptions, UseReferenceImageReturn } from './useReferenceImage';

export { useGenerationState } from './useGenerationState';
export type { UseGenerationStateOptions, UseGenerationStateReturn } from './useGenerationState';

export { useContentGenerationLab } from './useContentGenerationLab';
export type { UseContentGenerationLabOptions, UseContentGenerationLabReturn } from './useContentGenerationLab';

export { ContentGenerationLab } from './ContentGenerationLab';
export type { ContentGenerationLabProps } from './ContentGenerationLab';

export type {
  ReferenceState,
  PromptReviewInput,
  PromptStep,
  GenerationReturnTwoPhase,
} from './types';
