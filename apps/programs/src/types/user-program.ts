/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Types for user program entitlements (ownership / access).
 */

/**
 * User's access record for a program (stored at users/{userId}/programs/{programId})
 */
export interface UserProgramAccess {
  programId: string;
  purchasedAt: Date;
  status: 'active' | 'completed';
  /** When set, program is shown on the native app calendar starting this date (ISO YYYY-MM-DD). */
  startDate?: string;
  /** How the user got access; used to gate B2C upgrade prompts (trainer_assigned = no lock). */
  source?: 'self' | 'trainer_assigned' | 'cohort';
  /** From programs.duration_weeks; for progress display. */
  durationWeeks?: number;
  /** From programs.trainer_id; for trainer card resolution. */
  trainerId?: string;
  /** From programs.title; for list display without extra fetch. */
  title?: string;
}
