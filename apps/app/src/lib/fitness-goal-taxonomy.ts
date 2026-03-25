/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Canonical fitness goal ids for profiles (`fitness_goal_ranking` text[]).
 * Aligns with Training Log / alignment spec (snake_case ids).
 */

export const FITNESS_GOAL_IDS = [
  'fat_loss',
  'cardiovascular_endurance',
  'muscle_hypertrophy',
  'longevity',
  'athletic_performance',
  'functional_strength',
  'mobility_flexibility',
  'stress_management',
  'weight_maintenance',
  'power_speed',
] as const;

export type FitnessGoalId = (typeof FITNESS_GOAL_IDS)[number];

export const FITNESS_GOAL_BADGES: { id: FitnessGoalId; label: string }[] = [
  { id: 'fat_loss', label: 'Fat loss' },
  { id: 'cardiovascular_endurance', label: 'Cardiovascular endurance' },
  { id: 'muscle_hypertrophy', label: 'Muscle hypertrophy' },
  { id: 'longevity', label: 'Longevity' },
  { id: 'athletic_performance', label: 'Athletic performance' },
  { id: 'functional_strength', label: 'Functional strength' },
  { id: 'mobility_flexibility', label: 'Mobility & flexibility' },
  { id: 'stress_management', label: 'Stress management' },
  { id: 'weight_maintenance', label: 'Weight maintenance' },
  { id: 'power_speed', label: 'Power & speed' },
];

export function isFitnessGoalId(s: string): s is FitnessGoalId {
  return (FITNESS_GOAL_IDS as readonly string[]).includes(s);
}

export function labelForFitnessGoalId(id: string): string {
  const found = FITNESS_GOAL_BADGES.find((b) => b.id === id);
  return found?.label ?? id.replace(/_/g, ' ');
}

/** Allowlist + dedupe (first occurrence wins) + cap at 3. */
export function normalizeFitnessGoalRanking(input: string[]): FitnessGoalId[] {
  const out: FitnessGoalId[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!isFitnessGoalId(raw) || seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
    if (out.length >= 3) break;
  }
  return out;
}

export function toggleFitnessGoalRanking(
  current: string[],
  id: FitnessGoalId
): { next: FitnessGoalId[]; rejectedMax?: boolean } {
  const normalized = normalizeFitnessGoalRanking(current);
  const idx = normalized.indexOf(id);
  if (idx >= 0) {
    return { next: normalized.filter((_, i) => i !== idx) };
  }
  if (normalized.length >= 3) {
    return { next: normalized, rejectedMax: true };
  }
  return { next: [...normalized, id] };
}
