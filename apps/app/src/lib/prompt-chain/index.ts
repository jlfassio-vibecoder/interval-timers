/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Prompt Chain - scaffold + 4-step macro-to-micro program generation
 * Foundation: program steps only. Challenge/WOD/Workout steps added when those features migrate.
 */

export { buildScaffoldPrompt, validateScaffoldOutput } from './step0-scaffold';
export { buildArchitectPrompt, validateArchitectOutput } from './step1-architect';
export { buildBiomechanistPrompt, validateBiomechanistOutput } from './step2-biomechanist';
export { buildCoachPrompt, validateCoachOutput } from './step3-coach';
export { buildMathematicianPrompt, validateMathematicianOutput } from './step4-mathematician';
export {
  buildPublicCopyPrompt,
  validatePublicCopyOutput,
  type PublicCopyOutput,
} from './step5-public-copy';
export {
  buildWorkoutArchitectPrompt,
  validateWorkoutArchitectOutput,
} from './step1-workout-architect';
export {
  buildWorkoutMathematicianPrompt,
  validateWorkoutMathematicianOutput,
} from './step4-workout-mathematician';

// Re-exports for WODs
export * from './wod-brief';
export * from './wod-prescriber';
