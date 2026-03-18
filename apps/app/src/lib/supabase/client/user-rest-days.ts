/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Rest-day markers for calendar (Phase 5.6). user_id + date only.
 */

import { supabase } from '../supabase-instance';

/**
 * Fetch all rest days for the user in the given date range.
 * Returns a Set of ISO date strings (YYYY-MM-DD).
 */
export async function getRestDaysForRange(
  userId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('user_rest_days')
    .select('date')
    .eq('user_id', userId)
    .gte('date', rangeStart)
    .lte('date', rangeEnd);

  if (error) {
    if (import.meta.env.DEV && error.code !== 'PGRST205')
      console.error('[getRestDaysForRange]', error);
    return new Set();
  }

  const set = new Set<string>();
  for (const row of data ?? []) {
    const d = row.date;
    if (typeof d === 'string') set.add(d.slice(0, 10));
  }
  return set;
}

function isTableMissingError(error: { code?: string }): boolean {
  return error?.code === 'PGRST205';
}

/**
 * Mark a day as rest. Idempotent (upsert with ignoreDuplicates so duplicate key does not throw).
 */
export async function addRestDay(userId: string, date: string): Promise<void> {
  const dateOnly = date.slice(0, 10);
  const { error } = await supabase
    .from('user_rest_days')
    .upsert(
      { user_id: userId, date: dateOnly },
      { onConflict: 'user_id,date', ignoreDuplicates: true }
    );
  if (error) {
    if (isTableMissingError(error)) {
      throw new Error(
        'Rest days table is missing. Run supabase/scripts/apply-calendar-tables.sql in Supabase Dashboard → SQL Editor.'
      );
    }
    throw error;
  }
}

/**
 * Remove rest-day marker for the given date.
 */
export async function removeRestDay(userId: string, date: string): Promise<void> {
  const dateOnly = date.slice(0, 10);
  const { error } = await supabase
    .from('user_rest_days')
    .delete()
    .eq('user_id', userId)
    .eq('date', dateOnly);
  if (error) {
    if (isTableMissingError(error)) {
      throw new Error(
        'Rest days table is missing. Run supabase/scripts/apply-calendar-tables.sql in Supabase Dashboard → SQL Editor.'
      );
    }
    throw error;
  }
}
