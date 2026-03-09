/**
 * Vercel serverless function: Agora RTC token generation for production.
 * GET /api/agora-token?channel=:sessionId&account=:participantId
 *
 * Validates that the participant exists in amrap_participants before issuing a token.
 * CORS: restrict to AGORA_TOKEN_ALLOWED_ORIGINS (comma-separated). If unset, uses *.
 * Env: VITE_AGORA_APP_ID, VITE_AGORA_APP_CERTIFICATE, SUPABASE_URL, SUPABASE_ANON_KEY, AGORA_TOKEN_ALLOWED_ORIGINS
 */
import { createClient } from '@supabase/supabase-js'
import { RtcTokenBuilder, RtcRole } from 'agora-token'

const EXPIRY_SEC = 3600

const ALLOWED_ORIGINS = (process.env.AGORA_TOKEN_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

function corsHeaders(origin: string | null): Record<string, string> {
  const base: Record<string, string> = { 'Content-Type': 'application/json' }
  if (ALLOWED_ORIGINS.length > 0) {
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      base['Access-Control-Allow-Origin'] = origin
    }
  } else {
    base['Access-Control-Allow-Origin'] = '*'
  }
  return base
}

function isValidUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get('Origin')
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
  if (ALLOWED_ORIGINS.length > 0 && origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  } else if (ALLOWED_ORIGINS.length === 0) {
    headers['Access-Control-Allow-Origin'] = '*'
  }
  return new Response(null, { status: 204, headers })
}

export async function GET(request: Request) {
  const origin = request.headers.get('Origin')

  const APP_ID = (process.env.VITE_AGORA_APP_ID ?? '').trim()
  const APP_CERT = (process.env.VITE_AGORA_APP_CERTIFICATE ?? '').trim()
  if (!APP_ID || !APP_CERT) {
    return Response.json(
      { error: 'Missing VITE_AGORA_APP_ID or VITE_AGORA_APP_CERTIFICATE in Vercel env' },
      { status: 500, headers: corsHeaders(origin) }
    )
  }
  if (APP_ID.length !== 32 || !/^[0-9a-f]{32}$/i.test(APP_ID)) {
    return Response.json(
      { error: 'VITE_AGORA_APP_ID must be 32 hex chars. Check Agora Console and Vercel env.' },
      { status: 500, headers: corsHeaders(origin) }
    )
  }
  if (APP_CERT.length !== 32 || !/^[0-9a-f]{32}$/i.test(APP_CERT)) {
    return Response.json(
      { error: 'VITE_AGORA_APP_CERTIFICATE must be 32 hex chars. No extra spaces. Check Vercel env.' },
      { status: 500, headers: corsHeaders(origin) }
    )
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return Response.json(
      { error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY' },
      { status: 500, headers: corsHeaders(origin) }
    )
  }

  const { searchParams } = new URL(request.url)
  const channel = searchParams.get('channel')
  const account = searchParams.get('account')

  if (!channel || channel.length === 0) {
    return Response.json(
      { error: 'channel query param required' },
      { status: 400, headers: corsHeaders(origin) }
    )
  }

  if (!account || account.length === 0) {
    return Response.json(
      { error: 'account query param required (participant_id)' },
      { status: 400, headers: corsHeaders(origin) }
    )
  }

  if (!isValidUuid(channel) || !isValidUuid(account)) {
    return Response.json(
      { error: 'channel and account must be valid UUIDs' },
      { status: 400, headers: corsHeaders(origin) }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const { data, error } = await supabase
    .from('amrap_participants')
    .select('id')
    .eq('session_id', channel)
    .eq('id', account)
    .maybeSingle()

  if (error) {
    return Response.json(
      { error: 'Failed to verify participant' },
      { status: 503, headers: corsHeaders(origin) }
    )
  }

  if (!data) {
    return Response.json(
      { error: 'Participant not found in session' },
      { status: 403, headers: corsHeaders(origin) }
    )
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
    )
    if (!token || typeof token !== 'string') {
      return Response.json(
        { error: 'Token generation returned empty. Verify App ID and Certificate in Agora Console.' },
        { status: 500, headers: corsHeaders(origin) }
      )
    }
    return Response.json({ token }, { headers: corsHeaders(origin) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Token generation failed'
    return Response.json({ error: msg }, { status: 500, headers: corsHeaders(origin) })
  }
}
