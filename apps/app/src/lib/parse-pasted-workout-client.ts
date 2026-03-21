/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Client helper to parse pasted text into WorkoutSetTemplate via app API.
 */

import type { WorkoutSetTemplate } from '@/types/ai-workout';

export async function parsePastedWorkoutViaApi(
  rawText: string,
  signal?: AbortSignal
): Promise<WorkoutSetTemplate> {
  const res = await fetch('/api/ai/parse-pasted-workout', {
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
