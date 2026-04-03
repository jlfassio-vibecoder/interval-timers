import AgoraRTC from 'agora-rtc-sdk-ng';

const appId = import.meta.env.VITE_AGORA_APP_ID as string;

let appIdWarned = false;

export function getTrainerLiveAppId(): string {
  const id = appId ?? '';
  if (typeof window !== 'undefined' && import.meta.env.DEV && !id && !appIdWarned) {
    appIdWarned = true;
    console.warn(
      '[TrainerLive Agora] VITE_AGORA_APP_ID is not set. Add it to .env. Dev: npm run dev:trainer:live.'
    );
  }
  return id;
}

export type TrainerLiveTokenResult = { token: string } | { error: string };

export async function getTrainerLiveToken(
  channelName: string,
  account: string
): Promise<TrainerLiveTokenResult> {
  try {
    const envBase = (import.meta.env.VITE_AGORA_TOKEN_BASE_URL ?? '').trim();
    const base = envBase || (typeof window !== 'undefined' ? window.location.origin : '');
    const url = `${base.replace(/\/+$/, '')}/api/trainer-live/agora-token?channel=${encodeURIComponent(channelName)}&account=${encodeURIComponent(account)}`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      const msg = err?.error ?? `Token server ${res.status}`;
      return { error: msg };
    }
    const data = (await res.json()) as { token?: string };
    const fetchedToken = data?.token ?? null;
    if (!fetchedToken) return { error: 'Token server returned no token' };
    return { token: fetchedToken };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Token fetch failed';
    const isNetwork = msg.includes('fetch') || msg.includes('Failed') || msg.includes('Network');
    const hint = isNetwork
      ? ' — Check app is running and VITE_AGORA_APP_ID / VITE_AGORA_APP_CERTIFICATE are set for Trainer Live.'
      : '';
    return { error: msg + hint };
  }
}

export function createTrainerLiveRtcClient() {
  return AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
}
