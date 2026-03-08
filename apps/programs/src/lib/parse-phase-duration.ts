/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Parses phase duration strings (e.g. "8 Minutes", "27 Minutes") to a number of minutes.
 * Used so Target Volume and Window can be derived from the sum of phase durations.
 */

/**
 * Extracts the first number of minutes from a phase duration string.
 * Returns 0 for empty, "—", or unparseable values.
 *
 * @example
 * parsePhaseDurationMinutes("8 Minutes") // 8
 * parsePhaseDurationMinutes("27 Minutes") // 27
 * parsePhaseDurationMinutes("5 min") // 5
 * parsePhaseDurationMinutes("—") // 0
 * parsePhaseDurationMinutes("") // 0
 * parsePhaseDurationMinutes("10:00") // 10
 */
export function parsePhaseDurationMinutes(duration: string): number {
  const trimmed = duration?.trim() ?? '';
  if (trimmed === '' || trimmed === '—') return 0;
  const match = trimmed.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}
