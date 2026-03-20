/**
 * Call app API to parse pasted text into WorkoutSetTemplate (AI, not heuristic).
 */

import type { WorkoutSetTemplate } from '@/types/workoutSetTemplate';

const API_ORIGIN = import.meta.env.VITE_APP_ORIGIN || '';

export async function parsePastedWorkoutViaApi(
  rawText: string,
  signal?: AbortSignal
): Promise<WorkoutSetTemplate> {
  const url = `${API_ORIGIN}/api/ai/parse-pasted-workout`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawText: rawText.trim() }),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : res.statusText || 'Parse failed');
  }
  if (!data.workoutSet) {
    throw new Error('Invalid response: missing workoutSet');
  }
  return data.workoutSet as WorkoutSetTemplate;
}
