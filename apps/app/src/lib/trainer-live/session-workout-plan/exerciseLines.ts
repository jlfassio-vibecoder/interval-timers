/** Trim each line and drop empties — use when validating RPC / modal pre-fill, not while typing. */
export function nonEmptyTrimmedExerciseLines(exercises: string[]): string[] {
  return exercises.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean);
}
