/**
 * Client call to POST /api/ai/generate-workout-chain (Mission Control + admin).
 */

import type { WorkoutChainMetadata, WorkoutSetTemplate } from '@/types/ai-workout';
import { missionControlApiAuthHeaders } from '@/lib/mission-control-api-auth';

export interface GenerateWorkoutChainResponse {
  workoutSet: WorkoutSetTemplate;
  chain_metadata: WorkoutChainMetadata;
}

export async function postGenerateWorkoutChain(
  body: Record<string, unknown>
): Promise<GenerateWorkoutChainResponse> {
  const auth = await missionControlApiAuthHeaders();
  const res = await fetch('/api/ai/generate-workout-chain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || res.statusText || 'Failed to generate workout');
  }
  return res.json() as Promise<GenerateWorkoutChainResponse>;
}

export const WORKOUT_FACTORY_CHAIN_MESSAGES = [
  'Step 1/4: Designing workout structure...',
  'Step 2/4: Mapping movement patterns...',
  'Step 3/4: Selecting exercises...',
  'Step 4/4: Writing prescriptions...',
] as const;
