/**
 * AMRAP With Friends session results for HUD HistoryZone.
 * Reads from shared.amrap_session_results.
 */

import { supabase } from '../supabase-instance';

export interface AmrapSessionResult {
  id: string;
  session_id: string;
  total_rounds: number;
  workout_list: string[];
  duration_minutes: number;
  completed_at: string;
}

/**
 * Get AMRAP session results for the user, ordered by completed_at desc.
 */
export async function getAmrapSessionResults(
  userId: string,
  limit: number = 10
): Promise<AmrapSessionResult[]> {
  const { data, error } = await supabase
    .schema('shared')
    .from('amrap_session_results')
    .select('id, session_id, total_rounds, workout_list, duration_minutes, completed_at')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (import.meta.env.DEV) console.error('[getAmrapSessionResults]', error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    session_id: row.session_id,
    total_rounds: row.total_rounds ?? 0,
    workout_list: (row.workout_list ?? []) as string[],
    duration_minutes: row.duration_minutes ?? 0,
    completed_at: row.completed_at as string,
  }));
}
