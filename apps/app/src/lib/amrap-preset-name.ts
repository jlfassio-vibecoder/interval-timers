/**
 * Map AMRAP workout_list (exercises) to preset display name for SimpleActivityDrawer.
 * Mirrors apps/amrap AMRAP_WORKOUT_LIBRARY name + exercises so we can show "The Metabolic Burner" etc.
 */

const PRESETS: { name: string; exercises: string[] }[] = [
  {
    name: 'The Linear Circuit',
    exercises: [
      '10 Air Squats',
      '5 Incline Push-Ups (hands on table or chair)',
      '15 Marching Steps in place',
    ],
  },
  {
    name: 'Posterior and Core Integration',
    exercises: ['10 Glute Bridges', '5 Wall Walkouts (partial range)', '10 Sit-Ups'],
  },
  {
    name: 'The Functional Trio',
    exercises: [
      '10 Alternating Reverse Lunges',
      '5 Plank to Down Dog transitions',
      '15 Jumping Jacks',
    ],
  },
  {
    name: 'The Tension Trio',
    exercises: ['10 Banded Squats', '10 Banded Rows', '10 Banded Chest Presses'],
  },
  {
    name: 'The Posture Protocol',
    exercises: ['10 Banded Good Mornings', '10 Banded Pull-Aparts', '10 Banded Bicep Curls'],
  },
  {
    name: 'The Metabolic Banded Circuit',
    exercises: [
      '8 Banded Thrusters',
      '10 Banded Lateral Walks (5 each way)',
      '15 Banded Glute Bridges',
    ],
  },
  {
    name: 'The Metabolic Burner',
    exercises: ['10 Burpees', '15 Air Squats', '20 Mountain Climbers'],
  },
  {
    name: 'The Strength-Endurance Test',
    exercises: ['12 Push-Ups (full range)', '12 Alternating Lunges', '12 V-Ups'],
  },
  {
    name: 'The Half-Cindy Variant',
    exercises: ['5 Pull-Ups or Walkouts to Push-Up', '10 Air Squats', '15 Sit-Ups'],
  },
  {
    name: 'The Posterior Burner',
    exercises: ['12 Banded Deadlifts', '12 Banded Bent-Over Rows', '12 Banded Face Pulls'],
  },
  {
    name: 'The Vertical Power Circuit',
    exercises: [
      '10 Banded Overhead Presses',
      '10 Banded Crank the Mower (per side)',
      '15 Banded Squat Jumps',
    ],
  },
  {
    name: 'The Unilateral Challenge',
    exercises: [
      '10 Banded Split Squats (per leg)',
      '10 Banded Single-Arm Chest Press (per side)',
      '20 Banded Russian Twists',
    ],
  },
  {
    name: 'The Full Cindy Benchmark',
    exercises: ['5 Pull-Ups or HSPU (scaled)', '10 Push-Ups', '15 Air Squats'],
  },
  {
    name: 'The Rising Ladder Challenge',
    exercises: ['1-5 Burpees', '1-5 Pistol Squats (alt legs)', '1-5 Handstand Walkouts or V-Ups'],
  },
  {
    name: 'The Minimal and Deadly',
    exercises: ['200m Run', '10 Burpee-to-Target', '20 Walking Lunges', '30 Sit-Ups'],
  },
  {
    name: 'The Resisted Cindy',
    exercises: ['5 Band-Resisted Pull-Ups', '10 Band-Resisted Push-Ups', '15 Banded Front Squats'],
  },
  {
    name: 'The Metabolic Super Complex',
    exercises: [
      '8 Banded Clean and Presses',
      '12 Banded Kettlebell Swings (mimicked)',
      '15 Banded Burpees',
      '20 Banded Plank Jacks',
    ],
  },
  {
    name: 'The Grit Ladder',
    exercises: ['10 Banded Thrusters', '10 Banded Rows', '10 Banded Push-Ups', '200m Sprint'],
  },
  {
    name: 'Cindy-style',
    exercises: ['5 Pull-Ups or Walkouts to Push-Up', '10 Push-Ups', '15 Air Squats'],
  },
  { name: 'Sprint', exercises: ['10 Burpees', '15 Air Squats', '10 Push-Ups'] },
  { name: 'Minimal', exercises: ['10 Burpees', '10 Air Squats'] },
];

function normalize(list: string[]): string[] {
  return list.map((s) => s.trim()).filter(Boolean);
}

function sameExercises(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

/**
 * Returns the preset display name when workoutList exactly matches a library preset; otherwise null.
 */
export function getAmrapPresetName(workoutList: string[] | undefined | null): string | null {
  if (!workoutList?.length) return null;
  const normalized = normalize(workoutList);
  for (const preset of PRESETS) {
    const presetNormalized = normalize(preset.exercises);
    if (sameExercises(normalized, presetNormalized)) return preset.name;
  }
  return null;
}

/**
 * Human-friendly title for AMRAP sessions in calendar, history, and exports.
 *
 * DB `workout_name` is populated from the first exercise in `workout_list` (see Supabase
 * `persist_amrap_session_results`), so it must not win over a library preset name. When there
 * is no preset match and `workout_name` equals the first exercise, treat it as unset and use
 * the product default.
 */
export function getAmrapSessionDisplayTitle(
  workoutName: string | null | undefined,
  workoutList: string[] | undefined | null
): string {
  const list = Array.isArray(workoutList)
    ? workoutList.map((s) => String(s).trim()).filter(Boolean)
    : [];
  const preset = list.length ? getAmrapPresetName(list) : null;
  if (preset) return preset;

  const first = list[0] ?? '';
  const wn = workoutName?.trim() ?? '';

  if (wn && wn !== first) return wn;

  return 'AMRAP With Friends';
}
