/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Transform WorkoutInSet (timer schema) into HIITWorkoutData for the Dynamic Protocol Engine.
 */

import type {
  WorkoutInSet,
  HIITWorkoutData,
  HIITTimelineBlock,
  HIITTargetGoal,
  HiitPrimaryGoal,
} from '@/types/ai-workout';
/** Default duration in seconds per warmup item when schema has no duration. Replace when chain adds duration. */
const DEFAULT_WARMUP_SECONDS_PER_ITEM = 60;

/** Default duration in seconds per cooldown item when schema has no duration. */
const DEFAULT_COOLDOWN_SECONDS_PER_ITEM = 60;

/**
 * True if the workout uses the timer schema (any exercise in exerciseBlocks has workSeconds).
 */
export function isHIITWorkout(workout: WorkoutInSet): boolean {
  const blocks = workout.exerciseBlocks ?? [];
  for (const block of blocks) {
    for (const ex of block.exercises ?? []) {
      if (typeof ex.workSeconds === 'number' && ex.workSeconds >= 1) {
        return true;
      }
    }
  }
  return false;
}

function mapPrimaryGoalToTargetGoal(goal?: HiitPrimaryGoal): HIITTargetGoal {
  switch (goal) {
    case 'vo2_max':
      return 'VO2';
    case 'lactate_tolerance':
      return 'Lactate';
    case 'explosive_power':
      return 'Power';
    case 'fat_oxidation':
      return 'FatOx';
    default:
      return 'VO2';
  }
}

const SCIENCE_BY_GOAL: Record<
  HIITTargetGoal,
  { title: string; summary: string; benefit1: string; benefit2: string }
> = {
  VO2: {
    title: 'VO2 Max & Oxygen Deficit',
    summary:
      'Short work intervals with incomplete rest keep your heart rate elevated and stress the aerobic and anaerobic systems, improving maximal oxygen uptake and recovery between efforts.',
    benefit1: 'Increased Aerobic Capacity',
    benefit2: 'Faster Recovery Between Intervals',
  },
  Lactate: {
    title: 'Glycolytic Tolerance',
    summary:
      'By resting long enough to partially recover, you can hit the next interval at high power, creating a specific burning sensation that signals lactate buffering adaptation.',
    benefit1: 'Increased Anaerobic Threshold',
    benefit2: 'Faster Recovery Between Sprints',
  },
  Power: {
    title: 'Explosive Power & Rate of Force',
    summary:
      'Short, max-effort intervals with full or near-full recovery train the phosphagen system and neuromuscular coordination for speed and power.',
    benefit1: 'Higher Peak Power Output',
    benefit2: 'Improved Neuromuscular Recruitment',
  },
  FatOx: {
    title: 'Fat Oxidation & Metabolic Flexibility',
    summary:
      'Moderate-intensity intervals with balanced work and rest improve the body’s ability to use fat as fuel and switch between energy systems efficiently.',
    benefit1: 'Improved Fat Oxidation at Higher Intensities',
    benefit2: 'Better Metabolic Flexibility',
  },
};

export interface WorkoutInSetToHIITOptions {
  protocol?: string;
  primaryGoal?: HiitPrimaryGoal;
}

/**
 * Builds a linear timeline and meta/science from a WorkoutInSet (timer schema).
 * Warmup/cooldown blocks have no duration in the schema; use default seconds per item.
 */
export function workoutInSetToHIITWorkoutData(
  workout: WorkoutInSet,
  options?: WorkoutInSetToHIITOptions
): HIITWorkoutData {
  const targetGoal = mapPrimaryGoalToTargetGoal(options?.primaryGoal);
  const science = SCIENCE_BY_GOAL[targetGoal];
  const timeline: HIITTimelineBlock[] = [];

  const overrides = workout.exerciseOverrides;
  const getPrimaryImage = (exerciseName: string): string | undefined =>
    overrides?.[exerciseName]?.images?.[0];

  // Warmup
  const warmupBlocks = workout.warmupBlocks ?? [];
  for (const item of warmupBlocks) {
    timeline.push({
      type: 'warmup',
      duration: DEFAULT_WARMUP_SECONDS_PER_ITEM,
      name: item.exerciseName,
      notes: item.instructions?.[0],
      imageUrl: getPrimaryImage(item.exerciseName),
    });
  }

  // Main: circuit format — each round = 1 set of every exercise in sequence, then rest between rounds
  const exerciseBlocks = workout.exerciseBlocks ?? [];
  for (const block of exerciseBlocks) {
    const exercises = (block.exercises ?? []).filter(
      (ex) => typeof ex.workSeconds === 'number' && ex.workSeconds >= 1
    );
    if (exercises.length === 0) continue;

    // Circuit-style: one round = full pass through all exercises. We use max of exercises' rounds so the sequence repeats that many times; exercises with lower round counts in the schema are repeated to match (validation can enforce uniform rounds if desired).
    const numRounds = Math.max(
      1,
      ...exercises.map((ex) => (typeof ex.rounds === 'number' && ex.rounds >= 1 ? ex.rounds : 1))
    );
    // Reconcile rest between rounds: use value from all exercises if uniform, else max (avoids shortening rest below any exercise's value).
    const validRestSeconds = exercises
      .map((ex) =>
        typeof ex.restSeconds === 'number' && ex.restSeconds >= 0 ? ex.restSeconds : undefined
      )
      .filter((v): v is number => v !== undefined);
    const restBetweenRounds =
      validRestSeconds.length === 0
        ? 30
        : validRestSeconds.every((v) => v === validRestSeconds[0])
          ? validRestSeconds[0]
          : Math.max(...validRestSeconds);

    for (let r = 0; r < numRounds; r++) {
      for (const ex of exercises) {
        timeline.push({
          type: 'work',
          duration: ex.workSeconds!,
          name: ex.exerciseName,
          notes: ex.coachNotes,
          imageUrl: getPrimaryImage(ex.exerciseName),
        });
        const restAfterExercise =
          typeof ex.restSeconds === 'number' && ex.restSeconds >= 0
            ? ex.restSeconds
            : restBetweenRounds;
        timeline.push({
          type: 'rest',
          duration: restAfterExercise,
          name: 'Rest',
          notes: undefined,
        });
      }
      if (r < numRounds - 1) {
        timeline.push({
          type: 'rest',
          duration: restBetweenRounds,
          name: 'Rest between rounds',
          notes: undefined,
        });
      }
    }
  }

  // Cooldown
  const cooldownBlocks = workout.cooldownBlocks ?? [];
  for (const item of cooldownBlocks) {
    timeline.push({
      type: 'cooldown',
      duration: DEFAULT_COOLDOWN_SECONDS_PER_ITEM,
      name: item.exerciseName,
      notes: item.instructions?.[0],
    });
  }

  const totalSeconds = timeline.reduce((acc, b) => acc + b.duration, 0);
  const durationMin = Math.round(totalSeconds / 60);

  return {
    meta: {
      title: workout.title ?? 'HIIT Workout',
      protocol: options?.protocol ?? 'Standard Ratio',
      description: workout.description ?? '',
      targetGoal,
      durationMin,
    },
    science: {
      title: science.title,
      summary: science.summary,
      benefit1: science.benefit1,
      benefit2: science.benefit2,
    },
    timeline,
  };
}
