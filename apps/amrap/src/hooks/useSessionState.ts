import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { SETUP_DURATION_SECONDS } from '@interval-timers/timer-core';
import type { AmrapSessionPublic } from '@/lib/supabase';

export type SessionTimerState = 'waiting' | 'setup' | 'work' | 'finished';

const THROTTLE_PUSH_MS = 3000;

export interface UseSessionStateResult {
  timeLeft: number;
  totalTime: number;
  timerState: SessionTimerState;
  isPaused: boolean;
  setTimerState: (s: SessionTimerState) => void;
  setTimeLeft: (n: number) => void;
  setIsPaused: (p: boolean) => void;
  pushState: (payload: {
    state: SessionTimerState;
    time_left_sec: number;
    is_paused: boolean;
    started_at?: string | null;
  }) => Promise<boolean>;
  skipSetup: () => void;
  finish: () => void;
  startWork: () => void;
  startSetup: () => void;
}

export function useSessionState(
  sessionId: string | undefined,
  session: AmrapSessionPublic | null,
  isHost: boolean,
  hostToken: string | null
): UseSessionStateResult {
  const totalTime = session ? session.duration_minutes * 60 : 15 * 60;

  const [timeLeft, setTimeLeft] = useState(session?.time_left_sec ?? SETUP_DURATION_SECONDS);
  const [timerState, setTimerState] = useState<SessionTimerState>(
    (session?.state as SessionTimerState) ?? 'waiting'
  );
  const [isPaused, setIsPaused] = useState(session?.is_paused ?? false);

  const lastPushRef = useRef(0);

  const pushState = useCallback(
    async (payload: {
      state: SessionTimerState;
      time_left_sec: number;
      is_paused: boolean;
      started_at?: string | null;
    }) => {
      if (!sessionId || !hostToken || !isHost) return false;
      const { data, error } = await supabase.rpc('update_session_state', {
        p_session_id: sessionId,
        p_host_token: hostToken,
        p_state: payload.state,
        p_time_left_sec: payload.time_left_sec,
        p_is_paused: payload.is_paused,
        p_started_at: payload.started_at ?? null,
      });
      if (error) return false;
      return (data as number) > 0;
    },
    [sessionId, hostToken, isHost]
  );

  const skipSetup = useCallback(() => {
    setTimerState('work');
    setTimeLeft(totalTime);
    setIsPaused(false);
    pushState({
      state: 'work',
      time_left_sec: totalTime,
      is_paused: false,
      started_at: new Date().toISOString(),
    });
  }, [totalTime, pushState]);

  const finish = useCallback(() => {
    setTimerState('finished');
    setTimeLeft(0);
    pushState({ state: 'finished', time_left_sec: 0, is_paused: false });
  }, [pushState]);

  const startWork = useCallback(() => {
    setTimerState('work');
    setTimeLeft(totalTime);
    setIsPaused(false);
    pushState({
      state: 'work',
      time_left_sec: totalTime,
      is_paused: false,
      started_at: new Date().toISOString(),
    });
  }, [totalTime, pushState]);

  const startSetup = useCallback(() => {
    setTimerState('setup');
    setTimeLeft(SETUP_DURATION_SECONDS);
    setIsPaused(false);
    pushState({
      state: 'setup',
      time_left_sec: SETUP_DURATION_SECONDS,
      is_paused: false,
    });
  }, [pushState]);

  if (!isHost && session) {
    return {
      timeLeft: session.time_left_sec,
      totalTime,
      timerState: session.state as SessionTimerState,
      isPaused: session.is_paused,
      setTimerState: () => {},
      setTimeLeft: () => {},
      setIsPaused: () => {},
      pushState: async () => false,
      skipSetup: () => {},
      finish: () => {},
      startWork: () => {},
      startSetup: () => {},
    };
  }

  useEffect(() => {
    if (!session) return;
    setTimeLeft(session.time_left_sec);
    setTimerState((session.state as SessionTimerState) ?? 'waiting');
    setIsPaused(session.is_paused ?? false);
  }, [session?.id, session?.time_left_sec, session?.state, session?.is_paused]);

  useEffect(() => {
    if (!isHost || !sessionId || timerState === 'waiting' || timerState === 'finished') return;
    if (isPaused) return;

    const interval = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerState === 'setup') {
            setTimerState('work');
            pushState({
              state: 'work',
              time_left_sec: totalTime,
              is_paused: false,
              started_at: new Date().toISOString(),
            });
            return totalTime;
          }
          if (timerState === 'work') {
            setTimerState('finished');
            pushState({ state: 'finished', time_left_sec: 0, is_paused: false });
            return 0;
          }
          return prev;
        }
        const next = prev - 1;
        const now = Date.now();
        if (now - lastPushRef.current >= THROTTLE_PUSH_MS) {
          lastPushRef.current = now;
          pushState({
            state: timerState === 'setup' ? 'setup' : 'work',
            time_left_sec: next,
            is_paused: false,
          });
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isHost, sessionId, timerState, isPaused, session?.duration_minutes, totalTime, pushState]);

  return {
    timeLeft,
    totalTime,
    timerState,
    isPaused,
    setTimerState,
    setTimeLeft,
    setIsPaused,
    pushState,
    skipSetup,
    finish,
    startWork,
    startSetup,
  };
}
