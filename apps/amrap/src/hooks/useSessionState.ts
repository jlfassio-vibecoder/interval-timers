import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { SETUP_DURATION_SECONDS } from '@interval-timers/timer-core';
import type { AmrapSessionPublic } from '@/lib/supabase';

export type SessionTimerState = 'waiting' | 'setup' | 'work' | 'finished';

export type AmrapTimerSegment = 'amrap' | 'free_workout';

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
    /** When set, updates DB segment; omit or null leaves segment unchanged (COALESCE) */
    timer_segment?: AmrapTimerSegment | null;
  }) => Promise<boolean>;
  skipSetup: () => void;
  finish: () => void;
  startWork: () => void;
  startSetup: () => void;
  /** Host only: from finished → work with free_workout segment (synced countdown) */
  startFreeWorkout: (durationSec: number) => Promise<boolean>;
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
      timer_segment?: AmrapTimerSegment | null;
    }) => {
      if (!sessionId || !hostToken || !isHost) return false;
      const { data, error } = await supabase.rpc('update_session_state', {
        p_session_id: sessionId,
        p_host_token: hostToken,
        p_state: payload.state,
        p_time_left_sec: payload.time_left_sec,
        p_is_paused: payload.is_paused,
        p_started_at: payload.started_at ?? null,
        p_timer_segment: payload.timer_segment ?? null,
      });
      if (error) return false;
      return (data as number) > 0;
    },
    [sessionId, hostToken, isHost]
  );

  const startFreeWorkout = useCallback(
    async (durationSec: number) => {
      if (!sessionId || !hostToken || !isHost) return false;
      const { data, error } = await supabase.rpc('start_free_workout_timer', {
        p_session_id: sessionId,
        p_host_token: hostToken,
        p_duration_sec: durationSec,
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
      timer_segment: 'amrap',
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
      timer_segment: 'amrap',
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
      timer_segment: 'amrap',
    });
  }, [pushState]);

  useEffect(() => {
    if (!session) return;
    setTimeLeft(session.time_left_sec);
    setTimerState((session.state as SessionTimerState) ?? 'waiting');
    setIsPaused(session.is_paused ?? false);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from server; session fields are the source of truth
  }, [session?.id, session?.time_left_sec, session?.state, session?.is_paused]);

  // Run 1s countdown for both host and participants so the clock updates every second.
  // Only the host pushes state to the server (throttled); participants just tick locally.
  useEffect(() => {
    if (!sessionId || timerState === 'waiting' || timerState === 'finished') return;
    if (isPaused) return;

    const interval = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerState === 'setup') {
            setTimerState('work');
            if (isHost) {
              pushState({
                state: 'work',
                time_left_sec: totalTime,
                is_paused: false,
                started_at: new Date().toISOString(),
                timer_segment: 'amrap',
              });
            }
            return totalTime;
          }
          if (timerState === 'work') {
            setTimerState('finished');
            if (isHost) {
              pushState({ state: 'finished', time_left_sec: 0, is_paused: false });
            }
            return 0;
          }
          return prev;
        }
        const next = prev - 1;
        if (isHost) {
          const now = Date.now();
          if (now - lastPushRef.current >= THROTTLE_PUSH_MS) {
            lastPushRef.current = now;
            pushState({
              state: timerState === 'setup' ? 'setup' : 'work',
              time_left_sec: next,
              is_paused: false,
            });
          }
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
    startFreeWorkout,
  };
}
