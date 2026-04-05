/**
 * Returns the active @mention segment before the cursor (no spaces allowed in the query).
 */
export function getActiveMentionSegment(
  value: string,
  cursor: number
): { start: number; end: number; query: string } | null {
  const before = value.slice(0, cursor);
  const at = before.lastIndexOf('@');
  if (at === -1) return null;
  const afterAt = before.slice(at + 1);
  if (/[\s\n]/.test(afterAt)) return null;
  return { start: at, end: cursor, query: afterAt };
}
