/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Reschedule AMRAP With Friends session from calendar drag-and-drop.
 * Uses reschedule_session RPC with host_token from sessionStorage.
 */

import { supabase } from '../supabase-instance';

const SESSION_STORAGE_KEYS = {
  hostToken: 'amrap_friends_host_token',
} as const;

/**
 * Reschedule an AMRAP session to a new date/time.
 * Requires host_token in sessionStorage (set when user creates session via createAmrapSession).
 *
 * @throws Error if host_token is missing (e.g. cleared storage, different device)
 */
export async function rescheduleAmrapSession(
  sessionId: string,
  newScheduledAt: string
): Promise<void> {
  const key = `${SESSION_STORAGE_KEYS.hostToken}_${sessionId}`;
  const token = typeof window !== 'undefined' ? sessionStorage.getItem(key) : null;
  if (!token) {
    throw new Error(
      'Cannot reschedule from this device. Open the session where you created it to reschedule.'
    );
  }

  const { error } = await supabase.rpc('reschedule_session', {
    p_session_id: sessionId,
    p_host_token: token,
    p_scheduled_start_at: newScheduledAt,
  });

  if (error) throw error;
}
