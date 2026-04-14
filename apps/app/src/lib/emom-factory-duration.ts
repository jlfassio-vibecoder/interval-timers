/**
 * EMOM Factory mode: session clock = totalRounds minutes (one round per minute).
 */

import type { EmomFactoryOptions } from '@/types/ai-workout';

export const EMOM_MIN_TOTAL_ROUNDS = 8;
export const EMOM_MAX_TOTAL_ROUNDS = 30;

export const EMOM_MIN_STATIONS_PER_CYCLE = 2;
export const EMOM_MAX_STATIONS_PER_CYCLE = 8;

export const EMOM_MIN_MOVEMENTS_PER_MINUTE = 2;
export const EMOM_MAX_MOVEMENTS_PER_MINUTE = 4;

/** Session duration in minutes equals total EMOM rounds. */
export function emomSessionMinutes(opts: EmomFactoryOptions): number {
  return opts.totalRounds;
}

/** Clamp total rounds to [min, max]. */
export function clampEmomTotalRounds(totalRounds: number): number {
  const n = Math.round(totalRounds);
  return Math.min(EMOM_MAX_TOTAL_ROUNDS, Math.max(EMOM_MIN_TOTAL_ROUNDS, n));
}

/**
 * For alternating EMOM, total clock minutes must be a multiple of stationsPerCycle.
 * Snaps into range, preferring upward then downward.
 */
export function snapEmomTotalRoundsToCycle(totalRounds: number, stationsPerCycle: number): number {
  const s = Math.min(
    EMOM_MAX_STATIONS_PER_CYCLE,
    Math.max(EMOM_MIN_STATIONS_PER_CYCLE, Math.round(stationsPerCycle))
  );
  let t = clampEmomTotalRounds(totalRounds);
  if (s <= 1) return t;
  const remainder = t % s;
  if (remainder === 0) return t;
  const up = t + (s - remainder);
  if (up <= EMOM_MAX_TOTAL_ROUNDS) return up;
  const down = t - remainder;
  return Math.max(EMOM_MIN_TOTAL_ROUNDS, down);
}

/** Minutes per station in one full alternating cycle (totalRounds divisible by stationsPerCycle). */
export function emomAlternatingRoundsPerStation(
  totalRounds: number,
  stationsPerCycle: number
): number {
  const s = Math.min(
    EMOM_MAX_STATIONS_PER_CYCLE,
    Math.max(EMOM_MIN_STATIONS_PER_CYCLE, Math.round(stationsPerCycle))
  );
  if (s <= 0) return totalRounds;
  return Math.round(totalRounds / s);
}
