/**
 * Shared data and types for interval timer setup flows (Tabata and future protocols).
 */

export const WORKOUT_DATABASE = {
  single: [
    { name: 'Push Ups', list: ['Push Ups'] },
    { name: 'Bodyweight Squats', list: ['Bodyweight Squats'] },
    { name: 'Lunge Jumps', list: ['Lunge Jumps'] },
    { name: 'Pike Push Ups', list: ['Pike Push Ups'] },
    { name: 'Sit Ups', list: ['Sit Ups'] },
    { name: 'Mountain Climbers', list: ['Mountain Climbers'] },
  ],
  alternating: [
    { name: 'Climbers & Bicycles', list: ['Mountain Climbers', 'Bicycles'] },
    { name: 'Squat & Lunge Jumps', list: ['Squat Jumps', 'Lunge Jumps'] },
    { name: 'Push & Pike', list: ['Push-ups', 'Pike Push-ups'] },
    { name: 'Skaters & Knees', list: ['Speed Skaters', 'High Knees'] },
  ],
  circuit4: [
    {
      name: 'Core Blaster',
      list: ['Mountain Climbers', 'Bicycles', 'Plank Jacks', 'Supine Leg-Crossovers'],
    },
    {
      name: 'Leg Burner',
      list: ['Squat Jumps', 'Lunge Jumps', 'Pop Squat', 'Broad Jump w/ Backpedal'],
    },
    {
      name: 'Push Variation',
      list: ['Push-ups', 'Pike Push-ups', 'Wide Push-ups', 'Dive Bomber Push-ups'],
    },
    {
      name: 'Agility Circuit',
      list: ['Speed Skaters', 'High Knees', 'Lateral Shuffles', 'Broad Jump w/ Backpedal'],
    },
  ],
  circuit8: [
    {
      name: 'Lower Body Gauntlet',
      list: [
        'Squat Jumps',
        'Speed Skaters',
        'Lunge Jumps',
        'High Knees',
        'Pop Squat',
        'Lateral Shuffles',
        'Broad Jump w/ Backpedal',
        'Lateral Shuffles',
      ],
    },
    {
      name: 'Upper Body Siege',
      list: [
        'Push-up Jacks',
        'Plank Shoulder Taps',
        'Mountain Climbers',
        'Pike Push-ups',
        'Hand-Release Push-ups',
        'Up-Down Planks (Commandos)',
        'Bear Crawl',
        'Speed Push-ups',
      ],
    },
    {
      name: 'Core Incinerator',
      list: [
        'Bicycle Crunches',
        'Plank Jacks',
        'Cross-Body Climbers',
        'Russian Twists',
        'V-Ups',
        'Spiderman Planks',
        'Flutter Kicks',
        'Plank Jacks',
      ],
    },
    {
      name: 'Total System Meltdown',
      list: [
        'Burpees',
        'Star Jumps',
        'Groiners (Frog Jumps)',
        'High Knees w/ Punches',
        'Squat Thrusts',
        'Seal Jacks',
        'Sit-Outs (Kick Throughs)',
        'Burpees',
      ],
    },
  ],
} as const;

export type TabataWorkoutCategory = keyof typeof WORKOUT_DATABASE;

export type TabataWorkoutOption = (typeof WORKOUT_DATABASE)[TabataWorkoutCategory][number];

/** Result passed to onComplete when user finishes Tabata setup (protocol + optional workout). */
export interface TabataSetupResult {
  cycles: number;
  workoutList: string[];
  /** When true, prepend Daily Warm-Up block to the timer. Default false (skip). */
  includeWarmup?: boolean;
}

/** Default number of Tabata cycles (8 rounds of 20/10). */
export const TABATA_DEFAULT_CYCLES = 8;

/** Shared labels for Tabata protocol step. */
export const TABATA_PROTOCOL_LABELS = {
  standardTabata: 'Standard Tabata',
  standardTabataDesc: 'Generic Timer • 8 Cycles of 20/10',
  singleExercise: 'Single Exercise',
  singleExerciseDesc: 'Same move for 8 rounds',
  alternating: 'Alternating',
  alternatingDesc: 'Swap A/B every round',
  circuit4: '4-Ex Circuit',
  circuit4Desc: '4 moves, repeat twice',
  circuit8: '8-Ex Circuit',
  circuit8Desc: '8 unique moves, 1 lap',
} as const;
