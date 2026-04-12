import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAgoraToken } from '@/hooks/useAgoraToken';
import {
  useTrainerLiveAgoraChannel,
  type TrainerLiveSecureAgoraToken,
  type UseTrainerLiveAgoraChannelResult,
} from '@/hooks/useTrainerLiveAgoraChannel';

/**
 * After `refetch()`, waits until the token hook finishes loading so reconnect uses a fresh JWT.
 * Handles very fast fetches (may not observe `loading === true`) via a short time gate.
 * Pass an `AbortSignal` (e.g. from an `AbortController` aborted on provider unmount) so the
 * polling `setInterval` is cleared immediately on abort — not only on the next 32ms tick.
 */
function waitForAgoraSecureTokenAfterRefetch(
  refetch: () => void,
  getSnapshot: () => { loading: boolean; error: string | null; token: string | null },
  signal: AbortSignal
): Promise<void> {
  if (signal.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }
  refetch();
  const started = Date.now();
  let sawLoading = false;
  return new Promise((resolve, reject) => {
    let settled = false;
    let id: ReturnType<typeof setInterval> | undefined;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (id !== undefined) clearInterval(id);
      signal.removeEventListener('abort', onAbort);
      fn();
    };
    const onAbort = () => {
      finish(() => reject(new DOMException('Aborted', 'AbortError')));
    };
    signal.addEventListener('abort', onAbort);
    id = setInterval(() => {
      if (signal.aborted) {
        finish(() => reject(new DOMException('Aborted', 'AbortError')));
        return;
      }
      const { loading, error, token } = getSnapshot();
      const elapsed = Date.now() - started;
      if (loading) sawLoading = true;
      if (error && !loading) {
        finish(() => reject(new Error(error)));
        return;
      }
      if (!loading && token && (sawLoading || elapsed >= 80)) {
        finish(() => resolve());
        return;
      }
      if (elapsed > 20000) {
        finish(() => reject(new Error('Timed out waiting for Agora token refresh')));
      }
    }, 32);
  });
}

export type TrainerLiveAgoraContextValue = UseTrainerLiveAgoraChannelResult & {
  isRejoining: boolean;
};

const TrainerLiveAgoraContext = createContext<TrainerLiveAgoraContextValue | null>(null);

export function TrainerLiveAgoraProvider({
  sessionId,
  participantId,
  authUserId,
  children,
}: {
  sessionId: string;
  participantId: string | null;
  /** When set with `participantId`, uses authenticated `/api/agora/token` before joining. Guests omit → legacy token route. */
  authUserId: string | null;
  children: ReactNode;
}) {
  const useSecure = Boolean(authUserId && participantId);
  const agoraTok = useAgoraToken(sessionId, {
    participantId,
    enabled: useSecure,
  });

  const secureGate = useMemo((): TrainerLiveSecureAgoraToken | null => {
    if (!useSecure) return null;
    return {
      loading: agoraTok.loading,
      error: agoraTok.error,
      token: agoraTok.token,
      joinUid: agoraTok.uid,
      channelName: agoraTok.channelName,
    };
  }, [
    useSecure,
    agoraTok.loading,
    agoraTok.error,
    agoraTok.token,
    agoraTok.uid,
    agoraTok.channelName,
  ]);

  const channel = useTrainerLiveAgoraChannel(sessionId, participantId, secureGate);

  const [isRejoining, setIsRejoining] = useState(false);
  const agoraTokRef = useRef(agoraTok);
  agoraTokRef.current = agoraTok;
  const providerMountedRef = useRef(true);
  /** Aborted on provider unmount or when a new rejoin supersedes the previous wait — stops token polling immediately. */
  const reconnectWaitAbortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    providerMountedRef.current = true;
    return () => {
      providerMountedRef.current = false;
      reconnectWaitAbortRef.current?.abort();
    };
  }, []);

  const handleRejoin = useCallback(async () => {
    reconnectWaitAbortRef.current?.abort();
    const waitAc = new AbortController();
    reconnectWaitAbortRef.current = waitAc;
    setIsRejoining(true);
    try {
      // Sequence: fresh JWT (secure path) → hook leave + reconnectNonce → effect join.
      if (useSecure) {
        await waitForAgoraSecureTokenAfterRefetch(
          agoraTok.refetch,
          () => ({
            loading: agoraTokRef.current.loading,
            error: agoraTokRef.current.error,
            token: agoraTokRef.current.token,
          }),
          waitAc.signal
        );
        if (reconnectWaitAbortRef.current === waitAc) {
          reconnectWaitAbortRef.current = null;
        }
      }
      await channel.rejoin();
    } finally {
      if (reconnectWaitAbortRef.current === waitAc) {
        reconnectWaitAbortRef.current = null;
      }
      if (providerMountedRef.current) setIsRejoining(false);
    }
  }, [useSecure, agoraTok.refetch, channel.rejoin]);

  const contextValue: TrainerLiveAgoraContextValue = {
    ...channel,
    rejoin: handleRejoin,
    isRejoining,
  };

  return (
    <TrainerLiveAgoraContext.Provider value={contextValue}>
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {useSecure && agoraTok.loading ? (
          <div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/75 px-6 text-center text-white"
            role="status"
            aria-busy="true"
          >
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-light border-t-transparent" />
            <p className="text-sm text-white/85">Initializing secure connection…</p>
          </div>
        ) : null}
        {useSecure && agoraTok.error ? (
          <div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/90 px-6 text-center text-white"
            role="alert"
          >
            <p className="text-base font-medium text-orange-light">Could not join this session</p>
            <p className="max-w-md text-sm text-white/70">
              {agoraTok.error.includes('Forbidden') || agoraTok.error.includes('403')
                ? 'You do not have access to this live session. Sign in with the invited account if required, or ask your coach for help.'
                : agoraTok.error}
            </p>
            <button
              type="button"
              onClick={() => agoraTok.refetch()}
              className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
            >
              Try again
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </TrainerLiveAgoraContext.Provider>
  );
}

export function useTrainerLiveAgora(): TrainerLiveAgoraContextValue {
  const ctx = useContext(TrainerLiveAgoraContext);
  if (!ctx) {
    throw new Error('useTrainerLiveAgora must be used within TrainerLiveAgoraProvider');
  }
  return ctx;
}
