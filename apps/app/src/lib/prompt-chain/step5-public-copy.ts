/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Step 5: Public Title & Description
 * Writes a public-facing title and description from the finished program (scaffold + schedule).
 */

import type { ProgramTemplate, ProgramTemplateScaffold, ProgramSchedule } from '@/types/ai-program';

/**
 * Build a condensed program summary for the public-copy prompt.
 * Groups schedule weeks by phase using scaffold week ranges.
 */
function buildProgramSummary(program: ProgramTemplate, scaffold: ProgramTemplateScaffold | null): string {
  const { title, difficulty, durationWeeks, schedule } = program;
  const scheduleByWeek = new Map<number, ProgramSchedule>();
  for (const week of schedule ?? []) {
    scheduleByWeek.set(week.weekNumber, week);
  }

  let out = `Program metadata:
- Duration: ${durationWeeks} weeks
- Difficulty: ${difficulty}
- Current title (hint only): ${title || '(none)'}
`;

  if (scaffold?.phases?.length) {
    let weekStart = 1;
    out += '\nPhases:\n';
    for (const phase of scaffold.phases) {
      const weekEnd = weekStart + phase.weeks - 1;
      out += `\nPhase ${phase.phaseIndex}: "${phase.name}" (Weeks ${weekStart}-${weekEnd}, ${phase.weeks} weeks)\n`;
      out += `  Focus: ${phase.focus}\n`;
      if (phase.instructions) out += `  Instructions: ${phase.instructions}\n`;
      // List workout titles for first week of this phase (representative)
      const firstWeek = scheduleByWeek.get(weekStart);
      if (firstWeek?.workouts?.length) {
        const titles = firstWeek.workouts.map((w) => w.title).join(', ');
        out += `  Workouts (e.g. Week ${weekStart}): ${titles}\n`;
      }
      weekStart = weekEnd + 1;
    }
  } else {
    // No scaffold: list weeks 1, mid, end as sample
    out += '\nSchedule (no phase scaffold):\n';
    const sampleWeeks = [1, Math.floor((durationWeeks ?? 1) / 2), durationWeeks].filter(
      (w, i, arr) => w >= 1 && arr.indexOf(w) === i
    );
    for (const wn of sampleWeeks) {
      const week = scheduleByWeek.get(wn);
      if (week?.workouts?.length) {
        const titles = week.workouts.map((w) => w.title).join(', ');
        out += `  Week ${wn}: ${titles}\n`;
      }
    }
  }

  return out;
}

/**
 * Build the prompt for generating public title and description.
 */
export function buildPublicCopyPrompt(
  program: ProgramTemplate,
  scaffold: ProgramTemplateScaffold | null
): string {
  const summary = buildProgramSummary(program, scaffold);

  return `You are a fitness content writer. Your task is to write a public-facing title and description for this program based on its finished structure.

=== PROGRAM STRUCTURE ===
${summary}

=== YOUR TASK ===
1. Title: Write a compelling, concise title suitable for program listings and marketing (e.g. "12-Week Hypertrophy & Strength Builder"). Do not use internal jargon.
2. Description: Write a clear description (2-4 paragraphs) that:
   - Summarizes the program and who it's for.
   - Breaks down each phase by name and week range.
   - Explains what the user can expect to accomplish in each phase.
   - Uses engaging, accessible language for end users.

=== OUTPUT FORMAT ===
Return ONLY valid JSON. No markdown, no explanations. Start with { and end with }.
{
  "title": "Your program title here",
  "description": "First paragraph...\\n\\nSecond paragraph..."
}`;
}

export interface PublicCopyOutput {
  title: string;
  description: string;
}

/**
 * Validate AI response has required title and description (non-empty strings).
 */
export function validatePublicCopyOutput(data: unknown): { valid: true; data: PublicCopyOutput } | { valid: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Response is not an object' };
  }
  const obj = data as Record<string, unknown>;
  const title = obj.title;
  const description = obj.description;
  if (typeof title !== 'string' || !title.trim()) {
    return { valid: false, error: 'Missing or invalid title' };
  }
  if (typeof description !== 'string' || !description.trim()) {
    return { valid: false, error: 'Missing or invalid description' };
  }
  return { valid: true, data: { title: title.trim(), description: description.trim() } };
}
