/**
 * GET /api/agora/token?sessionId=:uuid&participantId=:uuid
 *
 * **Trainer Live only:** `sessionId` must be `trainer_live_sessions.id`;
 * `participantId` must be `trainer_live_participants.id`. Verifies
 * `trainer_live_verify_token_targets` and that the signed-in user is the session
 * trainer or the participant row’s `user_id`.
 *
 * The legacy path that used `client_coach_schedule_instances.id` as the channel
 * without `participantId` has been removed — all RTC tokens use the trainer live
 * session namespace.
 *
 * Secrets: AGORA_APP_ID + AGORA_APP_CERTIFICATE on the server only (never PUBLIC_*).
 */

import type { APIRoute } from 'astro';
import type { SupabaseClient } from '@supabase/supabase-js';
import agoraToken from 'agora-token';
import type { Database } from '@/types/supabase';
import { authenticateInvitationsApiRequest } from '@/lib/supabase/admin/auth';
import { getSupabaseServer } from '@/lib/supabase/server';

export const prerender = false;

const { RtcTokenBuilder, RtcRole } = agoraToken as {
  RtcTokenBuilder: typeof import('agora-token').RtcTokenBuilder;
  RtcRole: typeof import('agora-token').RtcRole;
};

/** Seconds from now for token + privilege expiry (2 hours). */
const TOKEN_TTL_SEC = 7200;

function isValidUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function readAgoraAppId(): string {
  return (process.env.AGORA_APP_ID || process.env.VITE_AGORA_APP_ID || '').trim();
}

function readAgoraCertificate(): string {
  return (process.env.AGORA_APP_CERTIFICATE || process.env.VITE_AGORA_APP_CERTIFICATE || '').trim();
}

async function authorizeTrainerLiveToken(
  userSupabase: SupabaseClient<Database>,
  liveSessionId: string,
  participantId: string,
  authUserId: string
): Promise<boolean> {
  const { data: verifiedRaw, error: verifyErr } = await userSupabase.rpc(
    'trainer_live_verify_token_targets' as never,
    {
      p_session_id: liveSessionId,
      p_participant_id: participantId,
    } as never
  );
  if (verifyErr) return false;
  if (verifiedRaw !== true) return false;

  const server = getSupabaseServer();
  const { data: part } = await server
    .from('trainer_live_participants')
    .select('user_id')
    .eq('id', participantId)
    .eq('session_id', liveSessionId)
    .maybeSingle();
  const { data: sess } = await server
    .from('trainer_live_sessions')
    .select('trainer_user_id')
    .eq('id', liveSessionId)
    .maybeSingle();
  if (!part || !sess) return false;
  const trainerUid = sess.trainer_user_id as string;
  const partUserId = part.user_id as string | null;
  if (trainerUid === authUserId) return true;
  if (partUserId != null && partUserId === authUserId) return true;
  return false;
}

/** True if `id` is a coach schedule instance row (not a valid trainer live channel id). */
async function isScheduleInstanceId(id: string): Promise<boolean> {
  const server = getSupabaseServer();
  const { data } = await server
    .from('client_coach_schedule_instances')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  return data != null;
}

export const GET: APIRoute = async ({ request, cookies }) => {
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  const auth = await authenticateInvitationsApiRequest(request, cookies);
  if (!auth.ok) return auth.response;

  const { supabase: userSupabase, user } = auth;
  const uid = user.id;

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId')?.trim() ?? '';
  if (!sessionId) {
    return json({ error: 'sessionId query parameter required' }, 400);
  }
  if (!isValidUuid(sessionId)) {
    return json({ error: 'sessionId must be a valid UUID' }, 400);
  }

  const participantId = searchParams.get('participantId')?.trim() ?? '';
  if (!participantId) {
    return json(
      {
        error:
          'participantId is required. Agora tokens are only issued for trainer live sessions; pass trainer_live_participants.id alongside trainer_live_sessions.id as sessionId.',
      },
      400
    );
  }
  if (!isValidUuid(participantId)) {
    return json({ error: 'participantId must be a valid UUID' }, 400);
  }

  if (await isScheduleInstanceId(sessionId)) {
    return json(
      {
        error:
          'sessionId must be trainer_live_sessions.id, not client_coach_schedule_instances.id. Link the calendar row to a live session and use that UUID.',
      },
      400
    );
  }

  const APP_ID = readAgoraAppId();
  const APP_CERT = readAgoraCertificate();
  if (!APP_ID || !APP_CERT) {
    return json(
      {
        error:
          'Server misconfiguration: set AGORA_APP_ID and AGORA_APP_CERTIFICATE (server env only; never PUBLIC_*)',
      },
      500
    );
  }
  if (APP_ID.length !== 32 || !/^[0-9a-f]{32}$/i.test(APP_ID)) {
    return json({ error: 'AGORA_APP_ID must be 32 hex characters' }, 500);
  }
  if (APP_CERT.length !== 32 || !/^[0-9a-f]{32}$/i.test(APP_CERT)) {
    return json({ error: 'AGORA_APP_CERTIFICATE must be 32 hex characters' }, 500);
  }

  const ok = await authorizeTrainerLiveToken(userSupabase, sessionId, participantId, uid);
  if (!ok) {
    return json({ error: 'Forbidden' }, 403);
  }

  try {
    const token = RtcTokenBuilder.buildTokenWithUserAccount(
      APP_ID,
      APP_CERT,
      sessionId,
      participantId,
      RtcRole.PUBLISHER,
      TOKEN_TTL_SEC,
      TOKEN_TTL_SEC
    );
    if (!token || typeof token !== 'string') {
      return json({ error: 'Token generation failed' }, 500);
    }
    return json(
      {
        token,
        uid: participantId,
        channelName: sessionId,
      },
      200
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Token generation failed';
    if (import.meta.env.DEV) console.error('[api/agora/token]', e);
    return json({ error: msg }, 500);
  }
};
