/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Step 1: The Architect
 * Establishes constraints and progression logic before picking exercises.
 */

import type {
  ProgramPersona,
  ArchitectBlueprint,
  ProgressionProtocol,
  PhaseScaffold,
  ProgramSchedule,
} from '@/types/ai-program';

interface ZoneContext {
  zoneName: string;
  availableEquipment: string[];
  biomechanicalConstraints: string[];
}

/** Summarize previous phase schedule for Architect context (days, split, exercise names). */
function summarizePreviousPhaseForArchitect(previousPhaseWorkouts: ProgramSchedule[]): string {
  if (previousPhaseWorkouts.length === 0) return '';
  const lastWeek = previousPhaseWorkouts[previousPhaseWorkouts.length - 1];
  const daySummaries = (lastWeek?.workouts ?? []).map((w, i) => {
    const blocks = w.exerciseBlocks ?? (w.blocks ? [{ exercises: w.blocks }] : []);
    const names = blocks.flatMap((b) =>
      (b.exercises ?? []).map((e) => (e as { exerciseName?: string }).exerciseName ?? '')
    );
    return `Day ${i + 1}: ${w.title} — ${names.filter(Boolean).join(', ') || '(no exercises)'}`;
  });
  return `
=== PREVIOUS PHASE STRUCTURE (progress from this) ===
Weeks already built: ${previousPhaseWorkouts.length}. Last week structure:
${daySummaries.join('\n')}

Design this phase to progress from that (e.g. same or similar split, increased volume or intensity).`;
}

/**
 * Build the prompt for Step 1: The Architect
 * When phaseContext is provided, designs for that phase only (phase-scoped build).
 * When previousPhaseWorkouts is provided, includes context so this phase progresses from it.
 */
export function buildArchitectPrompt(
  persona: ProgramPersona,
  zoneContext?: ZoneContext,
  phaseContext?: PhaseScaffold,
  previousPhaseWorkouts?: ProgramSchedule[]
): string {
  const { title, description, demographics, medical, goals, durationWeeks, daysPerWeek } = persona;
  const programDuration = phaseContext ? phaseContext.weeks : (durationWeeks || 6);
  const phaseSection = phaseContext
    ? `
=== PHASE CONTEXT (this phase only) ===
Phase: ${phaseContext.name}
Weeks in this phase: ${phaseContext.weeks}
Focus: ${phaseContext.focus}
${phaseContext.instructions ? `Instructions: ${phaseContext.instructions}` : ''}
${phaseContext.daysPerWeek ? `Training days per week for this phase: ${phaseContext.daysPerWeek}` : ''}
`
    : '';
  const previousPhaseSection =
    previousPhaseWorkouts && previousPhaseWorkouts.length > 0
      ? summarizePreviousPhaseForArchitect(previousPhaseWorkouts)
      : '';
  const experienceLine =
    demographics.experienceLevel === 'any'
      ? '- Experience Level: Any (suitable for all levels)'
      : `- Experience Level: ${demographics.experienceLevel}`;
  const effectiveDays =
    phaseContext?.daysPerWeek ?? (typeof daysPerWeek === 'number' && daysPerWeek >= 2 && daysPerWeek <= 6 ? daysPerWeek : undefined);
  const daysHint = effectiveDays
    ? `\nPreferred training frequency: ${effectiveDays} days per week.`
    : '';

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

  return `Role: You are the Macro-Cycle Architect (PhD Exercise Physiology).
Task: Establish the constraints and progression logic for ${phaseContext ? `this ${programDuration}-week phase only` : `a ${programDuration}-week program`} BEFORE picking any exercises.
${phaseSection}
=== USER PROFILE ===
Title: ${title || '(Auto-generate)'}
Description: ${description || '(Auto-generate based on goals)'}

Demographics:
- Age Range: ${demographics.ageRange}
- ${demographics.sex === 'Universal' ? 'Target: Universal (gender-neutral; design for any user without gender-specific programming)' : `Sex: ${demographics.sex}`}
- Weight: ${demographics.weight} lbs
${experienceLine}
${medicalSection}
${daysHint}

Goals:
- Primary: ${goals.primary}
- Secondary: ${goals.secondary}
${equipmentSection}

Program Duration: ${programDuration} weeks${phaseContext ? ' (this phase only)' : ''}
${previousPhaseSection}

=== YOUR TASK ===
Select ONE of these three progression protocols based on the user profile:

1. LINEAR LOAD (Best for: Beginners, Strength Goals, Barbell/Machine)
   - Variables are fixed; Load is dynamic
   - Reps stay constant (e.g., 5x5)
   - Weight increases 2.5-5% every week

2. DOUBLE PROGRESSION (Best for: Intermediates, Hypertrophy, Dumbbells)
   - Earn the right to add weight by mastering the rep range
   - Reps increase first within a range (e.g., 8-12)
   - When top of range is hit, increase weight and drop to bottom

3. DENSITY & LEVERAGE (Best for: Calisthenics, Conditioning, Limited Equipment)
   - When you can't add weight, decrease rest or increase difficulty
   - Weeks 1-3: Add Sets or Reps
   - Weeks 4-6: Reduce Rest time or progress to harder variation

Also define:
- The optimal Split (Upper/Lower, PPL, Full Body, etc.)
- Volume Landmarks per muscle group (MEV = Minimum Effective Volume, MRV = Maximum Recoverable Volume)

=== OUTPUT FORMAT ===
Return ONLY valid JSON. No markdown, no explanations. Start with { and end with }.

{
  "program_name": "${title || 'Scientific program name based on goals'}",
  "rationale": "One sentence explaining why this protocol and split achieves the goal.",
  "split": {
    "type": "Upper/Lower or PPL or Full Body etc.",
    "days_per_week": 4,
    "session_duration_minutes": 60
  },
  "progression_protocol": "linear_load or double_progression or density_leverage",
  "progression_rules": {
    "description": "Human-readable explanation of how progression works",
    "weeks_1_3": "Accumulation phase focus (e.g., Add sets/reps)",
    "weeks_4_6": "Intensification phase focus (e.g., Add load, reduce rest)"
  },
  "volume_landmarks": [
    { "muscle_group": "Quads", "mev_sets": 10, "mrv_sets": 16 },
    { "muscle_group": "Chest", "mev_sets": 8, "mrv_sets": 14 }
  ]
}`;
}

/**
 * Validate Step 1 output
 */
export function validateArchitectOutput(
  data: unknown
): { valid: true; data: ArchitectBlueprint } | { valid: false; error: string } {
  if (typeof data !== 'object' || data === null) {
    return { valid: false, error: 'Architect output must be an object' };
  }

  const obj = data as Record<string, unknown>;

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

  return { valid: true, data: obj as unknown as ArchitectBlueprint };
}
