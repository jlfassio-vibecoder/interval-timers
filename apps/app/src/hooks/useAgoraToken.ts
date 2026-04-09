import { useCallback, useEffect, useState } from 'react';
import { missionControlApiAuthHeaders } from '@/lib/mission-control-api-auth';

export type UseAgoraTokenResult = {
  token: string | null;
  uid: string | null;
  channelName: string | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export type UseAgoraTokenOptions = {
  /** Trainer Live: pass `trainer_live_participants.id` so `sessionId` is treated as `trainer_live_sessions.id`. */
  participantId?: string | null;
  /** When false, no network (e.g. guest clients use legacy token path). */
  enabled?: boolean;
};

/**
 * Fetches a short-lived Agora RTC token from `/api/agora/token`. Token is kept in memory only.
 * Requires `participantId` (trainer live participant row id); `sessionId` must be
 * `trainer_live_sessions.id`.
 */
export function useAgoraToken(
  sessionId: string | undefined,
  options?: UseAgoraTokenOptions
): UseAgoraTokenResult {
  const participantId = options?.participantId ?? null;
  const enabled = options?.enabled ?? true;
  const [token, setToken] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [channelName, setChannelName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchNonce, setFetchNonce] = useState(0);

  const refetch = useCallback(() => {
    setFetchNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !sessionId?.trim()) {
      setToken(null);
      setUid(null);
      setChannelName(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const authHeaders = await missionControlApiAuthHeaders();
        const sid = encodeURIComponent(sessionId.trim());
        const pid =
          participantId && participantId.trim()
            ? `&participantId=${encodeURIComponent(participantId.trim())}`
            : '';
        const url = `/api/agora/token?sessionId=${sid}${pid}`;
        const res = await fetch(url, {
          credentials: 'include',
          headers: {
            Accept: 'application/json',
            ...authHeaders,
          },
        });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          token?: string;
          uid?: string;
          channelName?: string;
        };

        if (cancelled) return;

        if (!res.ok) {
          setToken(null);
          setUid(null);
          setChannelName(null);
          setError(body.error || `Request failed (${res.status})`);
          return;
        }

        if (typeof body.token !== 'string' || !body.token) {
          setToken(null);
          setUid(null);
          setChannelName(null);
          setError('Invalid token response');
          return;
        }

        setToken(body.token);
        setUid(typeof body.uid === 'string' ? body.uid : null);
        setChannelName(typeof body.channelName === 'string' ? body.channelName : sessionId.trim());
      } catch (e) {
        if (!cancelled) {
          setToken(null);
          setUid(null);
          setChannelName(null);
          setError(e instanceof Error ? e.message : 'Failed to load token');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, participantId, enabled, fetchNonce]);

  return { token, uid, channelName, loading, error, refetch };
}
