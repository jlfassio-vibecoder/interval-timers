/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Prompt Chain - 4-step macro-to-micro program generation
 */

export { buildArchitectPrompt, validateArchitectOutput } from './step1-architect';
export {
  buildChallengeArchitectPrompt,
  validateChallengeArchitectOutput,
  validateMilestones,
  type ChallengeArchitectOutput,
} from './step1-challenge-architect';
export { buildBiomechanistPrompt, validateBiomechanistOutput } from './step2-biomechanist';
export { buildCoachPrompt, validateCoachOutput } from './step3-coach';
export { buildMathematicianPrompt, validateMathematicianOutput } from './step4-mathematician';
export {
  buildWorkoutArchitectPrompt,
  validateWorkoutArchitectOutput,
} from './step1-workout-architect';
export {
  buildWorkoutMathematicianPrompt,
  validateWorkoutMathematicianOutput,
} from './step4-workout-mathematician';
export { buildWODBriefPrompt } from './wod-brief';
export {
  buildWODPrescriberPrompt,
  validateWODPrescriberOutput,
  type WODIterationContext,
} from './wod-prescriber';
