/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Utilities for Training Log bubble sizing and display.
 */

/**
 * Tailwind class for bubble background based on duration (minutes).
 * HUD dark theme: gray/slate for empty/low, green/orange/red for intensity.
 */
export function getBubbleColor(minutes: number): string {
  if (minutes === 0) return 'bg-slate-500/50';
  if (minutes <= 30) return 'bg-gray-600';
  if (minutes <= 60) return 'bg-green-600';
  if (minutes <= 90) return 'bg-orange-500';
  if (minutes <= 120) return 'bg-red-500';
  return 'bg-red-700';
}

/** Tailwind width/height class for bubble size. */
export function getCircleSize(minutes: number): string {
  if (minutes === 0) return 'w-6 h-6';
  if (minutes <= 30) return 'w-7 h-7';
  if (minutes <= 60) return 'w-8 h-8';
  if (minutes <= 90) return 'w-10 h-10';
  if (minutes <= 120) return 'w-12 h-12';
  return 'w-14 h-14';
}

/** Tailwind text size class for bubble label. */
export function getTextSize(minutes: number): string {
  if (minutes <= 30) return 'text-xs';
  if (minutes <= 60) return 'text-xs';
  if (minutes <= 90) return 'text-sm';
  if (minutes <= 120) return 'text-sm';
  return 'text-base';
}

/**
 * Split total minutes across multiple sessions for display.
 * Uses deterministic distribution (largest-first) for stability.
 */
export function splitWorkoutTime(totalMinutes: number, count: number): number[] {
  if (count <= 1) return [totalMinutes];

  const workouts: number[] = [];
  let remaining = totalMinutes;

  for (let i = 0; i < count - 1; i++) {
    const fraction = 0.3 + (i / (count - 1)) * 0.4;
    const split = Math.floor(remaining * fraction);
    workouts.push(Math.max(1, split));
    remaining -= workouts[workouts.length - 1];
  }
  workouts.push(Math.max(0, remaining));

  return workouts.sort((a, b) => b - a);
}
