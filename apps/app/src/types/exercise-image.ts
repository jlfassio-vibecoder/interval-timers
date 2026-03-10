/**
 * Types for the exercise_images collection (Supabase).
 * Stores generated exercise infographic metadata and links to Storage.
 */

import type { TimestampLike } from './timestamp';

export interface GenerationMetadata {
  biomechanicalPoints: string[];
  complexityLevel: string;
  imagePrompt: string;
  model: string;
  visualStyle: string;
}

export type ExerciseImageStatus = 'pending' | 'approved' | 'rejected';

export interface ExerciseImage {
  id: string;
  created_at: TimestampLike;
  updated_at: TimestampLike;
  exercise_name: string;
  file_size_bytes: number;
  generated_at: TimestampLike;
  generated_by: string;
  generation_metadata: GenerationMetadata;
  image_url: string;
  mime_type: string;
  position: number;
  status: ExerciseImageStatus;
  storage_path: string;
  rejected_at?: TimestampLike;
  rejected_by?: string;
  rejection_reason?: string;
  /** Optional link to exercises collection for association */
  exercise_id?: string | null;
}

export type CreateExerciseImageInput = Omit<ExerciseImage, 'id' | 'created_at' | 'updated_at'> & {
  created_at?: TimestampLike;
  updated_at?: TimestampLike;
};
