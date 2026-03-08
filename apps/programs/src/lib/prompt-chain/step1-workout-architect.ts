/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Step 1: The Workout Architect
 * Establishes 1–N sessions (single, split, or two-a-day) and progression logic.
 * Output shape is compatible with Biomechanist/Coach (split, volume_landmarks).
 */

import type { WorkoutPersona, WorkoutArchitectBlueprint, HiitOptions } from '@/types/ai-workout';
import type { ProgressionProtocol } from '@/types/ai-program';

interface ZoneContext {
  zoneName: string;
  availableEquipment: string[];
  biomechanicalConstraints: string[];
}

/**
 * Build the prompt for Step 1: The Workout Architect
 */
export function buildWorkoutArchitectPrompt(
  persona: WorkoutPersona,
  zoneContext?: ZoneContext,
  hiitOptions?: HiitOptions
): string {
  const {
    title,
    description,
    demographics,
    medical,
    goals,
    weeklyTimeMinutes,
    sessionsPerWeek,
    sessionDurationMinutes,
    splitType,
    lifestyle,
    twoADay,
    preferredFocus,
  } = persona;

  const hiitSection =
    hiitOptions &&
    `
=== METABOLIC CONDITIONING (HIIT) MODE ===
Design interval-based sessions using density and time, not sets/reps.

Protocol Format: ${hiitOptions.protocolFormat}
${hiitOptions.workRestRatio ? `Work:Rest Ratio: ${hiitOptions.workRestRatio}` : ''}
Circuit Structure: Warmup=${hiitOptions.circuitStructure.includeWarmup}, Circuit 1 (Driver)=${hiitOptions.circuitStructure.circuit1}, Circuit 2 (Sustainer)=${hiitOptions.circuitStructure.circuit2}, Circuit 3 (Burnout)=${hiitOptions.circuitStructure.circuit3}, Cool Down=${hiitOptions.circuitStructure.includeCooldown}
Session Duration Tier: ${hiitOptions.sessionDurationTier} (keep duration_minutes within 4–30)
Primary Focus: ${hiitOptions.primaryGoal}

Output sessions with duration_minutes in the HIIT range (4–30). progression_protocol can be density_leverage. volume_landmarks can emphasize energy systems or time under tension where relevant.
`;

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

  const focusSection = preferredFocus
    ? `\nPreferred focus for single session: ${preferredFocus}`
    : '';

  return `Role: You are the Workout Architect (PhD Exercise Physiology).
Task: Design a single set of 1–N training sessions (no week-by-week program). Each session is a complete workout. Respect the user's time and split preferences.

=== USER PROFILE ===
Title: ${title || '(Auto-generate)'}
Description: ${description || '(Auto-generate based on goals)'}

Demographics:
- Age Range: ${demographics.ageRange}
- Sex: ${demographics.sex}
- Weight: ${demographics.weight} lbs
- Experience Level: ${demographics.experienceLevel}
${medicalSection}

Goals:
- Primary: ${goals.primary}
- Secondary: ${goals.secondary}

Workout constraints:
- Weekly time available: ${weeklyTimeMinutes} minutes
- Sessions per week: ${sessionsPerWeek}
- Session duration (target): ${sessionDurationMinutes} minutes
- Split type: ${splitType}
- Lifestyle: ${lifestyle}
- Two-a-day allowed: ${twoADay}
${focusSection}
${equipmentSection}
${hiitSection ?? ''}

=== YOUR TASK ===
1. Decide how many distinct sessions to create (1 to ${sessionsPerWeek}). For splits, e.g. 2 (Upper/Lower), 3 (PPL), 4 (Upper/Lower x2). For single session, output 1.
2. For each session: session_number, session_name, focus, duration_minutes. Optionally volume_targets (e.g. "MEV for chest").
3. Choose progression_protocol: linear_load, double_progression, or density_leverage (same definitions as program architect).
4. Output split object: type (string), days_per_week (number of sessions), session_duration_minutes.
5. Output volume_landmarks for muscle groups (MEV/MRV sets per week) so the Biomechanist can balance patterns.

=== OUTPUT FORMAT ===
Return ONLY valid JSON. No markdown, no explanations. Start with { and end with }.

{
  "workout_set_name": "Short name for this workout set",
  "rationale": "One sentence why this session design fits the user.",
  "sessions": [
    { "session_number": 1, "session_name": "Upper Strength", "focus": "Horizontal push/pull, vertical push/pull", "duration_minutes": 45 },
    { "session_number": 2, "session_name": "Lower + Core", "focus": "Knee/hip dominant, core", "duration_minutes": 45 }
  ],
  "split": {
    "type": "Upper/Lower or PPL or Full Body etc.",
    "days_per_week": 2,
    "session_duration_minutes": 45
  },
  "progression_protocol": "linear_load or double_progression or density_leverage",
  "progression_rules": {
    "description": "How to progress within or across sessions",
    "weeks_1_3": "Accumulation focus",
    "weeks_4_6": "Intensification focus"
  },
  "volume_landmarks": [
    { "muscle_group": "Chest", "mev_sets": 6, "mrv_sets": 12 },
    { "muscle_group": "Quads", "mev_sets": 6, "mrv_sets": 14 }
  ]
}

Generate exactly the number of sessions that fit the user's sessionsPerWeek and splitType.`;
}

/**
 * Validate Step 1 Workout Architect output
 * @param hiitMode - When true, allow session duration_minutes >= 4 (HIIT caps)
 */
export function validateWorkoutArchitectOutput(
  data: unknown,
  hiitMode?: boolean
): { valid: true; data: WorkoutArchitectBlueprint } | { valid: false; error: string } {
  if (typeof data !== 'object' || data === null) {
    return { valid: false, error: 'Workout architect output must be an object' };
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.workout_set_name !== 'string' || !obj.workout_set_name.trim()) {
    return { valid: false, error: 'workout_set_name is required' };
  }

  if (typeof obj.rationale !== 'string' || !obj.rationale.trim()) {
    return { valid: false, error: 'rationale is required' };
  }

  if (!Array.isArray(obj.sessions) || obj.sessions.length < 1 || obj.sessions.length > 7) {
    return { valid: false, error: 'sessions must be an array of 1–7 items' };
  }

  for (let i = 0; i < obj.sessions.length; i++) {
    const s = obj.sessions[i] as Record<string, unknown>;
    if (typeof s.session_number !== 'number') {
      return { valid: false, error: `sessions[${i}].session_number is required` };
    }
    if (typeof s.session_name !== 'string' || !s.session_name.trim()) {
      return { valid: false, error: `sessions[${i}].session_name is required` };
    }
    if (typeof s.focus !== 'string' || !s.focus.trim()) {
      return { valid: false, error: `sessions[${i}].focus is required` };
    }
    const minDuration = hiitMode ? 4 : 10;
    if (typeof s.duration_minutes !== 'number' || s.duration_minutes < minDuration) {
      return {
        valid: false,
        error: `sessions[${i}].duration_minutes must be at least ${minDuration}`,
      };
    }
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
  const minSplitDuration = hiitMode ? 4 : 10;
  if (
    typeof split.session_duration_minutes !== 'number' ||
    split.session_duration_minutes < minSplitDuration
  ) {
    return {
      valid: false,
      error: `split.session_duration_minutes must be at least ${minSplitDuration}`,
    };
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

  return { valid: true, data: obj as unknown as WorkoutArchitectBlueprint };
}
