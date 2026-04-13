/**
 * Map Mission Control `public.workouts.blocks` to Tabata attach/begin RPC inputs:
 * flat exercise labels + round count (20/10 timing is fixed in `tabata_sessions`).
 */

import { workoutBlocksToAmrapExerciseNames } from '@/lib/trainer-live/amrap-workout-list-adapter';

const DEFAULT_ROUND_COUNT = 8;

export interface TabataAttachFromWorkoutRowInput {
  blocks: unknown;
  roundCount: number | null | undefined;
}

export interface TabataAttachFromWorkoutRowResult {
  workoutList: string[];
  roundCount: number;
}

/**
 * Client-side validation before `trainer_live_attach_tabata_session` /
 * `trainer_live_activity_begin_tabata_segment`.
 */
export function isValidTabataAttachInput(roundCount: number, workoutList: string[]): boolean {
  if (!Number.isFinite(roundCount) || roundCount < 1 || roundCount > 32) return false;
  const trimmed = workoutList.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean);
  return trimmed.length >= 1;
}

/**
 * Build RPC-ready list + round count for Tabata RPCs.
 * @throws If flattened list is empty (invalid attach).
 */
export function workoutRowToTabataAttachParams(
  input: TabataAttachFromWorkoutRowInput
): TabataAttachFromWorkoutRowResult {
  const workoutList = workoutBlocksToAmrapExerciseNames(input.blocks);
  if (workoutList.length === 0) {
    throw new Error('This workout has no exercises to use for Tabata.');
  }
  const rc = input.roundCount;
  const roundCount =
    typeof rc === 'number' && Number.isFinite(rc) && rc >= 1 && rc <= 32
      ? Math.round(rc)
      : DEFAULT_ROUND_COUNT;
  return { workoutList, roundCount };
}
