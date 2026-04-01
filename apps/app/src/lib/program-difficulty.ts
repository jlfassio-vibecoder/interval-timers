/**
 * Normalizes program difficulty for DB rows and public metadata.
 * DB and ProgramMetadata only allow beginner | intermediate | advanced;
 * persona / AI may use "any" or other strings.
 */

import type { UserDemographics } from '@/types/ai-program';

export type ProgramDifficulty = 'beginner' | 'intermediate' | 'advanced';

export function isProgramDifficulty(value: string | null | undefined): value is ProgramDifficulty {
  return value === 'beginner' || value === 'intermediate' || value === 'advanced';
}

export function normalizeProgramDifficulty(value: string | null | undefined): ProgramDifficulty {
  return isProgramDifficulty(value) ? value : 'intermediate';
}

/**
 * Prefer stored column; if invalid, fall back to target audience experience level; default intermediate.
 */
export function difficultyFromPersonaFields(
  storedDifficulty: string | null | undefined,
  experienceLevel: UserDemographics['experienceLevel'] | undefined
): ProgramDifficulty {
  if (isProgramDifficulty(storedDifficulty)) return storedDifficulty;
  if (isProgramDifficulty(experienceLevel)) return experienceLevel;
  return 'intermediate';
}
