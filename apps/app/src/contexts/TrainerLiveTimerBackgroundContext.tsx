import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type TrainerLiveTimerBackgroundMode = 'self' | 'leader';

const STORAGE_PREFIX = 'trainer-live-timer-bg-mode:';

function readStoredMode(sessionId: string): TrainerLiveTimerBackgroundMode {
  if (typeof sessionStorage === 'undefined') return 'self';
  return sessionStorage.getItem(STORAGE_PREFIX + sessionId) === 'leader' ? 'leader' : 'self';
}

export interface TrainerLiveTimerBackgroundValue {
  mode: TrainerLiveTimerBackgroundMode;
  setMode: (m: TrainerLiveTimerBackgroundMode) => void;
  leaderTrainerLiveParticipantId: string | null;
  setLeaderTrainerLiveParticipantId: (id: string | null) => void;
  /**
   * Timer background spotlight (`trainer_live_participants.id`). `null` = trainer’s own camera.
   * Used by Tabata (pick any client to review form); AMRAP ignores this.
   */
  timerBackgroundSpotlightParticipantId: string | null;
  setTimerBackgroundSpotlightParticipantId: (id: string | null) => void;
}

const TrainerLiveTimerBackgroundContext = createContext<TrainerLiveTimerBackgroundValue | null>(
  null
);

export function TrainerLiveTimerBackgroundProvider({
  sessionId,
  children,
}: {
  sessionId: string;
  children: ReactNode;
}) {
  const [mode, setModeState] = useState<TrainerLiveTimerBackgroundMode>(() =>
    readStoredMode(sessionId)
  );
  const [leaderTrainerLiveParticipantId, setLeaderTrainerLiveParticipantId] = useState<
    string | null
  >(null);
  const [timerBackgroundSpotlightParticipantId, setTimerBackgroundSpotlightParticipantId] =
    useState<string | null>(null);

  const setMode = useCallback(
    (m: TrainerLiveTimerBackgroundMode) => {
      setModeState(m);
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(STORAGE_PREFIX + sessionId, m);
      }
    },
    [sessionId]
  );

  const value = useMemo(
    () => ({
      mode,
      setMode,
      leaderTrainerLiveParticipantId,
      setLeaderTrainerLiveParticipantId,
      timerBackgroundSpotlightParticipantId,
      setTimerBackgroundSpotlightParticipantId,
    }),
    [mode, setMode, leaderTrainerLiveParticipantId, timerBackgroundSpotlightParticipantId]
  );

  return (
    <TrainerLiveTimerBackgroundContext.Provider value={value}>
      {children}
    </TrainerLiveTimerBackgroundContext.Provider>
  );
}

export function useTrainerLiveTimerBackground(): TrainerLiveTimerBackgroundValue {
  const ctx = useContext(TrainerLiveTimerBackgroundContext);
  if (!ctx) {
    throw new Error(
      'useTrainerLiveTimerBackground must be used within TrainerLiveTimerBackgroundProvider'
    );
  }
  return ctx;
}

/** Safe for client routes without the provider (returns null). */
export function useTrainerLiveTimerBackgroundOptional(): TrainerLiveTimerBackgroundValue | null {
  return useContext(TrainerLiveTimerBackgroundContext);
}
