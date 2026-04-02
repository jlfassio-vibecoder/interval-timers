/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Resolve trainer profile from the user's first active program.
 * Chain: user_programs (active) → programs.trainer_id → get_trainer_profile_for_client RPC.
 */

import { supabase } from '../supabase-instance';

export interface TrainerProfile {
  uid: string;
  displayName: string;
  avatarUrl?: string;
}

/**
 * Get the trainer profile for the user's active program.
 * When activeProgramId is provided, uses that program; otherwise uses first active enrollment.
 * Returns null if the user has no active program or any query fails.
 */
export async function getTrainerForUser(
  userId: string,
  activeProgramId?: string | null
): Promise<TrainerProfile | null> {
  try {
    let programId: string | null = null;

    if (activeProgramId) {
      const { data: enrollment } = await supabase
        .from('user_programs')
        .select('program_id')
        .eq('user_id', userId)
        .eq('program_id', activeProgramId)
        .eq('status', 'active')
        .maybeSingle();
      programId = enrollment?.program_id ?? null;
    }

    if (!programId) {
      const { data: enrollment, error: enrollError } = await supabase
        .from('user_programs')
        .select('program_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (enrollError || !enrollment?.program_id) return null;
      programId = enrollment.program_id;
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'get_trainer_profile_for_client',
      {
        p_program_id: programId,
      }
    );

    if (rpcError || rpcData == null || typeof rpcData !== 'object' || Array.isArray(rpcData)) {
      return null;
    }

    const o = rpcData as Record<string, unknown>;
    const trainerUid = o.trainer_user_id;
    const displayName = o.display_name;
    if (typeof trainerUid !== 'string' || typeof displayName !== 'string') {
      return null;
    }

    const avatarRaw = o.avatar_url;
    const avatarUrl =
      typeof avatarRaw === 'string' && avatarRaw.trim() ? avatarRaw.trim() : undefined;

    return {
      uid: trainerUid,
      displayName: displayName.trim() || 'Coach',
      avatarUrl,
    };
  } catch {
    return null;
  }
}
