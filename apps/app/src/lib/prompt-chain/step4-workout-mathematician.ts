/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Step 4: The Workout Mathematician
 * Generates a single set of workouts (1–N sessions) with sets, reps, RPE, rest.
 * No week-by-week schedule — one prescription per session.
 */

import type { WorkoutArchitectBlueprint, BlockOptions, HiitOptions } from '@/types/ai-workout';
import type { ExerciseSelection, ProgressionProtocol } from '@/types/ai-program';
import type { WorkoutInSet } from '@/types/ai-workout';

const defaultBlockOptions: BlockOptions = {
  includeWarmup: true,
  mainBlockCount: 1,
  includeFinisher: false,
  includeCooldown: false,
};

/**
 * Build the prompt for Step 4: Workout Mathematician
 * When hiitMode and hiitOptions are set, requests Timer Schema (workSeconds, restSeconds, rounds) instead of sets/reps.
 */
export function buildWorkoutMathematicianPrompt(
  architect: WorkoutArchitectBlueprint,
  exercises: ExerciseSelection[],
  blockOptions: BlockOptions = defaultBlockOptions,
  hiitMode?: boolean,
  hiitOptions?: HiitOptions
): string {
  const exercisesDescription = exercises
    .map((day) => {
      const exerciseList = day.exercises
        .map((e) => `  - ${e.exercise_name} (${e.pattern})`)
        .join('\n');
      return `Session ${day.day_number}: ${day.day_name}\n${exerciseList}`;
    })
    .join('\n\n');

  const sessionCount = architect.sessions.length;

  const effectiveBlockOptions: BlockOptions =
    hiitMode && hiitOptions
      ? (() => {
          const circuitCount = [
            hiitOptions.circuitStructure.circuit1,
            hiitOptions.circuitStructure.circuit2,
            hiitOptions.circuitStructure.circuit3,
          ].filter(Boolean).length;
          const mainBlockCount = circuitCount >= 1 ? circuitCount : 1;
          return {
            includeWarmup: hiitOptions.circuitStructure.includeWarmup,
            mainBlockCount: mainBlockCount as 1 | 2 | 3, // Clamped above; HIIT has at most 3 circuits. BlockOptions accepts 1|2|3|4|5.
            includeFinisher: false,
            includeCooldown: hiitOptions.circuitStructure.includeCooldown,
          };
        })()
      : blockOptions;

  const { includeWarmup, mainBlockCount, includeFinisher, includeCooldown } = effectiveBlockOptions;

  const protocolInstructions = getProtocolInstructions(architect.progression_protocol);

  const warmupTask = includeWarmup
    ? '3. warmupBlocks: 2–4 warmup exercises with instructions (order, exerciseName, instructions array)'
    : '3. warmupBlocks: omit or set to empty array []';
  const mainTask = hiitMode
    ? `4. exerciseBlocks: exactly ${mainBlockCount} block(s); each block has order, name, and exercises with order, exerciseName, exerciseQuery, workSeconds, restSeconds, rounds, coachNotes (TIMER SCHEMA — no sets/reps; use work/rest time and rounds)`
    : `4. exerciseBlocks: exactly ${mainBlockCount} block(s); each block has order, name, and exercises with order, exerciseName, exerciseQuery (searchable), sets, reps, rpe, restSeconds, coachNotes`;
  const finisherTask = includeFinisher
    ? '5. finisherBlocks: 1–3 finisher exercises (same shape as warmupBlocks: order, exerciseName, instructions)'
    : '';
  const cooldownTask = includeCooldown
    ? '6. cooldownBlocks: 2–4 cool-down exercises (same shape as warmupBlocks: order, exerciseName, instructions)'
    : '';
  const taskLines = [warmupTask, mainTask].concat(
    finisherTask ? [finisherTask] : [],
    cooldownTask ? [cooldownTask] : []
  );

  const warmupExample = includeWarmup
    ? `"warmupBlocks": [
        { "order": 1, "exerciseName": "Arm Circles", "instructions": ["10 forward", "10 backward"] },
        { "order": 2, "exerciseName": "Band Pull-Aparts", "instructions": ["15 reps", "Squeeze shoulder blades"] }
      ],`
    : '"warmupBlocks": [],';

  const mainBlocksExample = hiitMode
    ? Array.from({ length: mainBlockCount }, (_, i) => {
        const name =
          mainBlockCount === 1
            ? 'Main'
            : i === 0
              ? 'Circuit 1 (Driver)'
              : i === 1
                ? 'Circuit 2 (Sustainer)'
                : 'Circuit 3 (Burnout)';
        return `        {
          "order": ${i + 1},
          "name": "${name}",
          "exercises": [
            {
              "order": 1,
              "exerciseName": "Burpees",
              "exerciseQuery": "burpee",
              "workSeconds": 40,
              "restSeconds": 20,
              "rounds": 4,
              "coachNotes": "Full effort each interval"
            }
          ]
        }`;
      }).join(',\n')
    : Array.from({ length: mainBlockCount }, (_, i) => {
        const name = mainBlockCount === 1 ? 'Main' : `Block ${i + 1}`;
        return `        {
          "order": ${i + 1},
          "name": "${name}",
          "exercises": [
            {
              "order": 1,
              "exerciseName": "Barbell Bench Press",
              "exerciseQuery": "bench press",
              "sets": 3,
              "reps": "8-10",
              "rpe": 7,
              "restSeconds": 120,
              "coachNotes": "Control descent, drive up"
            }
          ]
        }`;
      }).join(',\n');

  const finisherExample = includeFinisher
    ? `,
      "finisherBlocks": [
        { "order": 1, "exerciseName": "Plank", "instructions": ["30-45 sec"] }
      ]`
    : '';
  const cooldownExample = includeCooldown
    ? `,
      "cooldownBlocks": [
        { "order": 1, "exerciseName": "Static Stretch Chest", "instructions": ["30 sec each side"] },
        { "order": 2, "exerciseName": "Cat-Cow", "instructions": ["8 reps"] }
      ]`
    : '';

  const hiitSection =
    hiitMode && hiitOptions
      ? `
=== HIIT / TIMER SCHEMA ===
Protocol: ${hiitOptions.protocolFormat}${hiitOptions.workRestRatio ? `, Work:Rest ${hiitOptions.workRestRatio}` : ''}
Prescribe each main-block exercise with workSeconds, restSeconds, and rounds (e.g. 40s work, 20s rest, 4 rounds). Do NOT use sets and reps for main work.
`
      : '';

  const taskInstruction = hiitMode
    ? `Use the Coach's exercise list. Prescribe workSeconds, restSeconds, and rounds per exercise to fit the session duration and protocol. Distribute exercises across exactly ${mainBlockCount} circuit block(s).`
    : `Use the Coach's exercise list for that session. Prescribe sets, reps, RPE, and rest appropriate to the progression protocol and session duration. Distribute exercises across exactly ${mainBlockCount} main block(s).`;

  return `Role: You are the Workout Mathematician.
Task: Generate ONE set of ${sessionCount} workouts (no weeks). Each workout is a complete session. Include blocks as specified below.

=== PROGRESSION PROTOCOL: ${architect.progression_protocol.toUpperCase()} ===
${protocolInstructions}

Architect's Rules:
- Accumulation: ${architect.progression_rules.weeks_1_3}
- Intensification: ${architect.progression_rules.weeks_4_6}
${hiitSection}

=== SESSIONS FROM ARCHITECT ===
${architect.sessions.map((s) => `Session ${s.session_number}: ${s.session_name} — ${s.focus} (${s.duration_minutes} min)`).join('\n')}

=== EXERCISES FROM COACH ===
${exercisesDescription}

=== YOUR TASK ===
For each of the ${sessionCount} sessions, output ONE workout with:
1. title (e.g. "Session 1: Upper Strength")
2. description (brief focus)
${taskLines.map((line) => line).join('\n')}

${taskInstruction}

=== OUTPUT FORMAT ===
Return ONLY valid JSON. No markdown. Start with { and end with }.

{
  "workouts": [
    {
      "title": "Session 1: Upper Strength",
      "description": "Horizontal push/pull emphasis",
      ${warmupExample}
      "exerciseBlocks": [
${mainBlocksExample}
      ]${finisherExample}${cooldownExample}
    }
  ]
}

Output exactly ${sessionCount} workouts, one per session.`;
}

