/**
 * AMRAP With Friends session results for HUD HistoryZone.
 * Uses public.get_amrap_session_results(p_limit) RPC so we do not need to expose
 * the shared schema to PostgREST; the RPC reads shared.amrap_session_results with auth.uid().
 */

import { supabase } from '../supabase-instance';

export interface AmrapSessionResult {
  id: string;
  session_id: string;
  total_rounds: number;
  workout_list: string[];
  duration_minutes: number;
  completed_at: string;
  /** Seconds per round; for consistency chart and analytics */
  round_durations: number[];
  /** Display name (first exercise or library match) */
  workout_name: string | null;
}

/**
 * Get AMRAP session results for the current user, ordered by completed_at desc.
 * Calls public.get_amrap_session_results RPC (uses auth.uid() server-side).
 */
export async function getAmrapSessionResults(
  _userId: string, // Kept for API consistency; RPC uses auth.uid() server-side only
  limit: number = 10
): Promise<AmrapSessionResult[]> {
  const { data, error } = await supabase.rpc('get_amrap_session_results', {
    p_limit: Math.max(1, Math.min(limit, 100)),
  });

  if (error) {
    if (import.meta.env.DEV)
      console.error('[getAmrapSessionResults]', error.message, error.details);
    return [];
  }

  const rows = (data ?? []) as Array<{
    id: string;
    session_id: string;
    total_rounds: number;
    workout_list: unknown;
    duration_minutes: number;
    completed_at: string;
    round_durations: number[];
    workout_name: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    session_id: row.session_id,
    total_rounds: row.total_rounds ?? 0,
    workout_list: (row.workout_list ?? []) as string[],
    duration_minutes: row.duration_minutes ?? 0,
    completed_at: row.completed_at as string,
    round_durations: (row.round_durations ?? []) as number[],
    workout_name: (row.workout_name as string | null) ?? null,
  }));
}

/**
 * Get AMRAP session results for analytics (progress charts). Uses a higher limit;
 * filter by date range client-side if needed.
 */
export async function getAmrapSessionResultsForAnalytics(
  userId: string,
  limit: number = 100
): Promise<AmrapSessionResult[]> {
  return getAmrapSessionResults(userId, limit);
}
