/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cancel AMRAP With Friends session from calendar (Phase 5.7 multi-select clear).
 * Uses cancel_amrap_session_for_creator RPC; only creator can cancel.
 */

import { supabase } from '../supabase-instance';

/**
 * Cancel an AMRAP session. Only the creator (created_by_user_id = auth.uid()) can cancel.
 * Does not require host_token; works from HUD calendar regardless of device.
 *
 * @returns true if a row was deleted, false if not found or not creator
 */
export async function cancelAmrapSessionForCreator(sessionId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('cancel_amrap_session_for_creator', {
    p_session_id: sessionId,
  });

  if (error) throw error;
  return (data as number) === 1;
}
