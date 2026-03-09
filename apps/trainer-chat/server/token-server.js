/**
 * Local Agora RTC token server for development.
 * Generates tokens using App ID + Certificate.
 * Loads VITE_AGORA_APP_ID and VITE_AGORA_APP_CERTIFICATE from monorepo root .env
 */
import { createServer } from 'http'
import { config } from 'dotenv'
import pkg from 'agora-token'
const { RtcTokenBuilder, RtcRole } = pkg
import path from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cwd = process.cwd()
const candidates = [
  path.resolve(__dirname, '../../../.env'),
  path.resolve(cwd, '.env'),
  path.resolve(cwd, '../.env'),
  path.resolve(cwd, '../../.env'),
]
for (const envPath of candidates) {
  if (existsSync(envPath)) {
    config({ path: envPath, override: true })
    if (process.env.VITE_AGORA_APP_ID && process.env.VITE_AGORA_APP_CERTIFICATE) break
  }
}

const PORT = 9517
const APP_ID = process.env.VITE_AGORA_APP_ID
const APP_CERT = process.env.VITE_AGORA_APP_CERTIFICATE
const EXPIRY_SEC = 3600

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(JSON.stringify(body))
}

createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }
  if (req.method !== 'GET' || !req.url.startsWith('/token')) {
    send(res, 404, { error: 'Not found' })
    return
  }
  if (!APP_ID || !APP_CERT) {
    send(res, 500, {
      error: 'Missing VITE_AGORA_APP_ID or VITE_AGORA_APP_CERTIFICATE in .env',
    })
    return
  }
  const u = new URL(req.url, `http://localhost:${PORT}`)
  const channel = u.searchParams.get('channel')
  const account = u.searchParams.get('account')
  const uid = parseInt(u.searchParams.get('uid') ?? '0', 10)
  if (!channel || channel.length === 0) {
    send(res, 400, { error: 'channel query param required' })
    return
  }
  try {
    let token
    if (account && account.length > 0) {
      // buildTokenWithUserAccount uses tokenExpire/privilegeExpire as seconds from now
      token = RtcTokenBuilder.buildTokenWithUserAccount(
        APP_ID,
        APP_CERT,
        channel,
        account,
        RtcRole.PUBLISHER,
        EXPIRY_SEC,
        EXPIRY_SEC
      )
    } else {
      // buildTokenWithUid uses tokenExpire, privilegeExpire as seconds from now
      token = RtcTokenBuilder.buildTokenWithUid(
        APP_ID,
        APP_CERT,
        channel,
        uid,
        RtcRole.PUBLISHER,
        EXPIRY_SEC,
        EXPIRY_SEC
      )
    }
    send(res, 200, { token })
  } catch (e) {
    const msg = e?.message ?? 'Token generation failed'
    console.error('[agora-token] Error:', msg)
    send(res, 500, { error: msg })
  }
}).listen(PORT, () => {
  console.log(`[agora-token] http://localhost:${PORT}/token`)
  console.log(`  uid:   ?channel=AMRAP&uid=1`)
  console.log(`  account: ?channel=SESSION_ID&account=PARTICIPANT_ID`)
})
