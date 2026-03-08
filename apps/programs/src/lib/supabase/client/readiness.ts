/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Readiness check-in (1-5) for Zone 3. Stored in workout_logs with workout_name='Readiness'.
 */

import { supabase } from '../client';

const READINESS_WORKOUT_NAME = 'Readiness';

/**
 * Save or update readiness score for a date. Uses workout_logs with effort=1, rating=1.
 * Uses .limit(1) so multiple rows for same user/date don't cause maybeSingle() error and an extra insert.
 * A uniqueness constraint on (user_id, date, workout_name) would allow proper upsert.
 */
export async function saveReadiness(userId: string, date: string, score: number): Promise<void> {
  if (score < 1 || score > 5) throw new Error('Readiness score must be 1-5');

  const { data: rows, error } = await supabase
    .from('workout_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('date', date)
    .eq('workout_name', READINESS_WORKOUT_NAME)
    .limit(1);

  if (error) throw error;
  const existing = rows?.[0];

  if (existing?.id) {
    const { error } = await supabase
      .from('workout_logs')
      .update({ readiness_score: score })
      .eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const { error: insertError } = await supabase.from('workout_logs').insert({
    user_id: userId,
    workout_id: null,
    workout_name: READINESS_WORKOUT_NAME,
    date,
    effort: 1,
    rating: 1,
    readiness_score: score,
  });
  if (insertError) throw insertError;
}

/**
 * Get readiness score for a date, or null if not set.
 */
export async function getReadiness(userId: string, date: string): Promise<number | null> {
  const { data: rows, error } = await supabase
    .from('workout_logs')
    .select('readiness_score')
    .eq('user_id', userId)
    .eq('date', date)
    .eq('workout_name', READINESS_WORKOUT_NAME)
    .limit(1);

  if (error || !rows?.[0]?.readiness_score) return null;
  const s = rows[0].readiness_score as number;
  return s >= 1 && s <= 5 ? s : null;
}
