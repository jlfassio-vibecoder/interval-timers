/**
 * Shared validation for program schedule. Used by generate-program API and ProgramBlueprintEditor.
 */

import type { ProgramSchedule } from '@/types/ai-program';

export type WorkoutDescriptionsResult = { valid: true } | { valid: false; error: string };

export function validateWorkoutDescriptions(
  schedule: ProgramSchedule[]
): WorkoutDescriptionsResult {
  if (!Array.isArray(schedule)) {
    return { valid: false, error: 'Schedule must be an array' };
  }
  for (let wi = 0; wi < schedule.length; wi++) {
    const week = schedule[wi];
    if (typeof week !== 'object' || week === null || !Array.isArray(week.workouts)) {
      return {
        valid: false,
        error: `Week ${wi + 1} must be an object with a workouts array`,
      };
    }
    for (let wj = 0; wj < week.workouts.length; wj++) {
      const w = week.workouts[wj];
      const desc = w?.description;
      if (desc == null || String(desc).trim().length === 0) {
        const title = w?.title ?? wj + 1;
        const weekNum = typeof week.weekNumber === 'number' ? week.weekNumber : wi + 1;
        return {
          valid: false,
          error: `Week ${weekNum}, Workout "${title}": Workout description is required.`,
        };
      }
    }
  }
  return { valid: true };
}
