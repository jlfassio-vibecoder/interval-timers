import AgoraRTC from 'agora-rtc-sdk-ng'

const appId = import.meta.env.VITE_AGORA_APP_ID as string
const token = import.meta.env.VITE_AGORA_TOKEN as string | undefined

export function getAppId(): string {
  return appId ?? ''
}

/** Token for joining channel. Required when App Certificate is enabled in Agora Console. */
export function getToken(): string | null {
  const t = token?.trim()
  return t && t.length > 0 ? t : null
}

export type TokenResult = { token: string } | { error: string }

/** Fetch token from /api/agora-token (prod) or proxied token server (dev). Uses env token if set. */
export async function getTokenOrFetchWithAccount(
  channelName: string,
  account: string
): Promise<TokenResult> {
  const envToken = getToken()
  if (envToken) return { token: envToken }
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    const url = `${base}/api/agora-token?channel=${encodeURIComponent(channelName)}&account=${encodeURIComponent(account)}`
    const res = await fetch(url)
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string }
      const msg = err?.error ?? `Token server ${res.status}`
      return { error: msg }
    }
    const data = (await res.json()) as { token?: string }
    const fetchedToken = data?.token ?? null
    if (!fetchedToken) return { error: 'Token server returned no token' }
    return { token: fetchedToken }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Token fetch failed'
    const isNetwork = msg.includes('fetch') || msg.includes('Failed') || msg.includes('Network')
    const hint = isNetwork
      ? ' — Dev: run npm run dev:amrap:video. Prod: ensure /api/agora-token, env vars, and AGORA_TOKEN_ALLOWED_ORIGINS includes this site.'
      : ''
    return { error: msg + hint }
  }
}

export function createClient() {
  return AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })
}
