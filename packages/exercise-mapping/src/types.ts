/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Exercise {
  name: string;
  images: string[];
  instructions: string[];
  videoUrl?: string;
  /** When set, modal renders structured layout (intro, section title, steps with their own numbering). */
  instructionsStructured?: {
    intro?: string;
    sectionTitle?: string;
    steps: string[];
  };
}

export interface ExtendedBiomechanics {
  biomechanicalChain?: string;
  pivotPoints?: string;
  stabilizationNeeds?: string;
  commonMistakes?: string[];
}

/** Minimal input shape; apps pass full GeneratedExercise[]. */
export interface GeneratedExerciseInput {
  exerciseName: string;
  slug: string;
  imageUrl?: string | null;
  /** AI-generated plain-language instructions for the public (used for Deployment Steps when present). */
  userFriendlyInstructions?: string | null;
  biomechanics?: {
    performanceCues?: string[];
    biomechanicalChain?: string;
    pivotPoints?: string;
    stabilizationNeeds?: string;
    commonMistakes?: string[];
  } | null;
  videoUrl?: string | null;
  videos?: Array<{ videoUrl?: string; hidden?: boolean }>;
}
