/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Step 4: The Mathematician (Progression Calculator)
 * Generates week-by-week numbers using the progression protocol.
 */

import type {
  ArchitectBlueprint,
  ExerciseSelection,
  ProgramSchedule,
  ProgressionProtocol,
} from '@/types/ai-program';

/**
 * Build the prompt for Step 4: The Mathematician
 */
export function buildMathematicianPrompt(
  architect: ArchitectBlueprint,
  exercises: ExerciseSelection[],
  durationWeeks: number
): string {
  const exercisesDescription = exercises
    .map((day) => {
      const exerciseList = day.exercises
        .map((e) => `  - ${e.exercise_name} (${e.pattern})`)
        .join('\n');
      return `Day ${day.day_number}: ${day.day_name}\n${exerciseList}`;
    })
    .join('\n\n');

  const protocolInstructions = getProtocolInstructions(architect.progression_protocol);

  return `Role: You are the Progression Mathematician.
Task: Generate week-by-week numbers for each exercise across ${durationWeeks} weeks.

=== PROGRESSION PROTOCOL: ${architect.progression_protocol.toUpperCase()} ===
${protocolInstructions}

Architect's Rules:
- Weeks 1-3: ${architect.progression_rules.weeks_1_3}
- Weeks 4-6: ${architect.progression_rules.weeks_4_6}

=== EXERCISES FROM COACH ===
${exercisesDescription}

=== YOUR TASK ===
For EACH exercise on EACH day, generate the specific prescription for ALL ${durationWeeks} weeks.

Output Requirements:
1. Each week must have ${exercises.length} workouts (one for each training day)
2. Each workout must include ALL exercises for that day
3. Apply the progression protocol to sets, reps, RPE, and rest
4. Include warmupBlocks for each workout (2-4 warmup exercises)
5. Include coachNotes for form cues

=== OUTPUT FORMAT ===
Return ONLY valid JSON. The "schedule" array must have exactly ${durationWeeks} week objects.

{
  "schedule": [
    {
      "weekNumber": 1,
      "workouts": [
        {
          "title": "Day 1: Upper Strength",
          "description": "Focus on horizontal pressing and pulling with emphasis on strength",
          "warmupBlocks": [
            { "order": 1, "exerciseName": "Arm Circles", "instructions": ["Forward circles x10", "Backward circles x10"] },
            { "order": 2, "exerciseName": "Band Pull-Aparts", "instructions": ["15 reps with light band", "Focus on squeezing shoulder blades"] }
          ],
          "blocks": [
            {
              "order": 1,
              "exerciseName": "Barbell Bench Press",
              "exerciseQuery": "bench press",
              "sets": 3,
              "reps": "8-10",
              "rpe": 7,
              "restSeconds": 120,
              "coachNotes": "Control the descent, pause at chest, drive up explosively"
            }
          ]
        }
      ]
    }
  ]
}

Generate all ${durationWeeks} weeks with proper progression applied.`;
}

/**
 * Get protocol-specific instructions
 */
function getProtocolInstructions(protocol: ProgressionProtocol): string {
  switch (protocol) {
    case 'linear_load':
      return `LINEAR LOAD PROTOCOL:
- Keep reps FIXED throughout the program (e.g., 5 reps stays 5 reps)
- Increase weight by 2.5-5% each week
- Week 1: Start at RPE 6-7
- Week 6: End at RPE 8-9 with heavier weights
- Sets may increase slightly (e.g., 3→4 sets) in weeks 3-4`;

    case 'double_progression':
      return `DOUBLE PROGRESSION PROTOCOL:
- Use a REP RANGE (e.g., "8-12" reps)
- Week 1: Start at BOTTOM of range (e.g., 8 reps)
- Progress: Add reps each week until top of range is hit
- When top of range is achieved (e.g., 12 reps), note "increase weight next session"
- Reset to bottom of range and repeat
- RPE should stay 7-9 throughout`;

    case 'density_leverage':
      return `DENSITY & LEVERAGE PROTOCOL:
- Weeks 1-3 (Volume Phase): Add SETS or REPS
- Weeks 4-6 (Density Phase): REDUCE REST time (e.g., 90s → 60s → 45s)
- For bodyweight exercises: Progress to harder variations
  - e.g., Knee Push-ups → Standard Push-ups → Decline Push-ups
- RPE should increase as rest decreases
- Note variation changes in coachNotes`;

    default:
      return 'Apply progressive overload appropriately.';
  }
}

/**
 * Validate Step 4 output.
 * Intentionally does not enforce schedule length vs expected weeks: partial schedules
 * are allowed and the UI offers "Generate Missing N Weeks" via extend-program.
 */
