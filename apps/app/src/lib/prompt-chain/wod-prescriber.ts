/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * WOD Prescriber: produce one WorkoutDetail (warmup, main, finisher, cooldown) for the selected level.
 */

import type { WODLevel } from '@/types';
import type { WorkoutDetail } from '@/types';
import type { OverloadProtocol } from '@/types/overload-protocol';
import { OVERLOAD_PROTOCOLS } from '@/types/overload-protocol';
import type { WODParameters } from '@/types/wod-parameters';
import {
  TIME_DOMAIN_OPTIONS,
  WORKOUT_FORMAT_OPTIONS,
  MODALITY_BIAS_OPTIONS,
  LOAD_PROFILE_OPTIONS,
  SOCIAL_CONFIG_OPTIONS,
} from '@/types/wod-parameters';

/**
 * Context for iterating from a previous WOD.
 */
export interface WODIterationContext {
  source_wod: {
    level: WODLevel;
    workoutDetail: WorkoutDetail;
  };
  overload_protocol: OverloadProtocol;
  iteration_number: number;
}

export interface WODPrescriberInput {
  level: WODLevel;
  availableEquipment: string[];
  brief?: string;
  /** Optional iteration context for generating progressive WODs. */
  iteration?: WODIterationContext;
  /** WOD parameters (time domain, format, bias, load, social, exclusions). */
  parameters?: WODParameters;
}

/**
 * Build the iteration mode section of the prompt.
 */
function buildIterationPromptSection(iteration: WODIterationContext): string {
  const protocol = OVERLOAD_PROTOCOLS[iteration.overload_protocol];
  const previousWorkout = JSON.stringify(iteration.source_wod.workoutDetail, null, 2);

  return `
=== ITERATION MODE ===
You are iterating from a previous workout using the "${protocol.name}" protocol.
This is iteration #${iteration.iteration_number} in the progression chain.

Previous Workout Structure:
${previousWorkout}

Protocol: ${protocol.name}
Description: ${protocol.description}
Progression Logic: ${protocol.progressionLogic}

Apply the following progression based on the protocol:
- linear_load: Increase weights by 2-5% where applicable, maintain rep scheme. Add weight cues to exercise names (e.g., "Goblet Squat (increase weight 5%)").
- double_progression: Add 1-2 reps to each exercise until hitting upper range. Increase intensity cues (e.g., "Push-ups x12-15" becomes "Push-ups x14-17").
- density_leverage: Reduce rest periods, increase time under tension, or progress to harder exercise variations (e.g., "Push-ups" becomes "Diamond Push-ups" or "Archer Push-ups").

IMPORTANT:
- Keep the same overall structure and exercise types as the previous workout.
- Apply the progression protocol to make the workout slightly more challenging.
- Maintain the same block structure (warmup, main, finisher, cooldown).
- Use similar exercise names but with progression indicators where appropriate.
`;
}

/**
 * Build the workout parameters section for the prescriber prompt.
 */
function buildParametersPromptSection(parameters: WODParameters): string {
  const timeOpt = TIME_DOMAIN_OPTIONS[parameters.timeDomain.category];
  const timeCap =
    parameters.timeDomain.timeCapMinutes != null
      ? ` | Time Cap: ${parameters.timeDomain.timeCapMinutes} minutes`
      : '';
  const formatNames = parameters.allowedFormats
    .map((id) => WORKOUT_FORMAT_OPTIONS[id]?.shortName ?? id)
    .join(', ');
  const loadOpt = LOAD_PROFILE_OPTIONS[parameters.loadProfile];
  const modalityOpt = MODALITY_BIAS_OPTIONS[parameters.modalityBias];
  const socialOpt = SOCIAL_CONFIG_OPTIONS[parameters.socialConfig];
  const exclusions =
    parameters.exclusions.length > 0
      ? `\nExclusions (do NOT use these equipment or movements): ${parameters.exclusions.join(', ')}.`
      : '';

  return `
=== WORKOUT PARAMETERS ===
Time Domain: ${timeOpt.name} (${timeOpt.rangeLabel})${timeCap}
Format: Generate as ONE of: ${formatNames}. You MUST choose exactly one and set "resolvedFormat" in your JSON to that value (e.g. "amrap", "rft", "emom", "chipper", "ladder", "tabata").
Load Profile: ${loadOpt.name} — ${loadOpt.description}
Movement Bias: ${parameters.movementBias}
Modality Bias: ${modalityOpt.name}
Target Area: ${parameters.targetArea.replace('_', ' ')}
Social: ${socialOpt.name} — ${socialOpt.description}${exclusions}
`;
}

/**
 * Build the prompt for WOD Prescriber.
 */
