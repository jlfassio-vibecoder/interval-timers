/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Detect bilateral / per-limb prescriptions for gym set logging (reps per side).
 */

import type { SetLog } from '@/types/tracking';

/** Human-readable reps for session tables (L/R when both sides logged). */
export function formatSetRepsDisplay(set: SetLog): string {
  if (typeof set.actualRepsLeft === 'number' && typeof set.actualRepsRight === 'number') {
    return `L${set.actualRepsLeft} R${set.actualRepsRight}`;
  }
  return set.actualReps > 0 ? String(set.actualReps) : '—';
}

/**
 * True when the prescription is typically done left and right separately.
 * Matches common strings in reps lines and exercise names.
 */
export function isPerSidePrescription(targetReps: string, exerciseName = ''): boolean {
  const reps = targetReps.trim().toLowerCase();
  const name = exerciseName.trim().toLowerCase();
  const combined = `${reps} ${name}`;

  if (/\/\s*side\b/.test(reps)) return true;
  if (/\bper\s*side\b/.test(combined)) return true;
  if (/\beach\s*side\b/.test(combined)) return true;
  if (/\bper\s*(arm|leg)\b/.test(combined)) return true;
  if (/\b(left|right)\s*\/\s*(right|left)\b/.test(combined)) return true;
  if (/\bl\/r\b/.test(combined)) return true;

  return false;
}
