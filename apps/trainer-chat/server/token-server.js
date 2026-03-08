/**
 * Local Agora RTC token server for development.
 * Generates tokens using App ID + Certificate.
 * Loads VITE_AGORA_APP_ID and VITE_AGORA_APP_CERTIFICATE from monorepo root .env
 */
import { createServer } from 'http'
import { config } from 'dotenv'
import pkg from 'agora-access-token'
const { RtcTokenBuilder, RtcRole } = pkg
import path from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cwd = process.cwd()
const candidates = [
  path.resolve(__dirname, '../../.env'),
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
  const uid = parseInt(u.searchParams.get('uid') ?? '0', 10)
  if (!channel || channel.length === 0) {
    send(res, 400, { error: 'channel query param required' })
    return
  }
  try {
    const ts = Math.floor(Date.now() / 1000)
    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERT,
      channel,
      uid,
      RtcRole.PUBLISHER,
      ts + EXPIRY_SEC
    )
    send(res, 200, { token })
  } catch (e) {
    send(res, 500, { error: e?.message ?? 'Token generation failed' })
  }
}).listen(PORT, () => {
  console.log(`[agora-token] http://localhost:${PORT}/token?channel=AMRAP&uid=0`)
})