export function buildWODPrescriberPrompt(input: WODPrescriberInput): string {
  const { level, availableEquipment, brief, iteration, parameters } = input;
  const equipmentList =
    availableEquipment.length > 0 ? availableEquipment.join(', ') : 'Bodyweight only';

  const iterationSection = iteration ? buildIterationPromptSection(iteration) : '';
  const parametersSection = parameters ? buildParametersPromptSection(parameters) : '';
  const taskDescription = iteration
    ? `Design a PROGRESSIVE iteration of the previous workout for ${level} level using the specified overload protocol.`
    : `Design ONE complete workout (Workout of the Day) for ${level} level.`;

  return `Role: You are the WOD Prescriber.
Task: ${taskDescription} Output ONLY valid JSON.

=== CONSTRAINTS ===
Level: ${level}
Available Equipment: ${equipmentList}
${brief ? `Brief/Theme: ${brief}` : ''}
${iterationSection}
${parametersSection}
=== OUTPUT FORMAT ===
Return a single JSON object with four blocks: warmup, main, finisher, cooldown, and resolvedFormat.
Each block has: title (string), duration (string, e.g. "5 Minutes"), exercises (array of exercise name strings).
resolvedFormat: one of the allowed format IDs you chose (e.g. "amrap", "rft", "emom", "chipper", "ladder", "tabata").

Scale exercises and volume for ${level}:
- Beginner: simpler movements, lower volume, more rest, clear progressions.
- Intermediate: mixed modal, moderate volume and complexity.
- Advanced: higher skill movements, Rx-style volume, stricter time domains.

{
  "warmup": { "title": "...", "duration": "...", "exercises": ["...", "..."] },
  "main": { "title": "...", "duration": "...", "exercises": ["...", "..."] },
  "finisher": { "title": "...", "duration": "...", "exercises": ["...", "..."] },
  "cooldown": { "title": "...", "duration": "...", "exercises": ["...", "..."] },
  "resolvedFormat": "amrap"
}

Rules:
1. Only use equipment from the available list (or bodyweight). Honor exclusions.
2. Each exercises array must have at least one exercise.
3. Use clear, standard exercise names (e.g. "Push-ups", "Air Squats", "Kettlebell Swings").
4. Design the main block to fit the time domain and load profile. Use the chosen format (AMRAP, RFT, EMOM, etc.) in the main block structure and naming.
5. No markdown, no code fence — ONLY the JSON object.`;
}

/**
 * Validate WOD Prescriber output into WorkoutDetail.
 */
export function validateWODPrescriberOutput(
  data: unknown
): { valid: true; data: WorkoutDetail } | { valid: false; error: string } {
  if (typeof data !== 'object' || data === null) {
    return { valid: false, error: 'Prescriber output must be an object' };
  }

  const obj = data as Record<string, unknown>;
  const blocks = ['warmup', 'main', 'finisher', 'cooldown'] as const;

  for (const key of blocks) {
    const block = obj[key];
    if (typeof block !== 'object' || block === null) {
      return { valid: false, error: `Missing or invalid block: ${key}` };
    }
    const b = block as Record<string, unknown>;
    if (typeof b.title !== 'string' || !b.title.trim()) {
      return { valid: false, error: `${key}.title is required` };
    }
    if (typeof b.duration !== 'string' || !b.duration.trim()) {
      return { valid: false, error: `${key}.duration is required` };
    }
    if (!Array.isArray(b.exercises) || b.exercises.length === 0) {
      return { valid: false, error: `${key}.exercises must be a non-empty array` };
    }
    for (let i = 0; i < b.exercises.length; i++) {
      if (typeof b.exercises[i] !== 'string' || !(b.exercises[i] as string).trim()) {
        return { valid: false, error: `${key}.exercises[${i}] must be a non-empty string` };
      }
    }
  }

  const workoutDetail: WorkoutDetail = {
    warmup: {
      title: (obj.warmup as Record<string, unknown>).title as string,
      duration: (obj.warmup as Record<string, unknown>).duration as string,
      exercises: ((obj.warmup as Record<string, unknown>).exercises as string[]).map((s) =>
        String(s).trim()
      ),
    },
    main: {
      title: (obj.main as Record<string, unknown>).title as string,
      duration: (obj.main as Record<string, unknown>).duration as string,
      exercises: ((obj.main as Record<string, unknown>).exercises as string[]).map((s) =>
        String(s).trim()
      ),
    },
    finisher: {
      title: (obj.finisher as Record<string, unknown>).title as string,
      duration: (obj.finisher as Record<string, unknown>).duration as string,
      exercises: ((obj.finisher as Record<string, unknown>).exercises as string[]).map((s) =>
        String(s).trim()
      ),
    },
    cooldown: {
      title: (obj.cooldown as Record<string, unknown>).title as string,
      duration: (obj.cooldown as Record<string, unknown>).duration as string,
      exercises: ((obj.cooldown as Record<string, unknown>).exercises as string[]).map((s) =>
        String(s).trim()
      ),
    },
  };

  return { valid: true, data: workoutDetail };
}
