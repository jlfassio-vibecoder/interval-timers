/**
 * Single source of truth for the Daily Warm-Up design used by all interval timers.
 * Update exercises or duration here; Tabata, Japanese Walking, WarmUpInterval, and
 * future timers will receive the change automatically.
 */

import type { HIITTimelineBlock } from '@/types/ai-workout';

export const WARMUP_EXERCISES: { name: string; detail: string }[] = [
  { name: 'Cervical CARs', detail: 'Slow, full-range neck circles' },
  { name: 'Glenohumeral CARs', detail: 'Left Side Shoulder Rotation' },
  { name: 'Glenohumeral CARs', detail: 'Right Side Shoulder Rotation' },
  { name: 'Scapular CARs', detail: 'Slow, full-range shoulder blade circles' },
  { name: 'Thoracic CARs', detail: 'Slow, full-range thoracic circles' },
  { name: 'Hip CARs', detail: 'Left Side Hip Rotation' },
  { name: 'Hip CARs', detail: 'Right Side Hip Rotation' },
  { name: 'Tibial CARs', detail: 'Left Side' },
  { name: 'Tibial CARs', detail: 'Right Side' },
  { name: 'Ankle CARs', detail: 'Left Side' },
  { name: 'Ankle CARs', detail: 'Right Side' },
  { name: 'Swimmers', detail: 'Alternate every 3' },
  { name: 'Press-Press Flings', detail: '' },
  { name: 'Adductor Rock', detail: 'Begin in Quadruplex — Left Side' },
  { name: 'Adductor Rock', detail: 'Begin in Quadruplex — Right Side' },
  { name: 'Segmental Cat-Cows', detail: 'Move vertebrae individually' },
];

export const WARMUP_DURATION_PER_EXERCISE = 30;

export const DEFAULT_WARMUP_TOTAL_SECONDS = WARMUP_EXERCISES.length * WARMUP_DURATION_PER_EXERCISE;

/**
 * Returns the default warmup block for all interval timers.
 * 8 min (480s) = 16 exercises × 30s. IntervalTimerOverlay shows WarmUpWheel during this block.
 */
export function getDefaultWarmupBlock(): HIITTimelineBlock {
  return {
    type: 'warmup',
    duration: DEFAULT_WARMUP_TOTAL_SECONDS,
    name: 'Daily Warm Up',
    notes: 'Joint mobility & activation',
  };
}
