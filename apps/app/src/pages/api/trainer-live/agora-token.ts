/**
 * GET /api/trainer-live/agora-token?channel=:sessionId&account=:participantId
 * Agora RTC token for Trainer Live Video; validates participant belongs to an active session.
 * CORS: AGORA_TOKEN_ALLOWED_ORIGINS (same as AMRAP token route).
 */
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

const EXPIRY_SEC = 3600;

const ALLOWED_ORIGINS = (
  import.meta.env.AGORA_TOKEN_ALLOWED_ORIGINS ??
  process.env.AGORA_TOKEN_ALLOWED_ORIGINS ??
  ''
)
  .split(',')
  .map((o: string) => o.trim())
  .filter(Boolean);

function corsHeaders(origin: string | null): Record<string, string> {
  const base: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ALLOWED_ORIGINS.length > 0) {
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      base['Access-Control-Allow-Origin'] = origin;
    }
  } else {
    base['Access-Control-Allow-Origin'] = '*';
  }
  return base;
}

function isValidUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export const OPTIONS: APIRoute = async ({ request }) => {
  const origin = request.headers.get('Origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (ALLOWED_ORIGINS.length > 0 && origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else if (ALLOWED_ORIGINS.length === 0) {
    headers['Access-Control-Allow-Origin'] = '*';
  }
  return new Response(null, { status: 204, headers });
};

export const GET: APIRoute = async ({ request }) => {
  const origin = request.headers.get('Origin');

  const APP_ID = (
    import.meta.env.VITE_AGORA_APP_ID ||
    import.meta.env.PUBLIC_VITE_AGORA_APP_ID ||
    process.env.VITE_AGORA_APP_ID ||
    ''
  ).trim();
  const APP_CERT = (
    import.meta.env.VITE_AGORA_APP_CERTIFICATE ||
    process.env.VITE_AGORA_APP_CERTIFICATE ||
    ''
  ).trim();
  if (!APP_ID || !APP_CERT) {
    return new Response(
      JSON.stringify({ error: 'Missing VITE_AGORA_APP_ID or VITE_AGORA_APP_CERTIFICATE' }),
      { status: 500, headers: corsHeaders(origin) }
    );
  }
  if (APP_ID.length !== 32 || !/^[0-9a-f]{32}$/i.test(APP_ID)) {
    return new Response(JSON.stringify({ error: 'VITE_AGORA_APP_ID must be 32 hex chars' }), {
      status: 500,
      headers: corsHeaders(origin),
    });
  }
  if (APP_CERT.length !== 32 || !/^[0-9a-f]{32}$/i.test(APP_CERT)) {
    return new Response(
      JSON.stringify({ error: 'VITE_AGORA_APP_CERTIFICATE must be 32 hex chars' }),
      { status: 500, headers: corsHeaders(origin) }
    );
  }

  const supabaseUrl =
    import.meta.env.SUPABASE_URL ||
    import.meta.env.PUBLIC_SUPABASE_URL ||
    import.meta.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '';
  const supabaseAnonKey =
    import.meta.env.SUPABASE_ANON_KEY ||
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';
  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY' }), {
      status: 500,
      headers: corsHeaders(origin),
    });
  }

  const { searchParams } = new URL(request.url);
  const channel = searchParams.get('channel');
  const account = searchParams.get('account');

  if (!channel?.length) {
    return new Response(JSON.stringify({ error: 'channel query param required' }), {
      status: 400,
      headers: corsHeaders(origin),
    });
  }
  if (!account?.length) {
    return new Response(
      JSON.stringify({ error: 'account query param required (participant_id)' }),
      {
        status: 400,
        headers: corsHeaders(origin),
      }
    );
  }
  if (!isValidUuid(channel) || !isValidUuid(account)) {
    return new Response(JSON.stringify({ error: 'channel and account must be valid UUIDs' }), {
      status: 400,
      headers: corsHeaders(origin),
    });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: participant, error: pErr } = await supabase
    .from('trainer_live_participants')
    .select('id, session_id')
    .eq('session_id', channel)
    .eq('id', account)
    .maybeSingle();

  if (pErr) {
    if (import.meta.env.DEV) {
      console.error('[trainer-live/agora-token] participant lookup failed:', pErr);
    }
    return new Response(JSON.stringify({ error: 'Failed to verify participant' }), {
      status: 503,
      headers: corsHeaders(origin),
    });
  }

  if (!participant) {
    return new Response(JSON.stringify({ error: 'Participant not found in active session' }), {
      status: 403,
      headers: corsHeaders(origin),
    });
  }

  const { data: session, error: sErr } = await supabase
    .from('trainer_live_sessions')
    .select('id, status')
    .eq('id', channel)
    .eq('status', 'active')
    .maybeSingle();

  if (sErr) {
    if (import.meta.env.DEV) {
      console.error('[trainer-live/agora-token] session lookup failed:', sErr);
    }
    return new Response(JSON.stringify({ error: 'Failed to verify session' }), {
      status: 503,
      headers: corsHeaders(origin),
    });
  }

  if (!session) {
    return new Response(JSON.stringify({ error: 'Participant not found in active session' }), {
      status: 403,
      headers: corsHeaders(origin),
    });
  }

  try {
    const token = RtcTokenBuilder.buildTokenWithUserAccount(
      APP_ID,
      APP_CERT,
      channel,
      account,
      RtcRole.PUBLISHER,
      EXPIRY_SEC,
      EXPIRY_SEC
    );
    if (!token || typeof token !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Token generation returned empty. Check Agora Console.' }),
        { status: 500, headers: corsHeaders(origin) }
      );
    }
    return new Response(JSON.stringify({ token }), { status: 200, headers: corsHeaders(origin) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Token generation failed';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: corsHeaders(origin),
    });
  }
};
