/** Mirrors trainer_live_attach_amrap_session validation for client-side checks (optional). */

export function isValidAttachWorkoutInput(
  durationMinutes: number,
  workoutList: string[]
): boolean {
  if (!Number.isFinite(durationMinutes) || !Number.isInteger(durationMinutes)) return false;
  if (durationMinutes < 1 || durationMinutes > 180) return false;
  if (!Array.isArray(workoutList) || workoutList.length < 1) return false;
  return workoutList.every((s) => typeof s === 'string');
}
