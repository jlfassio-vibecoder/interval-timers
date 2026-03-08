/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Step 1: Challenge Architect
 * Establishes constraints and progression for 2-6 week challenges.
 * Outputs ArchitectBlueprint + milestones for reuse with steps 2-4.
 */

import type { ArchitectBlueprint, ProgressionProtocol } from '@/types/ai-program';
import type { ChallengePersona, ChallengeMilestone } from '@/types/ai-challenge';

interface ZoneContext {
  zoneName: string;
  availableEquipment: string[];
  biomechanicalConstraints: string[];
}

export interface ChallengeArchitectOutput {
  architect: ArchitectBlueprint;
  milestones: ChallengeMilestone[];
}

/**
 * Build the prompt for Step 1: Challenge Architect
 * Tuned for 2-6 week challenges, theme integration, habit-building, milestones.
 */
export function buildChallengeArchitectPrompt(
  persona: ChallengePersona,
  zoneContext?: ZoneContext
): string {
  const { title, description, theme, demographics, medical, goals, durationWeeks } = persona;

  const equipmentSection = zoneContext
    ? `
Equipment Zone: ${zoneContext.zoneName}
Available Equipment: ${zoneContext.availableEquipment.join(', ')}
Biomechanical Constraints: ${zoneContext.biomechanicalConstraints.join(', ')}`
    : '';

  const medicalSection =
    medical.injuries || medical.conditions
      ? `
Medical Context:
${medical.injuries ? `- Injuries: ${medical.injuries}` : ''}
${medical.conditions ? `- Conditions: ${medical.conditions}` : ''}`
      : '';

  const themeSection = theme ? `\nTheme: ${theme} (use this to name phases and milestones)` : '';

  return `Role: You are the Challenge Architect (PhD Exercise Physiology).
Task: Establish the constraints and progression logic for a ${durationWeeks}-week CHALLENGE (2-6 week sprint) BEFORE picking any exercises.

=== CHALLENGE PROFILE ===
Title: ${title || '(Auto-generate)'}
Description: ${description || '(Auto-generate based on goals)'}
${themeSection}

Demographics:
- Age Range: ${demographics.ageRange}
- Sex: ${demographics.sex}
- Weight: ${demographics.weight} lbs
- Experience Level: ${demographics.experienceLevel}
${medicalSection}

Goals:
- Primary: ${goals.primary}
- Secondary: ${goals.secondary}
${equipmentSection}

Challenge Duration: ${durationWeeks} weeks (shorter than programs; emphasize habit-building and theme alignment)

=== YOUR TASK ===
Select ONE progression protocol:
1. LINEAR LOAD — Best for strength; load increases week to week
2. DOUBLE PROGRESSION — Best for hypertrophy; earn weight by mastering rep range
3. DENSITY & LEVERAGE — Best for calisthenics/conditioning; decrease rest or progress variation

Define:
- Split (Upper/Lower, Full Body, PPL, etc.) — suitable for ${durationWeeks} weeks
- Volume Landmarks per muscle group
- Progression rules adapted to ${durationWeeks} weeks (use weeks_1_3 for early phase, weeks_4_6 for later phase; interpret appropriately for short cycles)
- Milestones: ${durationWeeks === 2 ? '2' : durationWeeks <= 4 ? '2-3' : '3-4'} check-in points (e.g. Form Check, Halfway, Final Push) with week numbers and optional checkInPrompt

=== OUTPUT FORMAT ===
Return ONLY valid JSON. No markdown, no explanations. Start with { and end with }.

{
  "program_name": "${title || 'Challenge name aligned with theme and goals'}",
  "rationale": "One sentence on why this protocol and split achieves the challenge goal.",
  "split": {
    "type": "Upper/Lower or Full Body etc.",
    "days_per_week": 4,
    "session_duration_minutes": 45
  },
  "progression_protocol": "linear_load or double_progression or density_leverage",
  "progression_rules": {
    "description": "Human-readable explanation of progression for this short challenge",
    "weeks_1_3": "Early phase focus (adapt to ${durationWeeks} weeks)",
    "weeks_4_6": "Later phase focus (adapt to ${durationWeeks} weeks)"
  },
  "volume_landmarks": [
    { "muscle_group": "Quads", "mev_sets": 8, "mrv_sets": 14 },
    { "muscle_group": "Chest", "mev_sets": 6, "mrv_sets": 12 }
  ],
  "milestones": [
    { "week": 1, "label": "Form Check", "checkInPrompt": "How does your form feel on the main lifts?" },
    { "week": ${Math.ceil(durationWeeks / 2)}, "label": "Halfway", "checkInPrompt": "What wins are you seeing so far?" },
    { "week": ${durationWeeks}, "label": "Final Push", "checkInPrompt": "Reflect on your progress and set next goals." }
  ]
}`;
}

/**
 * Validate milestones array (shared by architect output and client-provided payloads).
 * Used to prevent invalid shapes from breaking downstream ChallengeTemplate rendering.
 */