function getProtocolInstructions(protocol: ProgressionProtocol): string {
  switch (protocol) {
    case 'linear_load':
      return `- Fixed reps (e.g. 5x5), add load over time. RPE 6-7 to start.`;
    case 'double_progression':
      return `- Use rep range (e.g. 8-12). Add reps first, then add weight. RPE 7-9.`;
    case 'density_leverage':
      return `- Add sets/reps or reduce rest. Progress variations in coachNotes.`;
    default:
      return 'Apply progressive overload appropriately.';
  }
}

function validateWarmupLikeBlocks(
  arr: unknown,
  workoutIndex: number,
  blockLabel: string
): { valid: false; error: string } | null {
  if (!Array.isArray(arr) || arr.length === 0)
    return {
      valid: false,
      error: `Workout ${workoutIndex + 1}: ${blockLabel} must be a non-empty array`,
    };
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i] as Record<string, unknown>;
    if (typeof item !== 'object' || item === null)
      return {
        valid: false,
        error: `Workout ${workoutIndex + 1}, ${blockLabel} item ${i + 1}: must be an object`,
      };
    if (typeof item.order !== 'number')
      return {
        valid: false,
        error: `Workout ${workoutIndex + 1}, ${blockLabel} item ${i + 1}: order is required`,
      };
    if (typeof item.exerciseName !== 'string' || !String(item.exerciseName || '').trim())
      return {
        valid: false,
        error: `Workout ${workoutIndex + 1}, ${blockLabel} item ${i + 1}: exerciseName is required`,
      };
    if (!Array.isArray(item.instructions))
      return {
        valid: false,
        error: `Workout ${workoutIndex + 1}, ${blockLabel} item ${i + 1}: instructions array is required`,
      };
  }
  return null;
}

