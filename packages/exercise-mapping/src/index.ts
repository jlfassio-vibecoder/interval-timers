/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * @workout-generator/exercise-mapping
 * Shared logic for exercise resolution and canonical slug lookup.
 */

export {
  normalizeExerciseName,
  buildApprovedExerciseMaps,
  type ApprovedExerciseMaps,
} from './approved-maps.js';
export type { Exercise, ExtendedBiomechanics, GeneratedExerciseInput } from './types.js';
