/**
 * AMRAP Protocol 2026 Workout Library (home-based: bodyweight + 40" superband).
 * Extracted from Physiological and Biomechanical Foundations document.
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
      name: 'The Linear Circuit',
      focus: 'Low-impact intro to high-intensity work.',
      exercises: [
        '10 Air Squats',
        '5 Incline Push-Ups (hands on table or chair)',
        '15 Marching Steps in place',
      ],
    },
    {
      name: 'Posterior and Core Integration',
      focus: 'Posterior chain and core stability.',
      exercises: [
        '10 Glute Bridges',
        '5 Wall Walkouts (partial range)',
        '10 Sit-Ups',
      ],
    },
    {
      name: 'The Functional Trio',
      focus: 'Unilateral patterns and mobility.',
      exercises: [
        '10 Alternating Reverse Lunges',
        '5 Plank to Down Dog transitions',
        '15 Jumping Jacks',
      ],
    },
    {
      name: 'The Tension Trio',
      focus: 'Squat, row, and press with band.',
      exercises: [
        '10 Banded Squats',
        '10 Banded Rows',
        '10 Banded Chest Presses',
      ],
    },
    {
      name: 'The Posture Protocol',
      focus: 'Hamstrings, upper back, and biceps.',
      exercises: [
        '10 Banded Good Mornings',
        '10 Banded Pull-Aparts',
        '10 Banded Bicep Curls',
      ],
    },
    {
      name: 'The Metabolic Banded Circuit',
      focus: 'Full-body thruster and lateral activation.',
      exercises: [
        '8 Banded Thrusters',
        '10 Banded Lateral Walks (5 each way)',
        '15 Banded Glute Bridges',
      ],
    },
  ],
  intermediate: [
    {
      name: 'The Metabolic Burner',
      focus: 'Peripheral heart action, high caloric burn.',
      exercises: [
        '10 Burpees',
        '15 Air Squats',
        '20 Mountain Climbers',
      ],
    },
    {
      name: 'The Strength-Endurance Test',
      focus: 'Muscular endurance at threshold.',
      exercises: [
        '12 Push-Ups (full range)',
        '12 Alternating Lunges',
        '12 V-Ups',
      ],
    },
    {
      name: 'The Half-Cindy Variant',
      focus: 'Scaled Cindy, continuous movement.',
      exercises: [
        '5 Pull-Ups or Walkouts to Push-Up',
        '10 Air Squats',
        '15 Sit-Ups',
      ],
    },
    {
      name: 'The Posterior Burner',
      focus: 'Posterior chain and rotator cuff.',
      exercises: [
        '12 Banded Deadlifts',
        '12 Banded Bent-Over Rows',
        '12 Banded Face Pulls',
      ],
    },
    {
      name: 'The Vertical Power Circuit',
      focus: 'Overhead stability and resisted plyometrics.',
      exercises: [
        '10 Banded Overhead Presses',
        '10 Banded Crank the Mower (per side)',
        '15 Banded Squat Jumps',
      ],
    },
    {
      name: 'The Unilateral Challenge',
      focus: 'Single-leg and single-arm work.',
      exercises: [
        '10 Banded Split Squats (per leg)',
        '10 Banded Single-Arm Chest Press (per side)',
        '20 Banded Russian Twists',
      ],
    },
  ],
  advanced: [
    {
      name: 'The Full Cindy Benchmark',
      focus: 'Classic work-capacity test.',
      exercises: [
        '5 Pull-Ups or HSPU (scaled)',
        '10 Push-Ups',
        '15 Air Squats',
      ],
    },
    {
      name: 'The Rising Ladder Challenge',
      focus: 'Ascending density, psychological test.',
      exercises: [
        '1-5 Burpees',
        '1-5 Pistol Squats (alt legs)',
        '1-5 Handstand Walkouts or V-Ups',
      ],
    },
    {
      name: 'The Minimal and Deadly',
      focus: 'Aerobic power and plyometric jump.',
      exercises: [
        '200m Run',
        '10 Burpee-to-Target',
        '20 Walking Lunges',
        '30 Sit-Ups',
      ],
    },
    {
      name: 'The Resisted Cindy',
      focus: 'Band overload on classic movements.',
      exercises: [
        '5 Band-Resisted Pull-Ups',
        '10 Band-Resisted Push-Ups',
        '15 Banded Front Squats',
      ],
    },
    {
      name: 'The Metabolic Super Complex',
      focus: 'Explosive hip drive and overspeed eccentrics.',
      exercises: [
        '8 Banded Clean and Presses',
        '12 Banded Kettlebell Swings (mimicked)',
        '15 Banded Burpees',
        '20 Banded Plank Jacks',
      ],
    },
    {
      name: 'The Grit Ladder',
      focus: 'Recovery under breathlessness.',
      exercises: [
        '10 Banded Thrusters',
        '10 Banded Rows',
        '10 Banded Push-Ups',
        '200m Sprint',
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
