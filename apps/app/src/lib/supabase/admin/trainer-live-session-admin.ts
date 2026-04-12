/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Mission Control server mutations for `trainer_live_sessions` (unified calendar / admin).
 */

import { getSupabaseServer } from '@/lib/supabase/server';

const ALLOWED_SHELLS = new Set(['video_only', 'countdown_timer']);

export type PatchTrainerLiveSessionInput = {
  /** End the session for everyone (sets `ended_at`, `status` = ended). */
  endSession?: boolean;
  /** Optional explicit end instant when ending (defaults to now). */
  endedAt?: string | null;
  /** Change layout shell while session is active. */
  shell?: 'video_only' | 'countdown_timer';
};

export async function patchTrainerLiveSessionForOwner(
  viewerId: string,
  sessionId: string,
  patch: PatchTrainerLiveSessionInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseServer();
  const { data: row, error: selErr } = await supabase
    .from('trainer_live_sessions')
    .select('id, trainer_user_id, status, shell')
    .eq('id', sessionId)
    .maybeSingle();

  if (selErr || !row || (row.trainer_user_id as string) !== viewerId) {
    return { ok: false, error: 'Session not found' };
  }

  const status = row.status as string;

  if (patch.endSession === true) {
    if (status !== 'active') {
      return { ok: false, error: 'Session is not active' };
    }
    const ended =
      typeof patch.endedAt === 'string' && patch.endedAt.trim()
        ? patch.endedAt.trim()
        : new Date().toISOString();
    const { error: upErr } = await supabase
      .from('trainer_live_sessions')
      .update({ status: 'ended', ended_at: ended })
      .eq('id', sessionId);
    if (upErr) {
      return { ok: false, error: upErr.message ?? 'Failed to end session' };
    }
    return { ok: true };
  }

  if (patch.shell !== undefined) {
    if (status !== 'active') {
      return { ok: false, error: 'Can only change shell on active sessions' };
    }
    const sh = patch.shell;
    if (!ALLOWED_SHELLS.has(sh)) {
      return { ok: false, error: 'Invalid shell' };
    }
    const { error: upErr } = await supabase
      .from('trainer_live_sessions')
      .update({ shell: sh })
      .eq('id', sessionId);
    if (upErr) {
      return { ok: false, error: upErr.message ?? 'Failed to update shell' };
    }
    return { ok: true };
  }

  return { ok: false, error: 'No supported fields to update' };
}
