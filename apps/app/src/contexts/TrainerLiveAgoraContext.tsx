import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAgoraToken } from '@/hooks/useAgoraToken';
import {
  useTrainerLiveAgoraChannel,
  type TrainerLiveSecureAgoraToken,
  type UseTrainerLiveAgoraChannelResult,
} from '@/hooks/useTrainerLiveAgoraChannel';

const TrainerLiveAgoraContext = createContext<UseTrainerLiveAgoraChannelResult | null>(null);

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

  return (
    <TrainerLiveAgoraContext.Provider value={channel}>
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

export function useTrainerLiveAgora(): UseTrainerLiveAgoraChannelResult {
  const ctx = useContext(TrainerLiveAgoraContext);
  if (!ctx) {
    throw new Error('useTrainerLiveAgora must be used within TrainerLiveAgoraProvider');
  }
  return ctx;
}
