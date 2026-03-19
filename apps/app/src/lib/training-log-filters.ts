/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Training Log filter constants and utilities.
 */

export const WORKOUT_TYPES = [
  'All',
  'Strength',
  'Hypertrophy',
  'Power',
  'Endurance',
  'Speed',
  'Agility',
  'Mobility',
  'Stability',
  'Balance',
  'Core',
  'Flexibility',
  'Conditioning',
  'Stamina',
  'Fat Loss',
  'Muscle Building',
  'Explosiveness',
  'Athleticism',
  'Recovery',
  'Resilience',
  'Posture',
  'Coordination',
  'Range of Motion',
  'Injury Prevention',
  'Metabolic Health',
  'Cardiovascular Fitness',
] as const;

export const WORKOUT_FORMATS = [
  'All',
  'HIIT',
  'Straight Sets',
  'Circuit',
  'AMRAP',
  'EMOM',
  'Tabata',
  'Ladder',
  'Pyramid',
  'Superset',
  'Drop Set',
  'Rest-Pause',
  'Cluster Set',
  'Giant Set',
  'Time Under Tension',
  'Isometric',
  'Plyometric',
  'Compound',
  'Isolation',
  'Interval',
  'Steady State',
  'Fartlek',
  'Tempo',
  'Progressive Overload',
  'Density Training',
  'Volume Training',
  'Max Effort',
  'Dynamic Effort',
  'Conjugate',
  'Undulating',
  'Linear Progression',
  'Wave Loading',
  'Rest Day',
  'Active Recovery',
  'Deload',
] as const;

export const DURATION_FILTERS = [
  'All',
  '15 min',
  '30 min',
  '45 min',
  '60 min',
  '90 min',
  '120+ min',
] as const;

export type DurationFilterValue = (typeof DURATION_FILTERS)[number];

export interface TrainingLogFilters {
  workoutType?: string;
  workoutFormat?: string;
  durationRange?: DurationFilterValue;
  excludeActiveRest?: boolean;
}

export function getDurationRange(filter: string): { min: number; max: number } {
  switch (filter) {
    case '15 min':
      return { min: 0, max: 15 };
    case '30 min':
      return { min: 16, max: 30 };
    case '45 min':
      return { min: 31, max: 45 };
    case '60 min':
      return { min: 46, max: 60 };
    case '90 min':
      return { min: 61, max: 90 };
    case '120+ min':
      return { min: 91, max: Infinity };
    default:
      return { min: 0, max: Infinity };
  }
}
