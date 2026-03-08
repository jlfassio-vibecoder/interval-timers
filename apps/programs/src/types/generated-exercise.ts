/**
 * Types for the generated_exercises collection (Supabase).
 * Stores complete exercise data including parsed biomechanics for detail pages.
 */

import type { TimestampLike } from './timestamp';

/**
 * Source reference with search verification pattern.
 * Instead of direct URLs (which may be hallucinated), we store search queries.
 */
export interface ExerciseSource {
  /** Display title (e.g., "VeryWellFit") */
  title: string;
  /** Domain for the source (e.g., "verywellfit.com") */
  domain: string;
  /** Google search query with site restriction */
  searchQuery: string;
}

/**
 * Parsed biomechanics data structure.
 * Extracted from the 5-point biomechanicalPoints array.
 */
export interface ParsedBiomechanics {
  /** Description of the kinetic chain and force transmission */
  biomechanicalChain: string;
  /** Primary and secondary pivot points */
  pivotPoints: string;
  /** Stabilization requirements */
  stabilizationNeeds: string;
  /** Common form errors (parsed into array) */
  commonMistakes: string[];
  /** Performance cues for proper execution (parsed into array) */
  performanceCues: string[];
}

export type GeneratedExerciseStatus = 'pending' | 'approved' | 'rejected';

/** Block suitability: which workout phases this exercise fits. */
export type SuitableBlock = 'warmup' | 'main' | 'finisher' | 'core' | 'cooldown';

/** When 'main' is in suitableBlocks: Strength, Cardio, or HIIT. */
export type MainWorkoutType = 'strength' | 'cardio' | 'hiit';

/**
 * Image role classifications for the exercise gallery.
 * - primary: The main header image
 * - secondary: Alternative angle or emphasis
 * - tertiary: Supporting view
 * - ghosted: Stylized/ghost effect version
 * - illustration: Illustrated/diagram version
 * - multiplicity: Sequence/multi-frame view (single composite)
 * - sequenceStart, sequenceMid, sequenceEnd: 3-image sequence phases
 */
export type ExerciseImageRole =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'ghosted'
  | 'illustration'
  | 'multiplicity'
  | 'sequenceStart'
  | 'sequenceMid'
  | 'sequenceEnd';

/**
 * Exercise image document structure for the images subcollection.
 * Path: generated_exercises/{exerciseId}/images/{imageId}
 */
export interface ExerciseImage {
  id: string;
  /** Parent exercise document ID */
  exerciseId: string;
  /** Role/classification of this image */
  role: ExerciseImageRole;
  /** Firebase Storage download URL */
  imageUrl: string;
  /** Firebase Storage path */
  storagePath: string;
  /** Original image prompt used for generation (if AI-generated) */
  imagePrompt?: string;
  /** Visual style (photorealistic, illustration, etc.) */
  visualStyle?: string;
  /** Document creation timestamp */
  createdAt: TimestampLike;
  /** UID of the user who added this image */
  createdBy: string;
  /** Sort order position (0-based) */
  position?: number;
  /** For anatomical images: which biomechanics section this illustrates */
  anatomicalSection?: 'chain' | 'pivot' | 'stabilization';
  /** If true, exclude from public display (stays in database) */
  hidden?: boolean;
}

/** Exercise video entry in GeneratedExercise.videos */
export interface ExerciseVideo {
  videoUrl: string;
  videoStoragePath: string;
  /** Display name (e.g. "Side angle view") */
  label?: string;
  /** If true, exclude from public display */
  hidden?: boolean;
  /** Sort order (0-based); lower = first */
  position?: number;
}

/**
 * Input type for creating a new exercise image.
 * Omits auto-generated fields.
 */
export type CreateExerciseImageInput = Omit<ExerciseImage, 'id' | 'createdAt'> & {
  createdAt?: TimestampLike;
};

/**
 * Full generated exercise document structure.
 * Used for the Exercise Details page with the "Iceberg Method" layout.
 */
export interface GeneratedExercise {
  id: string;
  /** URL-safe slug (e.g., "sandbag-reverse-lunge") */
  slug: string;
  /** Display name of the exercise */
  exerciseName: string;
  /** Firebase Storage download URL */
  imageUrl: string;
  /** Firebase Storage path */
  storagePath: string;
  /** Kinetic chain classification (e.g., "CLOSED-KINETIC CHAIN") */
  kineticChainType: string;
  /** Parsed biomechanical analysis */
  biomechanics: ParsedBiomechanics;
  /** Original image prompt used for generation */
  imagePrompt: string;
  /** Complexity level (beginner, intermediate, advanced) */
  complexityLevel: string;
  /** Visual style (photorealistic, illustration, etc.) */
  visualStyle: string;
  /** Verified source references */
  sources: ExerciseSource[];
  /** Approval status */
  status: GeneratedExerciseStatus;
  /** UID of the user who generated this exercise */
  generatedBy: string;
  /** When the exercise was generated */
  generatedAt: TimestampLike;
  /** Document creation timestamp */
  createdAt: TimestampLike;
  /** Last update timestamp */
  updatedAt: TimestampLike;
  /** When the exercise was rejected (if applicable) */
  rejectedAt?: TimestampLike;
  /** UID of the admin who rejected (if applicable) */
  rejectedBy?: string;
  /** Reason for rejection (if applicable) */
  rejectionReason?: string;
  /** Generated HTML content for the deep dive page */
  deepDiveHtmlContent?: string;
  /** AI-generated plain-language instructions for the public page (markdown). */
  userFriendlyInstructions?: string;
  /** Block suitability: which workout phases this exercise fits. */
  suitableBlocks?: SuitableBlock[];
  /** When 'main' is in suitableBlocks: Strength, Cardio, or HIIT. */
  mainWorkoutType?: MainWorkoutType;
  /** Firebase Storage download URL for exercise demonstration video (legacy, use videos[0]) */
  videoUrl?: string;
  /** Firebase Storage path for the video (legacy, use videos[0]) */
  videoStoragePath?: string;
  /** Multiple exercise demonstration videos; each new generation fills the next slot */
  videos?: ExerciseVideo[];
}

/**
 * Input type for creating a new generated exercise.
 * Omits auto-generated fields.
 */
export type CreateGeneratedExerciseInput = Omit<
  GeneratedExercise,
  'id' | 'createdAt' | 'updatedAt'
> & {
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
};
