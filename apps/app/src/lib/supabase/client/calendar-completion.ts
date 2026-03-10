/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Calendar completion: map user_workout_logs to date → completed workout keys for Schedule Zone.
 */

import { supabase } from '../client';

/**
 * Returns Map<date (ISO YYYY-MM-DD), Set<programId:weekId:workoutId>> for completed workouts
 * in the given range. Used to enrich calendar events with status.
 */
export async function getLoggedDatesForCalendar(
  userId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<Map<string, Set<string>>> {
  const { data, error } = await supabase
    .from('user_workout_logs')
    .select('date, program_id, week_id, workout_id')
    .eq('user_id', userId)
    .gte('date', rangeStart)
    .lte('date', rangeEnd);

  if (error) return new Map();

  const map = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const date = row.date as string;
    const key = `${row.program_id}:${row.week_id}:${row.workout_id}`;
    let set = map.get(date);
    if (!set) {
      set = new Set<string>();
      map.set(date, set);
    }
    set.add(key);
  }
  return map;
}
