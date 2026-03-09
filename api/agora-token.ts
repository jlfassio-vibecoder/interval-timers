/**
 * Vercel serverless function: Agora RTC token generation for production.
 * GET /api/agora-token?channel=:sessionId&account=:participantId
 *
 * Env: VITE_AGORA_APP_ID, VITE_AGORA_APP_CERTIFICATE (set in Vercel dashboard)
 */
import { RtcTokenBuilder, RtcRole } from 'agora-token'

const EXPIRY_SEC = 3600

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  }
}

export async function GET(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  const APP_ID = process.env.VITE_AGORA_APP_ID
  const APP_CERT = process.env.VITE_AGORA_APP_CERTIFICATE
  if (!APP_ID || !APP_CERT) {
    return Response.json(
      { error: 'Missing VITE_AGORA_APP_ID or VITE_AGORA_APP_CERTIFICATE' },
      { status: 500, headers: corsHeaders() }
    )
  }

  const { searchParams } = new URL(request.url)
  const channel = searchParams.get('channel')
  const account = searchParams.get('account')
  const uid = parseInt(searchParams.get('uid') ?? '0', 10)

  if (!channel || channel.length === 0) {
    return Response.json(
      { error: 'channel query param required' },
      { status: 400, headers: corsHeaders() }
    )
  }

  try {
    const token =
      account && account.length > 0
        ? RtcTokenBuilder.buildTokenWithUserAccount(
            APP_ID,
            APP_CERT,
            channel,
            account,
            RtcRole.PUBLISHER,
            EXPIRY_SEC,
            EXPIRY_SEC
          )
        : RtcTokenBuilder.buildTokenWithUid(
            APP_ID,
            APP_CERT,
            channel,
            uid,
            RtcRole.PUBLISHER,
            EXPIRY_SEC,
            EXPIRY_SEC
          )
    return Response.json({ token }, { headers: corsHeaders() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Token generation failed'
    return Response.json({ error: msg }, { status: 500, headers: corsHeaders() })
  }
}