/**
 * Resolve effective block options for validation (HIIT uses circuit structure for block count)
 */
function getEffectiveBlockOptionsForValidation(
  blockOptions: BlockOptions,
  hiitMode?: boolean,
  hiitOptions?: HiitOptions
): BlockOptions {
  if (!hiitMode || !hiitOptions) return blockOptions;
  const circuitCount = [
    hiitOptions.circuitStructure.circuit1,
    hiitOptions.circuitStructure.circuit2,
    hiitOptions.circuitStructure.circuit3,
  ].filter(Boolean).length;
  // HIIT has at most 3 circuits; ensure at least 1 so BlockOptions.mainBlockCount is never 0.
  const mainBlockCount = circuitCount >= 1 ? circuitCount : 1;
  return {
    includeWarmup: hiitOptions.circuitStructure.includeWarmup,
    mainBlockCount: mainBlockCount as 1 | 2 | 3 | 4 | 5,
    includeFinisher: false,
    includeCooldown: hiitOptions.circuitStructure.includeCooldown,
  };
}

/**
 * Validate Step 4 Workout Mathematician output (single layer of workouts)
 * When hiitMode is true, exercises are validated for Timer Schema (workSeconds, restSeconds, rounds) instead of sets/reps.
 */
export function validateWorkoutMathematicianOutput(
  data: unknown,
  expectedWorkoutCount: number,
  blockOptions: BlockOptions = defaultBlockOptions,
  hiitMode?: boolean,
  hiitOptions?: HiitOptions
): { valid: true; data: WorkoutInSet[] } | { valid: false; error: string } {
  if (typeof data !== 'object' || data === null) {
    return { valid: false, error: 'Workout mathematician output must be an object' };
  }

  const obj = data as Record<string, unknown>;
  const effectiveOptions = getEffectiveBlockOptionsForValidation(
    blockOptions,
    hiitMode,
    hiitOptions
  );
  const { includeWarmup, mainBlockCount, includeFinisher, includeCooldown } = effectiveOptions;

  if (!Array.isArray(obj.workouts)) {
    return { valid: false, error: 'workouts must be an array' };
  }

  if (obj.workouts.length !== expectedWorkoutCount) {
    return {
      valid: false,
      error: `Expected ${expectedWorkoutCount} workouts, got ${obj.workouts.length}`,
    };
  }

  for (let j = 0; j < obj.workouts.length; j++) {
    const workout = obj.workouts[j] as Record<string, unknown>;

    if (typeof workout !== 'object' || workout === null) {
      return { valid: false, error: `Workout ${j + 1}: must be an object` };
    }

    if (typeof workout.title !== 'string' || !workout.title.trim()) {
      return { valid: false, error: `Workout ${j + 1}: title is required` };
    }

    if (typeof workout.description !== 'string' || !workout.description.trim()) {
      return { valid: false, error: `Workout ${j + 1}: description is required` };
    }

    if (includeWarmup) {
      const warmup = workout.warmupBlocks;
      // Prompt guides 2–4 warmup exercises; we allow minimum 1 to avoid unnecessary regeneration when AI outputs a single warmup.
      if (!Array.isArray(warmup) || warmup.length < 1) {
        return {
          valid: false,
          error: `Workout ${j + 1}: warmupBlocks must have at least 1 exercise when includeWarmup is true`,
        };
      }
    }

    const exerciseBlocks = workout.exerciseBlocks as
      | Array<{ exercises?: Array<Record<string, unknown>> }>
      | undefined;
    const blocks = workout.blocks as Array<Record<string, unknown>> | undefined;

    if (exerciseBlocks && Array.isArray(exerciseBlocks)) {
      if (exerciseBlocks.length !== mainBlockCount) {
        return {
          valid: false,
          error: `Workout ${j + 1}: expected exactly ${mainBlockCount} exercise block(s), got ${exerciseBlocks.length}`,
        };
      }
      for (let k = 0; k < exerciseBlocks.length; k++) {
        const block = exerciseBlocks[k];
        const exercises = block?.exercises;
        if (!Array.isArray(exercises)) {
          return {
            valid: false,
            error: `Workout ${j + 1}, Block ${k + 1}: exercises array is required`,
          };
        }
        for (let e = 0; e < exercises.length; e++) {
          const ex = exercises[e] as Record<string, unknown>;
          if (typeof ex !== 'object' || ex === null) {
            return {
              valid: false,
              error: `Workout ${j + 1}, Block ${k + 1}, Exercise ${e + 1}: must be an object`,
            };
          }
          if (typeof ex.exerciseName !== 'string' || !String(ex.exerciseName || '').trim()) {
            return {
              valid: false,
              error: `Workout ${j + 1}, Block ${k + 1}, Exercise ${e + 1}: exerciseName is required`,
            };
          }
          if (hiitMode) {
            if (typeof ex.workSeconds !== 'number' || ex.workSeconds < 1) {
              return {
                valid: false,
                error: `Workout ${j + 1}, Block ${k + 1}, Exercise ${e + 1}: workSeconds is required (positive number) for HIIT`,
              };
            }
            if (typeof ex.restSeconds !== 'number' || ex.restSeconds < 0) {
              return {
                valid: false,
                error: `Workout ${j + 1}, Block ${k + 1}, Exercise ${e + 1}: restSeconds is required for HIIT`,
              };
            }
            if (typeof ex.rounds !== 'number' || ex.rounds < 1) {
              return {
                valid: false,
                error: `Workout ${j + 1}, Block ${k + 1}, Exercise ${e + 1}: rounds is required (positive number) for HIIT`,
              };
            }
          } else {
            if (typeof ex.sets !== 'number' || ex.sets < 1) {
              return {
                valid: false,
                error: `Workout ${j + 1}, Block ${k + 1}, Exercise ${e + 1}: sets must be a positive number`,
              };
            }
            if (typeof ex.reps !== 'string' && typeof ex.reps !== 'number') {
              return {
                valid: false,
                error: `Workout ${j + 1}, Block ${k + 1}, Exercise ${e + 1}: reps is required`,
              };
            }
          }
        }
      }
    } else if (blocks && Array.isArray(blocks) && blocks.length > 0) {
      if (blocks.length !== mainBlockCount) {
        return {
          valid: false,
          error: `Workout ${j + 1}: expected exactly ${mainBlockCount} block(s), got ${blocks.length}`,
        };
      }
      for (let k = 0; k < blocks.length; k++) {
        const block = blocks[k];
        if (typeof block !== 'object' || block === null) {
          return {
            valid: false,
            error: `Workout ${j + 1}, Block ${k + 1}: must be an object`,
          };
        }
        if (typeof block.exerciseName !== 'string' || !(block.exerciseName as string).trim()) {
          return {
            valid: false,
            error: `Workout ${j + 1}, Block ${k + 1}: exerciseName is required`,
          };
        }
        if (hiitMode) {
          if (typeof block.workSeconds !== 'number' || (block.workSeconds as number) < 1) {
            return {
              valid: false,
              error: `Workout ${j + 1}, Block ${k + 1}: workSeconds is required for HIIT`,
            };
          }
          if (typeof block.restSeconds !== 'number' || (block.restSeconds as number) < 0) {
            return {
              valid: false,
              error: `Workout ${j + 1}, Block ${k + 1}: restSeconds is required for HIIT`,
            };
          }
          if (typeof block.rounds !== 'number' || (block.rounds as number) < 1) {
            return {
              valid: false,
              error: `Workout ${j + 1}, Block ${k + 1}: rounds is required for HIIT`,
            };
          }
        } else {
          if (typeof block.sets !== 'number' || (block.sets as number) < 1) {
            return {
              valid: false,
              error: `Workout ${j + 1}, Block ${k + 1}: sets must be a positive number`,
            };
          }
          if (typeof block.reps !== 'string' && typeof block.reps !== 'number') {
            return {
              valid: false,
              error: `Workout ${j + 1}, Block ${k + 1}: reps is required`,
            };
          }
        }
      }
    } else {
      return {
        valid: false,
        error: `Workout ${j + 1}: must have exactly ${mainBlockCount} exercise block(s)`,
      };
    }

    if (includeFinisher) {
      const err = validateWarmupLikeBlocks(workout.finisherBlocks, j, 'finisherBlocks');
      if (err) return err;
    }
    if (includeCooldown) {
      const err = validateWarmupLikeBlocks(workout.cooldownBlocks, j, 'cooldownBlocks');
      if (err) return err;
    }
  }

  return { valid: true, data: obj.workouts as WorkoutInSet[] };
}
