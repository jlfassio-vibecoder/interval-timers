/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Types for the generated_wods collection (Supabase).
 * Same publish pattern as generated_exercises: pending | approved.
 */

import type { TimestampLike } from './timestamp';
import type { WODLevel, WorkoutDetail, Exercise } from '@/types';
import type { OverloadProtocol } from './overload-protocol';
import type { WODParameters, WorkoutFormat } from './wod-parameters';

export type GeneratedWODStatus = 'pending' | 'approved';

/**
 * Metadata for iterated WODs, tracking lineage and progression protocol.
 */
export interface IterationMetadata {
  /** Iteration number in the chain (1 = first iteration from source) */
  iteration_number: number;
  /** ID of the source WOD this was iterated from */
  source_wod_id: string;
  /** The overload protocol used for this iteration */
  protocol_used: OverloadProtocol;
  /** UUID to track the entire WOD "chain" (shared across all iterations) */
  lineage_id: string;
}

/**
 * Firestore document shape for generated_wods.
 * Maps to Artist + WorkoutDetail for UI; includes status and timestamps.
 */
export interface GeneratedWODDoc {
  id: string;
  level: WODLevel;
  name: string;
  genre: string;
  image: string;
  day: string;
  description: string;
  intensity: number;
  workoutDetail: WorkoutDetail;
  status: GeneratedWODStatus;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
  /** UID of the user who created this WOD (for rules). */
  generatedBy?: string;
  /** Per-exercise image/instruction overrides keyed by exercise name. */
  exerciseOverrides?: Record<string, Exercise>;
  /** Iteration metadata if this WOD was generated from a previous WOD. */
  iteration?: IterationMetadata;
  /** WOD generation parameters (for filtering and iteration). */
  parameters?: WODParameters;
  /** Resolved format used (from allowedFormats selection). */
  resolvedFormat?: WorkoutFormat;
  /** Display: target volume in hero (e.g. 45 → "45:00"). */
  targetVolumeMinutes?: number;
  /** Display: session window in Mission Parameters (e.g. 45 → "45 Minutes"). */
  windowMinutes?: number;
  /** Display: rest load in Mission Parameters (e.g. "Compressed"). */
  restLoad?: string;
}

/**
 * Input for creating a new generated WOD.
 * Omits id, createdAt, updatedAt (set by client/service).
 */
export type CreateGeneratedWODInput = Omit<GeneratedWODDoc, 'id' | 'createdAt' | 'updatedAt'> & {
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
};
