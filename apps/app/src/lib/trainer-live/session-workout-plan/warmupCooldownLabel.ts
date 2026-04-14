/**
 * MVP: encode warmup/cooldown exercises into `trainer_live_activity_begin_segment` `p_label`
 * (no DB migration for segment exercise lists).
 */
export function segmentLabelFromPlanExercises(
  blockLabel: string | undefined,
  exercises: string[],
  fallbackSegmentTitle: string
): string {
  const lines = exercises.map((s) => s.trim()).filter(Boolean);
  if (lines.length === 0) return fallbackSegmentTitle;
  const head = blockLabel?.trim() || fallbackSegmentTitle;
  return `${head} — ${lines.join(' · ')}`;
}