export function validateMilestones(
  value: unknown,
  options?: { maxWeek?: number; allowEmpty?: boolean }
): { valid: true; data: ChallengeMilestone[] } | { valid: false; error: string } {
  if (!Array.isArray(value)) {
    return { valid: false, error: 'milestones must be an array' };
  }
  const maxWeek = options?.maxWeek ?? 52;
  if (!options?.allowEmpty && value.length === 0) {
    return { valid: false, error: 'milestones array must not be empty' };
  }
  const result: ChallengeMilestone[] = [];
  for (let i = 0; i < value.length; i++) {
    const m = value[i];
    if (m === null || typeof m !== 'object') {
      return { valid: false, error: `milestone at index ${i} must be an object` };
    }
    const milestone = m as Record<string, unknown>;
    const week = milestone.week;
    if (typeof week !== 'number' || !Number.isInteger(week) || !Number.isFinite(week)) {
      return {
        valid: false,
        error: `milestone at index ${i} has invalid week; expected a finite integer`,
      };
    }
    if (week < 1 || week > maxWeek) {
      return {
        valid: false,
        error: `milestone at index ${i} has week out of bounds (1-${maxWeek})`,
      };
    }
    const label = milestone.label;
    if (typeof label !== 'string' || label.trim().length === 0) {
      return {
        valid: false,
        error: `milestone at index ${i} has invalid label; expected non-empty string`,
      };
    }
    if (milestone.checkInPrompt !== undefined && typeof milestone.checkInPrompt !== 'string') {
      return {
        valid: false,
        error: `milestone at index ${i} has invalid checkInPrompt; expected string if present`,
      };
    }
    result.push({
      week,
      label: label.trim(),
      checkInPrompt: milestone.checkInPrompt as string | undefined,
    });
  }
  return { valid: true, data: result };
}

/**
 * Validate Step 1 Challenge Architect output
 * Validates ArchitectBlueprint fields + milestones array.
 */
export function validateChallengeArchitectOutput(
  data: unknown
): { valid: true; data: ChallengeArchitectOutput } | { valid: false; error: string } {
  if (typeof data !== 'object' || data === null) {
    return { valid: false, error: 'Challenge architect output must be an object' };
  }

  const obj = data as Record<string, unknown>;

  // ArchitectBlueprint fields
  if (typeof obj.program_name !== 'string' || !obj.program_name.trim()) {
    return { valid: false, error: 'program_name is required' };
  }

  if (typeof obj.rationale !== 'string' || !obj.rationale.trim()) {
    return { valid: false, error: 'rationale is required' };
  }

  if (typeof obj.split !== 'object' || obj.split === null) {
    return { valid: false, error: 'split object is required' };
  }

  const split = obj.split as Record<string, unknown>;
  if (typeof split.type !== 'string' || !split.type.trim()) {
    return { valid: false, error: 'split.type is required' };
  }
  if (
    typeof split.days_per_week !== 'number' ||
    split.days_per_week < 1 ||
    split.days_per_week > 7
  ) {
    return { valid: false, error: 'split.days_per_week must be between 1 and 7' };
  }
  if (typeof split.session_duration_minutes !== 'number' || split.session_duration_minutes < 10) {
    return { valid: false, error: 'split.session_duration_minutes must be at least 10' };
  }

  const validProtocols: ProgressionProtocol[] = [
    'linear_load',
    'double_progression',
    'density_leverage',
  ];
  if (!validProtocols.includes(obj.progression_protocol as ProgressionProtocol)) {
    return {
      valid: false,
      error: `progression_protocol must be one of: ${validProtocols.join(', ')}`,
    };
  }

  if (typeof obj.progression_rules !== 'object' || obj.progression_rules === null) {
    return { valid: false, error: 'progression_rules object is required' };
  }

  const rules = obj.progression_rules as Record<string, unknown>;
  if (typeof rules.description !== 'string') {
    return { valid: false, error: 'progression_rules.description is required' };
  }
  if (typeof rules.weeks_1_3 !== 'string') {
    return { valid: false, error: 'progression_rules.weeks_1_3 is required' };
  }
  if (typeof rules.weeks_4_6 !== 'string') {
    return { valid: false, error: 'progression_rules.weeks_4_6 is required' };
  }

  if (!Array.isArray(obj.volume_landmarks)) {
    return { valid: false, error: 'volume_landmarks must be an array' };
  }

  for (const landmark of obj.volume_landmarks) {
    if (typeof landmark !== 'object' || landmark === null) {
      return { valid: false, error: 'Each volume_landmark must be an object' };
    }
    const lm = landmark as Record<string, unknown>;
    if (typeof lm.muscle_group !== 'string') {
      return { valid: false, error: 'volume_landmark.muscle_group is required' };
    }
    if (typeof lm.mev_sets !== 'number') {
      return { valid: false, error: 'volume_landmark.mev_sets must be a number' };
    }
    if (typeof lm.mrv_sets !== 'number') {
      return { valid: false, error: 'volume_landmark.mrv_sets must be a number' };
    }
  }

  // Milestones
  if (!Array.isArray(obj.milestones)) {
    return { valid: false, error: 'milestones must be an array' };
  }

  const milestoneValidation = validateMilestones(obj.milestones, { allowEmpty: true });
  if (!milestoneValidation.valid) {
    return { valid: false, error: milestoneValidation.error };
  }
  const milestones = milestoneValidation.data;

  const architect: ArchitectBlueprint = {
    program_name: obj.program_name as string,
    rationale: obj.rationale as string,
    split: obj.split as ArchitectBlueprint['split'],
    progression_protocol: obj.progression_protocol as ProgressionProtocol,
    progression_rules: obj.progression_rules as ArchitectBlueprint['progression_rules'],
    volume_landmarks: obj.volume_landmarks as ArchitectBlueprint['volume_landmarks'],
  };

  return {
    valid: true,
    data: { architect, milestones },
  };
}
