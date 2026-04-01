/**
 * Maps between Workout Factory `workout_sets` / WorkoutInSet JSON and the admin
 * WorkoutEditor block UI (warmup / main / finisher / cooldown).
 */

import type { Exercise, ExerciseBlock, WarmupBlock } from '@/types/ai-program';
import type { WorkoutInSet } from '@/types/ai-workout';
import type { WorkoutBlock, BlockExercise } from '@/lib/supabase/admin/workout-details';

function newBlockExercise(partial: Partial<BlockExercise> & { name: string }): BlockExercise {
  return {
    id: partial.id ?? crypto.randomUUID(),
    name: partial.name,
    sets: partial.sets ?? 3,
    reps: partial.reps ?? '10',
    restSeconds: partial.restSeconds ?? 60,
    notes: partial.notes,
    weight: partial.weight,
  };
}

const defaultBlocks = (): WorkoutBlock[] => [
  { type: 'warmup', name: 'Warmup', order: 1, exercises: [] },
  { type: 'main', name: 'Main Circuit', order: 2, exercises: [] },
  { type: 'cooldown', name: 'Cooldown', order: 3, exercises: [] },
];

/**
 * Hydrate editor blocks from the first session in a workout set (Workout Factory shape).
 */
export function workoutInSetToBlocks(w: WorkoutInSet | undefined): WorkoutBlock[] {
  if (!w) return defaultBlocks();

  const blocks: WorkoutBlock[] = [];

  const warmupEx: BlockExercise[] = (w.warmupBlocks ?? []).map((wb) =>
    newBlockExercise({
      name: wb.exerciseName,
      sets: 1,
      reps: '',
      restSeconds: 0,
      notes: Array.isArray(wb.instructions) ? wb.instructions.join('\n') : '',
    })
  );
  blocks.push({
    type: 'warmup',
    name: 'Warm-up',
    order: 1,
    exercises: warmupEx,
  });

  const mains = w.exerciseBlocks ?? [];
  if (mains.length === 0) {
    blocks.push({ type: 'main', name: 'Main Circuit', order: 2, exercises: [] });
  } else {
    let order = 2;
    for (const eb of mains) {
      const exercises: BlockExercise[] = (eb.exercises ?? []).map((ex) =>
        newBlockExercise({
          id: ex.id,
          name: ex.exerciseName,
          sets: ex.sets,
          reps: String(ex.reps ?? ''),
          restSeconds: ex.restSeconds ?? 60,
          notes: ex.coachNotes,
        })
      );
      const t: WorkoutBlock['type'] =
        eb.name?.toLowerCase().includes('finish') ? 'finisher' : 'main';
      blocks.push({
        type: t,
        name: eb.name || 'Main',
        order: order++,
        exercises,
      });
    }
  }

  const coolEx: BlockExercise[] = (w.cooldownBlocks ?? []).map((wb) =>
    newBlockExercise({
      name: wb.exerciseName,
      sets: 1,
      reps: '',
      restSeconds: 0,
      notes: Array.isArray(wb.instructions) ? wb.instructions.join('\n') : '',
    })
  );
  blocks.push({
    type: 'cooldown',
    name: 'Cool-down',
    order: blocks.length + 1,
    exercises: coolEx,
  });

  return blocks.length > 0 ? blocks : defaultBlocks();
}

function blockExerciseToExercise(ex: BlockExercise, order: number): Exercise {
  return {
    order,
    exerciseName: ex.name,
    sets: typeof ex.sets === 'number' ? ex.sets : 3,
    reps: String(ex.reps ?? ''),
    restSeconds: typeof ex.restSeconds === 'number' ? ex.restSeconds : 60,
    coachNotes: ex.notes ?? '',
    ...(ex.id ? { id: ex.id } : {}),
  };
}

function blockExerciseToWarmupBlock(ex: BlockExercise, order: number): WarmupBlock {
  return {
    order,
    exerciseName: ex.name,
    instructions: ex.notes ? [ex.notes] : [''],
  };
}

/**
 * Persist editor blocks into a single WorkoutInSet, preserving extra fields from `prev`.
 */
export function blocksToWorkoutInSet(
  blocks: WorkoutBlock[],
  prev: WorkoutInSet | undefined,
  meta: { title: string; description: string }
): WorkoutInSet {
  const warmupBlocks = blocks
    .filter((b) => b.type === 'warmup')
    .flatMap((b) => b.exercises.map((ex, i) => blockExerciseToWarmupBlock(ex, i + 1)));

  const exerciseBlocks: ExerciseBlock[] = blocks
    .filter((b) => b.type === 'main' || b.type === 'finisher')
    .map((b, bi) => ({
      order: bi + 1,
      name: b.name,
      exercises: b.exercises.map((ex, i) => blockExerciseToExercise(ex, i + 1)),
    }));

  const cooldownBlocks = blocks
    .filter((b) => b.type === 'cooldown')
    .flatMap((b) => b.exercises.map((ex, i) => blockExerciseToWarmupBlock(ex, i + 1)));

  return {
    ...prev,
    title: meta.title,
    description: meta.description,
    warmupBlocks: warmupBlocks.length > 0 ? warmupBlocks : undefined,
    exerciseBlocks: exerciseBlocks.length > 0 ? exerciseBlocks : undefined,
    cooldownBlocks: cooldownBlocks.length > 0 ? cooldownBlocks : undefined,
  };
}
