/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * WOD Brief: one short brief for a single workout at the selected level.
 */

import type { WODLevel } from '@/types';
import type { WODParameters } from '@/types/wod-parameters';
import {
  TIME_DOMAIN_OPTIONS,
  WORKOUT_FORMAT_OPTIONS,
  MODALITY_BIAS_OPTIONS,
  LOAD_PROFILE_OPTIONS,
  SOCIAL_CONFIG_OPTIONS,
} from '@/types/wod-parameters';

export interface WODBriefInput {
  level: WODLevel;
  zoneName?: string;
  availableEquipment: string[];
  parameters?: WODParameters;
}

function formatParametersSection(parameters: WODParameters): string {
  const timeOpt = TIME_DOMAIN_OPTIONS[parameters.timeDomain.category];
  const timeCap =
    parameters.timeDomain.timeCapMinutes != null
      ? ` | Time cap: ${parameters.timeDomain.timeCapMinutes} min`
      : '';
  const formatNames = parameters.allowedFormats
    .map((id) => WORKOUT_FORMAT_OPTIONS[id]?.shortName ?? id)
    .join(', ');
  const loadOpt = LOAD_PROFILE_OPTIONS[parameters.loadProfile];
  const modalityOpt = MODALITY_BIAS_OPTIONS[parameters.modalityBias];
  const socialOpt = SOCIAL_CONFIG_OPTIONS[parameters.socialConfig];
  const exclusions =
    parameters.exclusions.length > 0
      ? `Exclusions: ${parameters.exclusions.join(', ')}. Do not use these.`
      : '';

  return `
=== WORKOUT PARAMETERS ===
Time Domain: ${timeOpt.name} (${timeOpt.rangeLabel})${timeCap}
Allowed Formats: ${formatNames} (AI will choose one)
Load Profile: ${loadOpt.name}
Modality Bias: ${modalityOpt.name}
Target Area: ${parameters.targetArea.replace('_', ' ')}
Movement Bias: ${parameters.movementBias}
Social: ${socialOpt.name}
${exclusions}`.trim();
}

/**
 * Build the prompt for WOD Brief (optional context step).
 */
export function buildWODBriefPrompt(input: WODBriefInput): string {
  const { level, zoneName, availableEquipment, parameters } = input;
  const equipmentList =
    availableEquipment.length > 0 ? availableEquipment.join(', ') : 'Bodyweight only';

  const paramsSection = parameters != null ? `\n${formatParametersSection(parameters)}\n` : '';

  return `Role: You are a Workout of the Day (WOD) designer.
Task: Write a SHORT brief (2–4 sentences) for a single WOD tailored to ${level} level.

=== CONSTRAINTS ===
Level: ${level}
${zoneName ? `Training Zone: ${zoneName}` : ''}
Available Equipment: ${equipmentList}
${paramsSection}

=== YOUR TASK ===
Output a brief that describes:
- Theme or focus (e.g., conditioning, strength, mixed modal) matching the parameters above
- Suggested total duration and intensity fitting the time domain
- Any scaling or modifications appropriate for ${level}

Output ONLY plain text (no JSON, no markdown).`;
}
