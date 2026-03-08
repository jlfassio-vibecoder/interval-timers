/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Types for the Kinetic Prescription Engine: user inputs and scored programs.
 */

import type { ProgramMetadata } from '@/types/ai-program';

/**
 * User biometrics / constraints for prescription matching.
 */
export interface UserBiometrics {
  /** Selected equipment zone (e.g. garage gym, commercial gym). */
  zoneId: string;
  /** Days per week available for training (2–6). */
  daysPerWeek: number;
  /** Experience level. */
  experience: 'beginner' | 'intermediate' | 'advanced' | 'any';
  /** Body areas / injury tags (e.g. "shoulder", "knee", "back"). */
  injuries: string[];
  /** Optional goals for ranking (e.g. "strength", "hypertrophy", "endurance"). */
  goals?: string[];
  /** Optional duration filter: only show programs whose durationWeeks is in this array (e.g. [6, 8, 12]). Empty/undefined = no filter. */
  durationWeeksFilter?: number[];
}

/**
 * Program metadata extended with optional fields used only for scoring.
 * workoutsPerWeek and tags may be added later (e.g. from schedule or admin).
 */
export interface ProgramMetadataForScoring extends ProgramMetadata {
  id: string;
  /** Workouts per week (derived from schedule or admin). If missing, schedule penalty is skipped. */
  workoutsPerWeek?: number;
  /** Tags for injury logic (e.g. "overhead", "knee-dominant"). If missing, injury penalty is skipped. */
  tags?: string[];
}

/**
 * Per-component match percentages for Live Match Feed UI.
 */
export interface ComponentScores {
  equipment: number;
  experience: number;
  overall: number;
}

/**
 * A program with a match score and human-readable reasons.
 */
export type ScoredProgram = ProgramMetadata & {
  id: string;
  matchScore: number;
  matchReasons: string[];
  /** Optional breakdown for Live Match Feed bars (equipment %, experience %, overall %). */
  componentScores?: ComponentScores;
};
