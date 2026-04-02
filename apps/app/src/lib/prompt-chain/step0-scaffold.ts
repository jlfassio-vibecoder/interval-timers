/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Step 0: The Scaffold
 * Decides phase structure (names, weeks per phase, focus) before any phase is built.
 */

import type { ProgramPersona, ProgramTemplateScaffold, PhaseScaffold } from '@/types/ai-program';

/**
 * Build the prompt for Step 0: The Scaffold
 */
export function buildScaffoldPrompt(persona: ProgramPersona): string {
  const { title, description, demographics, medical, goals, durationWeeks, daysPerWeek } = persona;
  const programDuration = durationWeeks || 6;
  const experienceLine =
    demographics.experienceLevel === 'any'
      ? '- Experience Level: Any (suitable for all levels)'
      : `- Experience Level: ${demographics.experienceLevel}`;
  const daysHint =
    typeof daysPerWeek === 'number' && daysPerWeek >= 2 && daysPerWeek <= 6
      ? `\nSuggested default: ${daysPerWeek} days per week. You may set different daysPerWeek per phase (2-6) or omit so each phase builder decides.`
      : '';

  const medicalSection =
    medical.injuries || medical.conditions
      ? `
Medical Context:
${medical.injuries ? `- Injuries: ${medical.injuries}` : ''}
${medical.conditions ? `- Conditions: ${medical.conditions}` : ''}`
      : '';

  return `Role: You are the Program Periodization Architect.
Task: Divide a ${programDuration}-week program into 2 to 4 distinct PHASES. Each phase will be built separately (split, exercises, and progression can differ per phase). Define only the high-level structure: phase name, number of weeks, focus, and optional instructions for the phase builder.

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

Program Duration: ${programDuration} weeks total.

=== YOUR TASK ===
Output 2 to 4 phases. The sum of weeks across all phases MUST equal ${programDuration}.

Typical patterns:
- 2 phases: e.g. "Foundation" (weeks 1-4) + "Intensification" (weeks 5-8)
- 3 phases: e.g. "Neural Adaptation" (2) + "Hypertrophy" (4) + "Strength Peak" (2)
- 4 phases: e.g. "Adaptation" (2) + "Hypertrophy" (4) + "Strength" (4) + "Deload/Peak" (2)

For each phase provide:
- phaseIndex: 1-based order (1, 2, 3, ...)
- name: Short phase name (e.g. "Neural Adaptation", "Hypertrophy Block")
- weeks: Number of weeks in this phase (must sum to ${programDuration})
- focus: One or two sentences on the phase intent (e.g. "Build work capacity and movement quality")
- daysPerWeek: Optional. Training days per week for this phase (2-6). Omit to let the phase builder decide.
- instructions: Optional. Brief instructions for the Architect when building this phase (e.g. "Emphasize technique over load; use higher reps.")

=== OUTPUT FORMAT ===
Return ONLY valid JSON. No markdown, no explanations. Start with { and end with }.

{
  "phases": [
    {
      "phaseIndex": 1,
      "name": "Neural Adaptation",
      "weeks": 2,
      "focus": "Build movement quality and work capacity.",
      "daysPerWeek": 4,
      "instructions": "Emphasize technique; moderate volume."
    },
    {
      "phaseIndex": 2,
      "name": "Hypertrophy",
      "weeks": 4,
      "focus": "Maximize muscle growth with progressive volume.",
      "daysPerWeek": 4,
      "instructions": "Use double progression; 8-12 rep ranges."
    }
  ],
  "totalWeeks": ${programDuration}
}

Generate phases that sum to exactly ${programDuration} weeks.`;
}

/**
 * Validate Step 0 (scaffold) output
 */
export function validateScaffoldOutput(
  data: unknown,
  expectedTotalWeeks: number
): { valid: true; data: ProgramTemplateScaffold } | { valid: false; error: string } {
  if (typeof data !== 'object' || data === null) {
    return { valid: false, error: 'Scaffold output must be an object' };
  }

  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.phases) || obj.phases.length < 2 || obj.phases.length > 6) {
    return { valid: false, error: 'phases must be an array of 2 to 6 phases' };
  }

  let sumWeeks = 0;
  const phases: PhaseScaffold[] = [];

  for (let i = 0; i < obj.phases.length; i++) {
    const p = obj.phases[i];
    if (typeof p !== 'object' || p === null) {
      return { valid: false, error: `phases[${i}] must be an object` };
    }
    const phase = p as Record<string, unknown>;

    const phaseIndex = typeof phase.phaseIndex === 'number' ? phase.phaseIndex : i + 1;
    if (phaseIndex < 1) {
      return { valid: false, error: `phases[${i}].phaseIndex must be >= 1` };
    }

    if (typeof phase.name !== 'string' || !phase.name.trim()) {
      return { valid: false, error: `phases[${i}].name is required` };
    }

    if (typeof phase.weeks !== 'number' || phase.weeks < 1) {
      return { valid: false, error: `phases[${i}].weeks must be a positive number` };
    }
    sumWeeks += phase.weeks;

    if (typeof phase.focus !== 'string' || !phase.focus.trim()) {
      return { valid: false, error: `phases[${i}].focus is required` };
    }

    const daysPerWeek = phase.daysPerWeek;
    if (
      daysPerWeek !== undefined &&
      (typeof daysPerWeek !== 'number' || daysPerWeek < 2 || daysPerWeek > 6)
    ) {
      return { valid: false, error: `phases[${i}].daysPerWeek must be 2-6 if set` };
    }

    phases.push({
      phaseIndex,
      name: (phase.name as string).trim(),
      weeks: phase.weeks as number,
      focus: (phase.focus as string).trim(),
      ...(typeof phase.daysPerWeek === 'number' && phase.daysPerWeek >= 2 && phase.daysPerWeek <= 6
        ? { daysPerWeek: phase.daysPerWeek }
        : {}),
      ...(typeof phase.instructions === 'string' && (phase.instructions as string).trim()
        ? { instructions: (phase.instructions as string).trim() }
        : {}),
    });
  }

  if (sumWeeks !== expectedTotalWeeks) {
    return {
      valid: false,
      error: `Phase weeks sum to ${sumWeeks} but program duration is ${expectedTotalWeeks}`,
    };
  }

  const totalWeeks = typeof obj.totalWeeks === 'number' ? obj.totalWeeks : sumWeeks;
  if (totalWeeks !== expectedTotalWeeks) {
    return {
      valid: false,
      error: `totalWeeks (${totalWeeks}) must equal program duration (${expectedTotalWeeks})`,
    };
  }

  return {
    valid: true,
    data: { phases, totalWeeks },
  };
}
