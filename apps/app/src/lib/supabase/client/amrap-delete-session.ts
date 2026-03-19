/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Delete AMRAP With Friends session by host (same as SessionEventModal in AMRAP app).
 * Uses delete_session RPC with host_token from sessionStorage.
 */

import { supabase } from '../supabase-instance';
import { getStoredHostToken } from '@/lib/amrap-host-token';

/**
 * Delete an AMRAP session. Requires host_token in sessionStorage.
 *
 * @returns true if a row was deleted, false otherwise
 */
export async function deleteAmrapSessionByHost(sessionId: string): Promise<boolean> {
  const token = getStoredHostToken(sessionId);
  if (!token) {
    throw new Error(
      'Cannot delete from this device. Open the session where you created it to delete.'
    );
  }

  const { data, error } = await supabase.rpc('delete_session', {
    p_session_id: sessionId,
    p_host_token: token,
  });

  if (error) throw error;
  return (data as number) === 1;
}
