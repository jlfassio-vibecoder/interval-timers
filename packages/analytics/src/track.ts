/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Funnel event tracking for activation analytics.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getOrCreateSessionId } from './session';

/** Allowed event names for funnel tracking (validated client-side to reduce noise) */
export const FUNNEL_EVENTS = [
  'timer_session_complete',
  'timer_save_click',
  'timer_view_stats_click',
  'account_land_handoff',
  'account_signup_start',
  'account_signup_complete',
  'account_login_complete',
  'account_session_prefill_success',
  'account_session_prefill_fail',
  'hub_timer_launch_1',
  'hub_timer_launch_2',
] as const;

export type FunnelEventName = (typeof FUNNEL_EVENTS)[number];

function isAllowedEvent(name: string): name is FunnelEventName {
  return (FUNNEL_EVENTS as readonly string[]).includes(name);
}

export interface TrackEventOptions {
  /** Override user_id (e.g. from context); otherwise fetched from Supabase session */
  userId?: string | null;
  /** App/source ID: tabata, amrap, daily-warmup, landing, app, etc. */
  appId?: string;
}

/**
 * Track a funnel event. Inserts into analytics_events via Supabase.
 * Fire-and-forget; errors are logged in dev only.
 */
export async function trackEvent(
  supabase: SupabaseClient,
  eventName: string,
  properties?: Record<string, unknown>,
  options?: TrackEventOptions
): Promise<void> {
  if (!isAllowedEvent(eventName)) {
    if (import.meta.env?.DEV) {
      console.warn('[analytics] Unknown event name:', eventName);
    }
    return;
  }

  let userId: string | null;
  if (options?.userId !== undefined) {
    userId = options.userId;
  } else {
    try {
      const { data } = await supabase.auth.getSession();
      userId = data.session?.user?.id ?? null;
    } catch {
      userId = null;
    }
  }

  const sessionId = userId ? null : getOrCreateSessionId();
  const row = {
    event_name: eventName,
    user_id: userId || null,
    session_id: sessionId || null,
    properties: properties ?? {},
    app_id: options?.appId ?? null,
  };

  const { error } = await supabase.from('analytics_events').insert(row);
  if (error && import.meta.env?.DEV) {
    console.warn('[analytics] trackEvent failed:', error);
  }
}
