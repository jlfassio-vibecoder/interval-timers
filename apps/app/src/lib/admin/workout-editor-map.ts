/**
 * Maps between Workout Factory `workout_sets` / WorkoutInSet JSON and the admin
 * WorkoutEditor block UI (warmup / main / finisher / cooldown).
 *
 * Contract fields: `exerciseBlocks` = main work; `finisherBlocks` = finisher (WarmupBlock[]).
 * We do not infer finisher from exercise block names — that was lossy for round-trips.
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
  let order = 1;

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
    order: order++,
    exercises: warmupEx,
  });

  const mains = w.exerciseBlocks ?? [];
  if (mains.length === 0) {
    blocks.push({ type: 'main', name: 'Main Circuit', order: order++, exercises: [] });
  } else {
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
      blocks.push({
        type: 'main',
        name: eb.name || 'Main',
        order: order++,
        exercises,
      });
    }
  }

  const finisherEx: BlockExercise[] = (w.finisherBlocks ?? []).map((fb) =>
    newBlockExercise({
      name: fb.exerciseName,
      sets: 1,
      reps: '',
      restSeconds: 0,
      notes: Array.isArray(fb.instructions) ? fb.instructions.join('\n') : '',
    })
  );
  if (finisherEx.length > 0) {
    blocks.push({
      type: 'finisher',
      name: 'Finisher',
      order: order++,
      exercises: finisherEx,
    });
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
    order: order++,
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
    // Empty notes → no placeholder instruction rows (avoids blank UI lines downstream).
    instructions: ex.notes ? [ex.notes] : [],
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
    .filter((b) => b.type === 'main')
    .map((b, bi) => ({
      order: bi + 1,
      name: b.name,
      exercises: b.exercises.map((ex, i) => blockExerciseToExercise(ex, i + 1)),
    }));

  const finisherBlocks = blocks
    .filter((b) => b.type === 'finisher')
    .flatMap((b) => b.exercises.map((ex, i) => blockExerciseToWarmupBlock(ex, i + 1)));

  const cooldownBlocks = blocks
    .filter((b) => b.type === 'cooldown')
    .flatMap((b) => b.exercises.map((ex, i) => blockExerciseToWarmupBlock(ex, i + 1)));

  return {
    ...prev,
    title: meta.title,
    description: meta.description,
    warmupBlocks: warmupBlocks.length > 0 ? warmupBlocks : undefined,
    exerciseBlocks: exerciseBlocks.length > 0 ? exerciseBlocks : undefined,
    finisherBlocks: finisherBlocks.length > 0 ? finisherBlocks : undefined,
    cooldownBlocks: cooldownBlocks.length > 0 ? cooldownBlocks : undefined,
  };
}
