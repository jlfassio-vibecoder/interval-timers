/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Suggested schedule time from past completions (Phase 5.2).
 */

import { getAmrapSessionResults } from './amrap-session-results';
import { supabase } from '../supabase-instance';

export type SchedulableWorkoutType = 'amrap' | 'tabata' | 'daily-warmup';

const MIN_SAMPLES = 2;
const LIMIT = 50;

/**
 * Format hour (0-23) and minute (0-59) as "7:00 AM" or "6:30 PM".
 */
export function formatSuggestedTime(hour: number, minute: number): string {
  const h = hour % 12 || 12;
  const m = String(minute).padStart(2, '0');
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h}:${m} ${ampm}`;
}

function getHourFromIso(iso: string): number {
  return new Date(iso).getHours();
}

function modeHour(hours: number[]): number | null {
  if (hours.length < MIN_SAMPLES) return null;
  const counts = new Map<number, number>();
  for (const h of hours) {
    counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  let bestHour = -1;
  let bestCount = 0;
  for (const [h, c] of counts) {
    if (c > bestCount || (c === bestCount && (bestHour < 0 || h < bestHour))) {
      bestCount = c;
      bestHour = h;
    }
  }
  return bestHour >= 0 ? bestHour : null;
}

/**
 * Returns the most common local hour (and minute 0) from past completions for the given workout type.
 * Returns null if fewer than MIN_SAMPLES completions.
 */
export async function getSuggestedTimeForWorkoutType(
  userId: string,
  workoutType: SchedulableWorkoutType
): Promise<{ hour: number; minute: number } | null> {
  if (workoutType === 'amrap') {
    const results = await getAmrapSessionResults(userId, LIMIT);
    const hours = results.map((r) => getHourFromIso(r.completed_at));
    const hour = modeHour(hours);
    if (hour == null) return null;
    return { hour, minute: 0 };
  }

  const { data, error } = await supabase
    .from('workout_logs')
    .select('created_at')
    .eq('user_id', userId)
    .eq('source', workoutType)
    .not('created_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(LIMIT);

  if (error) {
    if (import.meta.env.DEV) console.error('[getSuggestedTimeForWorkoutType]', error);
    return null;
  }

  const rows = data ?? [];
  const hours = rows.map((r) => getHourFromIso(r.created_at as string));
  const hour = modeHour(hours);
  if (hour == null) return null;
  return { hour, minute: 0 };
}
