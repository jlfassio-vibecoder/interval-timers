/**
 * Derives Workout Factory metabolic mode from `public.workouts.ai_chain_metadata`
 * (embedded `workoutConfig` from save). Used for Trainer Live pickers and Client Workouts filters.
 */

import type { WorkoutConfig } from '@/types/ai-workout';

export type FactoryMetabolicMode = 'amrap_density' | 'tabata_balanced' | 'hiit' | 'emom_factory';

/** Narrow JSON API values to the known union (GET /api/trainer/workouts, client-overview). */
export function parseFactoryMetabolicModeFromApi(value: unknown): FactoryMetabolicMode | null {
  if (
    value === 'amrap_density' ||
    value === 'tabata_balanced' ||
    value === 'hiit' ||
    value === 'emom_factory'
  )
    return value;
  return null;
}

/**
 * Reads `workoutConfig` from stored chain metadata JSON.
 * Precedence matches Factory UI mutual exclusivity: Tabata > Density AMRAP > EMOM > HIIT.
 */
export function getFactoryMetabolicModeFromAiChainMetadata(
  aiChainMetadata: unknown
): FactoryMetabolicMode | null {
  if (!aiChainMetadata || typeof aiChainMetadata !== 'object') return null;
  const wc = (aiChainMetadata as { workoutConfig?: unknown }).workoutConfig;
  if (!wc || typeof wc !== 'object') return null;
  const c = wc as WorkoutConfig;
  if (c.tabataBalancedMode === true) return 'tabata_balanced';
  if (c.amrapDensityMode === true) return 'amrap_density';
  if (c.emomMode === true) return 'emom_factory';
  if (c.hiitMode === true) return 'hiit';
  return null;
}
