/**
 * Map trainer library `public.workouts.blocks` (WorkoutBlock[]) to AMRAP attach inputs:
 * flat exercise name list + duration. Rich HIIT/timer structure stays in DB; v1 AMRAP uses names only.
 */

import type { WorkoutBlock } from '@/lib/supabase/admin/workout-details';

const DEFAULT_DURATION_MINUTES = 15;

const BLOCK_ORDER: WorkoutBlock['type'][] = ['warmup', 'main', 'finisher', 'cooldown'];

function sortBlocksStable(blocks: WorkoutBlock[]): WorkoutBlock[] {
  return [...blocks].sort((a, b) => {
    const ai = BLOCK_ORDER.indexOf(a.type);
    const bi = BLOCK_ORDER.indexOf(b.type);
    if (ai !== bi) return ai - bi;
    return (a.order ?? 0) - (b.order ?? 0);
  });
}

/**
 * Flatten ordered exercise display names from stored blocks (warmup → main(s) → finisher → cooldown).
 */
export function workoutBlocksToAmrapExerciseNames(blocks: unknown): string[] {
  if (!Array.isArray(blocks) || blocks.length === 0) return [];
  const typed = blocks as WorkoutBlock[];
  const names: string[] = [];
  for (const block of sortBlocksStable(typed)) {
    for (const ex of block.exercises ?? []) {
      const n = typeof ex.name === 'string' ? ex.name.trim() : '';
      if (n) names.push(n);
    }
  }
  return names;
}

export interface AmrapAttachFromWorkoutRowInput {
  blocks: unknown;
  durationMinutes: number | null | undefined;
}

export interface AmrapAttachFromWorkoutRowResult {
  workoutList: string[];
  durationMinutes: number;
}

/**
 * Build RPC-ready list + duration for `trainer_live_attach_amrap_session`.
 * @throws If flattened list is empty (invalid attach).
 */
export function workoutRowToAmrapAttachParams(
  input: AmrapAttachFromWorkoutRowInput
): AmrapAttachFromWorkoutRowResult {
  const workoutList = workoutBlocksToAmrapExerciseNames(input.blocks);
  if (workoutList.length === 0) {
    throw new Error('This workout has no exercises to use for AMRAP.');
  }
  const dm = input.durationMinutes;
  const durationMinutes =
    typeof dm === 'number' && Number.isFinite(dm) && dm >= 1 && dm <= 180
      ? Math.round(dm)
      : DEFAULT_DURATION_MINUTES;
  return { workoutList, durationMinutes };
}
