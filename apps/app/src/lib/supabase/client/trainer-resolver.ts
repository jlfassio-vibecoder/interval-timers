/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Resolve trainer profile from the user's first active program.
 * Chain: user_programs (active) → programs.trainer_id → profiles.
 */

import { supabase } from '../supabase-instance';

export interface TrainerProfile {
  uid: string;
  displayName: string;
  avatarUrl?: string;
}

function resolveTrainerDisplayName(row: {
  full_name: string | null;
  username: string | null;
  email: string | null;
}): string {
  const n = row.full_name?.trim();
  if (n) return n;
  const u = row.username?.trim();
  if (u) return u;
  const e = row.email?.trim();
  if (e) {
    const local = e.split('@')[0]?.trim() ?? '';
    if (local) {
      const t = local
        .replace(/[._-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (t) return t;
    }
  }
  return 'Coach';
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

    const { data: program, error: programError } = await supabase
      .from('programs')
      .select('trainer_id')
      .eq('id', programId)
      .single();

    if (programError || !program?.trainer_id) return null;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, username, email, avatar_url')
      .eq('id', program.trainer_id)
      .single();

    if (profileError || !profile) return null;

    return {
      uid: program.trainer_id,
      displayName: resolveTrainerDisplayName({
        full_name: profile.full_name ?? null,
        username: profile.username ?? null,
        email: profile.email ?? null,
      }),
      avatarUrl: profile.avatar_url ?? undefined,
    };
  } catch {
    return null;
  }
}
