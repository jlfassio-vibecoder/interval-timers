/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * User preference for same-day event display order (Phase 5.9).
 */

import { supabase } from '../supabase-instance';
import { DEFAULT_EVENT_TYPE_ORDER } from '@/lib/calendar-event-order';
import type { CalendarEventType } from '@/lib/calendar-events';

const VALID_TYPES: CalendarEventType[] = [
  'program',
  'amrap',
  'amrap_scheduled',
  'timer',
  'timer_scheduled',
  'readiness',
];

function parseTypeOrder(raw: unknown): CalendarEventType[] {
  if (!Array.isArray(raw)) return DEFAULT_EVENT_TYPE_ORDER;
  const filtered = raw.filter(
    (t): t is CalendarEventType =>
      typeof t === 'string' && VALID_TYPES.includes(t as CalendarEventType)
  );
  if (filtered.length === 0) return DEFAULT_EVENT_TYPE_ORDER;
  const seen = new Set<CalendarEventType>();
  const result: CalendarEventType[] = [];
  for (const t of filtered) {
    if (!seen.has(t)) {
      seen.add(t);
      result.push(t);
    }
  }
  for (const t of DEFAULT_EVENT_TYPE_ORDER) {
    if (!seen.has(t)) result.push(t);
  }
  return result;
}

/**
 * Fetch event type order for the user. Returns default order if no row exists.
 */
export async function getEventOrderPreference(userId: string): Promise<CalendarEventType[]> {
  const { data, error } = await supabase
    .from('user_event_order_preference')
    .select('type_order')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (import.meta.env.DEV && error.code !== 'PGRST205')
      console.error('[getEventOrderPreference]', error);
    return DEFAULT_EVENT_TYPE_ORDER;
  }

  return data?.type_order != null ? parseTypeOrder(data.type_order) : DEFAULT_EVENT_TYPE_ORDER;
}

/**
 * Save event type order for the user. Upserts a single row.
 */
export async function setEventOrderPreference(
  userId: string,
  typeOrder: CalendarEventType[]
): Promise<void> {
  const { error } = await supabase
    .from('user_event_order_preference')
    .upsert({ user_id: userId, type_order: typeOrder }, { onConflict: 'user_id' });

  if (error) {
    if (import.meta.env.DEV && error.code !== 'PGRST205')
      console.error('[setEventOrderPreference]', error);
    throw error;
  }
}
