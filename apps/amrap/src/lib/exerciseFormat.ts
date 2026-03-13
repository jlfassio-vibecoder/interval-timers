/**
 * Exercise format validation for the Build Your Workout flow.
 * Matches workoutResults.ts EXERCISE_REGEX: qty must be \d+, \d+-\d+, or \d+m.
 */

export const QTY_REGEX = /^(\d+(?:-\d+)?|\d+m)$/;

export function isValidQty(qty: string): boolean {
  if (!qty || !qty.trim()) return true;
  return QTY_REGEX.test(qty.trim());
}

export function formatQtyHint(): string {
  return 'e.g. 10, 10-12, 5m';
}
