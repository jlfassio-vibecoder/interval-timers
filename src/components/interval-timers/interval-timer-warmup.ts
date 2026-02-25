/**
 * Single source of truth for the Daily Warm-Up design used by all interval timers.
 * Update exercises or duration here; Tabata, Japanese Walking, WarmUpInterval, and
 * future timers will receive the change automatically.
 * Images are shown in the overlay header (top right). Partial match: if an image
 * filename (without extension) is contained in the exercise name (normalized), we use it.
 */

import type { HIITTimelineBlock } from '@/types/ai-workout';

const WARMUP_IMAGES_BASE = '/images/warmup';

/** Existing images in public/images/warmup/. Exercise name is matched partially (e.g. "Cervical" matches "Cervical CARs - Left"). */
const WARMUP_IMAGE_MAP: { pattern: string; file: string }[] = [
  { pattern: 'Cervical', file: 'cervical-cars-controlled-articular-rotation-1771688719107.png' },
  { pattern: 'Glenohumeral', file: 'glenohumeral-cars-controlled-articular-rotation-1771689358939.png' },
  { pattern: 'Scapular', file: 'scapular-cars-controlled-articular-rotation.png' },
  { pattern: 'Thoracic', file: 'thoracic-cars.png' },
  { pattern: 'Hip CARs', file: 'hip-cars-controlled-articular-rotation.png' },
  { pattern: 'Tibial', file: 'tibial-cars.png' },
  { pattern: 'Ankle', file: 'ankle-cars.png' },
  { pattern: 'Swimmers', file: 'swimmers-frc-hove.png' },
  { pattern: 'Press-Press', file: 'press-press-fling.png' },
  { pattern: 'Adductor', file: 'adductor-rocking.png' },
  { pattern: 'Segmental', file: 'segmental-cat-cows.png' },
  { pattern: "Child's Pose", file: 'childs-pose.png' },
];

export function getWarmupImageUrl(exerciseName: string): string | undefined {
  const name = exerciseName.trim();
  const match = WARMUP_IMAGE_MAP.find(({ pattern }) =>
    name.toLowerCase().includes(pattern.toLowerCase())
  );
  return match ? `${WARMUP_IMAGES_BASE}/${match.file}` : undefined;
}

/** Step-by-step protocol: title + body. Used for warmup instructions panel. */
export interface InstructionStep {
  title: string;
  body: string;
}

/** Instructions keyed by pattern (partial match on exercise name). Same logic as images. */
const WARMUP_INSTRUCTIONS: { pattern: string; steps: InstructionStep[] }[] = [
  {
    pattern: 'Adductor',
    steps: [
      {
        title: 'Quadruped Setup',
        body:
          'Begin on all fours (hands under shoulders, knees under hips). Ensure your spine is neutral—flat like a table. Brace your core lightly.',
      },
      {
        title: 'Extension and Abduction',
        body:
          'Extend one leg directly out to the side. The foot of the extended leg should be flat on the floor, toes pointing forward (parallel to your spine). This aligns the adductor fibers for optimal lengthening.',
      },
      {
        title: 'The Posterior Rock',
        body:
          'Maintain a neutral spine and slowly push your hips backward toward the heel of the kneeling leg. Imagine pushing your tailbone straight back.',
      },
      {
        title: 'Dynamic Return',
        body:
          'Once you feel a strong stretch in the inner thigh (without pain), squeeze your glutes to drive the hips forward back to the starting position. Exhale as you rock back; inhale as you return.',
      },
    ],
  },
];

export function getWarmupInstructions(exerciseName: string): InstructionStep[] | undefined {
  const name = exerciseName.trim();
  const match = WARMUP_INSTRUCTIONS.find(({ pattern }) =>
    name.toLowerCase().includes(pattern.toLowerCase())
  );
  return match?.steps;
}

export const WARMUP_EXERCISES: { name: string; detail: string }[] = [
  { name: 'Cervical CARs - Left', detail: 'Slow, full-range neck circles' },
  { name: 'Cervical CARs - Right', detail: 'Slow, full-range neck circles' },
  { name: 'Glenohumeral CARs - Left Forward', detail: 'Slow, full-range shoulder rotation' },
  { name: 'Glenohumeral CARs - Left Reverse', detail: 'Slow, full-range shoulder rotation' },
  { name: 'Glenohumeral CARs - Right Forward', detail: 'Slow, full-range shoulder rotation' },
  { name: 'Glenohumeral CARs - Right Reverse', detail: 'Slow, full-range shoulder rotation' },
  { name: 'Scapular CARs - Forward', detail: 'Slow, full-range shoulder blade circles' },
  { name: 'Scapular CARs - Reverse', detail: 'Slow, full-range shoulder blade circles' },
  { name: 'Thoracic CARs - Left', detail: 'Slow, full-range thoracic circles' },
  { name: 'Thoracic CARs - Right', detail: 'Slow, full-range thoracic circles' },
  { name: 'Hip CARs - Left Forward', detail: 'Slow, full-range hip rotation' },
  { name: 'Hip CARs - Left Reverse', detail: 'Slow, full-range hip rotation' },
  { name: 'Hip CARs - Right Forward', detail: 'Slow, full-range hip rotation' },
  { name: 'Hip CARs - Right Reverse', detail: 'Slow, full-range hip rotation' },
  { name: 'Tibial CARs - Left Clockwise', detail: 'Slow, full-range tibial rotation' },
  { name: 'Tibial CARs - Left Counter', detail: 'Slow, full-range tibial rotation' },
  { name: 'Tibial CARs - Right Clockwise', detail: 'Slow, full-range tibial rotation' },
  { name: 'Tibial CARs - Right Counter', detail: 'Slow, full-range tibial rotation' },
  { name: 'Ankle CARs - Left Clockwise', detail: 'Slow, full-range ankle rotation' },
  { name: 'Ankle CARs - Left Counter', detail: 'Slow, full-range ankle rotation' },
  { name: 'Ankle CARs - Right Clockwise', detail: 'Slow, full-range ankle rotation' },
  { name: 'Ankle CARs - Right Counter', detail: 'Slow, full-range ankle rotation' },
  { name: 'Swimmers', detail: 'Alternate every 3' },
  { name: 'Press-Press Flings', detail: '' },
  { name: 'Adductor Rock', detail: 'Begin in Quadruplex — Left Side' },
  { name: 'Adductor Rock', detail: 'Begin in Quadruplex — Right Side' },
  { name: 'Segmental Cat-Cows', detail: 'Move vertebrae individually' },
  { name: "Child's Pose", detail: 'Rest and breathe' },
];

export const WARMUP_DURATION_PER_EXERCISE = 30;

/** Pause between warmup exercises: main timer stops, "Next" countdown lets user position. */
export const WARMUP_TRANSITION_SECONDS = 5;

export const DEFAULT_WARMUP_TOTAL_SECONDS = WARMUP_EXERCISES.length * WARMUP_DURATION_PER_EXERCISE;

/**
 * Returns the default warmup block for all interval timers.
 * 14 min (840s) = 28 exercises × 30s. IntervalTimerOverlay shows WarmUpWheel during this block.
 */
export function getDefaultWarmupBlock(): HIITTimelineBlock {
  return {
    type: 'warmup',
    duration: DEFAULT_WARMUP_TOTAL_SECONDS,
    name: 'Daily Warm Up',
    notes: 'Joint mobility & activation',
  };
}