export function validateMathematicianOutput(
  data: unknown
): { valid: true; data: ProgramSchedule[] } | { valid: false; error: string } {
  if (typeof data !== 'object' || data === null) {
    return { valid: false, error: 'Mathematician output must be an object' };
  }

  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.schedule)) {
    return { valid: false, error: 'schedule must be an array' };
  }

  if (obj.schedule.length === 0) {
    return { valid: false, error: 'schedule must have at least one week' };
  }

  for (let i = 0; i < obj.schedule.length; i++) {
    const week = obj.schedule[i] as Record<string, unknown>;

    if (typeof week !== 'object' || week === null) {
      return { valid: false, error: `Week ${i + 1} must be an object` };
    }

    if (typeof week.weekNumber !== 'number' || week.weekNumber !== i + 1) {
      return { valid: false, error: `Week ${i + 1}: weekNumber must be ${i + 1}` };
    }

    if (!Array.isArray(week.workouts)) {
      return { valid: false, error: `Week ${i + 1}: workouts must be an array` };
    }

    if (week.workouts.length === 0) {
      return { valid: false, error: `Week ${i + 1}: must have at least one workout` };
    }

    for (let j = 0; j < week.workouts.length; j++) {
      const workout = week.workouts[j] as Record<string, unknown>;

      if (typeof workout !== 'object' || workout === null) {
        return { valid: false, error: `Week ${i + 1}, Workout ${j + 1}: must be an object` };
      }

      if (typeof workout.title !== 'string' || !workout.title.trim()) {
        return { valid: false, error: `Week ${i + 1}, Workout ${j + 1}: title is required` };
      }

      if (typeof workout.description !== 'string' || !workout.description.trim()) {
        return { valid: false, error: `Week ${i + 1}, Workout ${j + 1}: description is required` };
      }

      // Accept either blocks (legacy flat exercises) or exerciseBlocks (groups of exercises)
      const exerciseBlocks = workout.exerciseBlocks as
        | Array<{ exercises?: Array<Record<string, unknown>> }>
        | undefined;
      const blocks = workout.blocks as Array<Record<string, unknown>> | undefined;

      if (exerciseBlocks && Array.isArray(exerciseBlocks) && exerciseBlocks.length > 0) {
        // Validate exerciseBlocks: each block has exercises array
        for (let k = 0; k < exerciseBlocks.length; k++) {
          const block = exerciseBlocks[k];
          const exercises = block?.exercises;
          if (!Array.isArray(exercises)) {
            return {
              valid: false,
              error: `Week ${i + 1}, Workout ${j + 1}, Block ${k + 1}: exercises array is required`,
            };
          }
          for (let e = 0; e < exercises.length; e++) {
            const ex = exercises[e] as Record<string, unknown>;
            if (typeof ex !== 'object' || ex === null) {
              return {
                valid: false,
                error: `Week ${i + 1}, Workout ${j + 1}, Block ${k + 1}, Exercise ${e + 1}: must be an object`,
              };
            }
            if (typeof ex.exerciseName !== 'string' || !String(ex.exerciseName || '').trim()) {
              return {
                valid: false,
                error: `Week ${i + 1}, Workout ${j + 1}, Block ${k + 1}, Exercise ${e + 1}: exerciseName is required`,
              };
            }
            if (typeof ex.sets !== 'number' || ex.sets < 1) {
              return {
                valid: false,
                error: `Week ${i + 1}, Workout ${j + 1}, Block ${k + 1}, Exercise ${e + 1}: sets must be a positive number`,
              };
            }
            if (typeof ex.reps !== 'string' && typeof ex.reps !== 'number') {
              return {
                valid: false,
                error: `Week ${i + 1}, Workout ${j + 1}, Block ${k + 1}, Exercise ${e + 1}: reps is required`,
              };
            }
          }
        }
      } else if (blocks && Array.isArray(blocks) && blocks.length > 0) {
        // Validate legacy blocks (flat exercises)
        for (let k = 0; k < blocks.length; k++) {
          const block = blocks[k];

          if (typeof block !== 'object' || block === null) {
            return {
              valid: false,
              error: `Week ${i + 1}, Workout ${j + 1}, Block ${k + 1}: must be an object`,
            };
          }

          if (typeof block.exerciseName !== 'string' || !(block.exerciseName as string).trim()) {
            return {
              valid: false,
              error: `Week ${i + 1}, Workout ${j + 1}, Block ${k + 1}: exerciseName is required`,
            };
          }

          if (typeof block.sets !== 'number' || (block.sets as number) < 1) {
            return {
              valid: false,
              error: `Week ${i + 1}, Workout ${j + 1}, Block ${k + 1}: sets must be a positive number`,
            };
          }

          if (typeof block.reps !== 'string' && typeof block.reps !== 'number') {
            return {
              valid: false,
              error: `Week ${i + 1}, Workout ${j + 1}, Block ${k + 1}: reps is required`,
            };
          }
        }
      } else {
        return {
          valid: false,
          error: `Week ${i + 1}, Workout ${j + 1}: must have at least one exercise block (blocks or exerciseBlocks)`,
        };
      }
    }
  }

  return { valid: true, data: obj.schedule as ProgramSchedule[] };
}
