/**
 * AMRAP Protocol 2026 Workout Library (from Meta-Analysis for High-Intensity Functional Training).
 * Used by the setup modal for structured workout selection.
 */

export type AmrapLevel = 'beginner' | 'intermediate' | 'advanced';

export interface AmrapWorkoutOption {
  name: string;
  exercises: string[];
  /** Optional one-line focus for Workout Explorer cards */
  focus?: string;
}

export const AMRAP_WORKOUT_LIBRARY: Record<AmrapLevel, AmrapWorkoutOption[]> = {
  beginner: [
    {
      name: 'Bodyweight Foundation',
      focus: 'Vertical Push/Pull and Squat mechanics.',
      exercises: [
        '12 Air Squats',
        '8 Ring Rows or Incline Push-ups',
        '15 Sit-ups',
      ],
    },
    {
      name: 'Functional Loading',
      focus: 'Introduction to external resistance (30% 1RM).',
      exercises: [
        '10 Kettlebell Swings',
        '8 Goblet Squats',
        '10 Box Step-ups',
      ],
    },
  ],
  intermediate: [
    {
      name: 'The Classic Hybrid',
      focus: 'Standard hybrid blend.',
      exercises: [
        '10 Dumbbell Thrusters',
        '12 Burpees',
        '6 Box Jumps',
        '12 Alternating Renegade Rows',
      ],
    },
    {
      name: 'Antagonistic Upper/Lower',
      focus: 'Opposing muscle group pairing.',
      exercises: [
        '12 Dumbbell Goblet Lunges',
        '8 Pull-ups or Lat Pulldowns',
        '15 Kettlebell American Swings',
        '12 Hand-Release Push-ups',
      ],
    },
    {
      name: 'Metabolic Displacement',
      focus: 'High heart rate variance.',
      exercises: [
        '15 Wall Balls',
        '10 Single-Arm KB Snatches (5 per side)',
        '15 V-Ups',
        '100m Shuttle Run or 15 Calorie Row',
      ],
    },
    {
      name: 'Power Endurance',
      focus: 'Maintaining strength under fatigue.',
      exercises: [
        '8 Dumbbell Deadlifts',
        '8 Dumbbell Floor Press',
        '6 Broad Jumps',
        '12 Mountain Climbers',
      ],
    },
  ],
  advanced: [
    {
      name: 'The 2026 Benchmark',
      focus: 'High-skill standard test.',
      exercises: [
        '10 Barbell Clusters (40% 1RM)',
        '12 Toes-to-Bar',
        '5-8 Depth Jumps',
        '20 Double Unders',
      ],
    },
    {
      name: 'Power-Recovery Loop',
      focus: 'Continuous flow under heavy load.',
      exercises: [
        '12 Dual Dumbbell Clean & Press',
        '15 Box Jump Overs',
        '12 Chest-to-Bar Pull-ups',
        '20 Weighted Walking Lunges',
      ],
    },
    {
      name: 'Systemic Fatigue Management',
      focus: 'Machine cardio vs external load.',
      exercises: [
        '15 Calories Assault Bike or Echo Bike',
        '10 Sandbag or Medball Cleans',
        '12 Burpee Box Jumps',
        '15 Hollow Rocks',
      ],
    },
    {
      name: 'The Antagonistic Finale',
      focus: 'Strict gymnastics and heavy legs.',
      exercises: [
        '12 Front Squats (40% 1RM)',
        '10 Strict Handstand Push-ups or Pike Push-ups',
        '12 Alternating Dumbbell Snatches',
        '10 Strict Toes-to-Bar or Knee Raises',
      ],
    },
  ],
};

export const AMRAP_LEVEL_DURATION: Record<AmrapLevel, number> = {
  beginner: 5,
  intermediate: 15,
  advanced: 20,
};

export const AMRAP_PROTOCOL_LABELS = {
  generalAmrap: 'General AMRAP',
  generalAmrapDesc: 'Pick your time cap (5 / 15 / 20 min)',
  beginner: 'Beginner (5 Mins)',
  beginnerDesc: 'The Redline Drills • Technical proficiency',
  intermediate: 'Intermediate (15 Mins)',
  intermediateDesc: 'The Golden Ratio • Sustain threshold',
  advanced: 'Advanced (20 Mins)',
  advancedDesc: 'Max Work Capacity • Negative split',
} as const;

/** Explorer-only metadata: titles, goals, radar chart data, and tier colors */
export const AMRAP_EXPLORER_TIER_META: Record<
  AmrapLevel,
  {
    title: string;
    subtitle: string;
    goal: string;
    chartData: [number, number, number, number]; // Intensity, Skill, Pacing Focus, Volume
    colorHex: string;
  }
> = {
  beginner: {
    title: 'Beginner Protocols',
    subtitle: '"The Redline Drills"',
    goal:
      'Technical proficiency and learning "Steady Start" pacing. In these short windows, the primary challenge is resisting the urge to "redline" in the first 60 seconds.',
    chartData: [45, 20, 85, 25],
    colorHex: '#16a34a',
  },
  intermediate: {
    title: 'Intermediate Protocols',
    subtitle: '"The Golden Ratio"',
    goal: 'Sustaining threshold intensity (>85% HR Max) using the 2026 Hybrid Mix.',
    chartData: [85, 60, 65, 75],
    colorHex: '#d97706',
  },
  advanced: {
    title: 'Advanced Protocols',
    subtitle: '"Max Work Capacity"',
    goal:
      'Negative split execution. Aim to make the final 5 minutes the highest round-density of the workout.',
    chartData: [95, 90, 100, 100],
    colorHex: '#dc2626',
  },
};
