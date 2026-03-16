/**
 * Create AMRAP With Friends session from the app (HUD Do Again / Schedule).
 * Calls public.create_session RPC; stores host token and participant id so redirect to AMRAP works.
 */

import { supabase } from '../supabase-instance';

const SESSION_STORAGE_KEYS = {
  hostToken: 'amrap_friends_host_token',
  participantId: 'amrap_friends_participant_id',
} as const;

function setStoredHostToken(sessionId: string, token: string): void {
  try {
    sessionStorage.setItem(`${SESSION_STORAGE_KEYS.hostToken}_${sessionId}`, token);
  } catch {
    /* sessionStorage unavailable */
  }
}

function setStoredParticipantId(sessionId: string, participantId: string): void {
  try {
    sessionStorage.setItem(`${SESSION_STORAGE_KEYS.participantId}_${sessionId}`, participantId);
  } catch {
    /* sessionStorage unavailable */
  }
}

export interface CreateAmrapSessionParams {
  duration_minutes: number;
  workout_list: string[];
  host_nickname?: string;
  scheduled_start_at?: string | null;
}

export interface CreateAmrapSessionResult {
  session_id: string;
  host_token: string;
  participant_id: string;
}

/**
 * Create an AMRAP session. Requires authenticated user (auth.uid() used by RPC).
 * Stores host token and participant id in sessionStorage so that redirecting to
 * /amrap/with-friends/session/{session_id} restores host state.
 */
export async function createAmrapSession(
  params: CreateAmrapSessionParams
): Promise<CreateAmrapSessionResult> {
  const { data, error } = await supabase.rpc('create_session', {
    p_duration_minutes: params.duration_minutes,
    p_workout_list: params.workout_list,
    p_host_nickname: params.host_nickname ?? 'Host',
    p_scheduled_start_at: params.scheduled_start_at ?? null,
    p_user_id: null, // RPC uses auth.uid() only
  });

  if (error) throw error;

  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const sessionId = typeof raw.session_id === 'string' ? raw.session_id.trim() : '';
  const hostToken = typeof raw.host_token === 'string' ? raw.host_token.trim() : '';
  const participantId = typeof raw.participant_id === 'string' ? raw.participant_id.trim() : '';

  if (!sessionId || !hostToken || !participantId) {
    throw new Error('Invalid create_session response');
  }

  setStoredHostToken(sessionId, hostToken);
  setStoredParticipantId(sessionId, participantId);

  return { session_id: sessionId, host_token: hostToken, participant_id: participantId };
}
