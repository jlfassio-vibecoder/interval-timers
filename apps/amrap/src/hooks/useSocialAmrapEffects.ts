/**
 * Side-effect hooks for Social AMRAP: participant animation, scheduled countdown,
 * finish sound, analytics, guest result save. Composed by useSocialAmrap.
 */
import { useEffect, useRef, useState } from 'react';
import { trackEvent } from '@interval-timers/analytics';
import { supabase } from '@/lib/supabase';
import { getOrCreateAudioContext, playSoundWithContext } from '@/lib/amrapSounds';
import { saveGuestSessionResult } from '@/lib/guestSessionHistory';
import type { AmrapParticipantRow, AmrapRoundRow } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

const COUNTDOWN_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const TIMER_COMPLETE_ROUNDS_GRACE_MS = 1500; // allow late round rows from realtime before analytics

export interface UseSocialAmrapEffectsInput {
  participants: AmrapParticipantRow[];
  timerState: string;
  session: { scheduled_start_at?: string | null; workout_list?: string[]; duration_minutes?: number } | null;
  isHost: boolean;
  sessionId: string | undefined;
  participantId: string | null;
  rounds: AmrapRoundRow[];
  totalTime: number;
  user: User | null;
  startSetup: () => void;
}

export interface UseSocialAmrapEffectsResult {
  animatingIds: Set<string>;
  countdownSeconds: number;
  now: number;
}

export function useSocialAmrapEffects(
  input: UseSocialAmrapEffectsInput
): UseSocialAmrapEffectsResult {
  const {
    participants,
    timerState,
    session,
    isHost,
    sessionId,
    participantId,
    rounds,
    totalTime,
    user,
    startSetup,
  } = input;

  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set());
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const seenParticipantIdsRef = useRef<Set<string>>(new Set());
  const hasAutoStartedRef = useRef(false);
  const hasBeenBeforeScheduledRef = useRef(false);
  const finishSoundPlayedRef = useRef(false);
  const guestCompletedAtRef = useRef<string | null>(null);
  const timerCompleteTrackedRef = useRef(false);
  const timerCompleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundsRef = useRef(rounds);
  const totalTimeRef = useRef(totalTime);
  const participantIdRef = useRef(participantId);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    roundsRef.current = rounds;
    totalTimeRef.current = totalTime;
    participantIdRef.current = participantId;
  }, [rounds, totalTime, participantId]);

  useEffect(() => {
    const currentIds = new Set(participants.map((p) => p.id));
    const prev = seenParticipantIdsRef.current;
    if (prev.size === 0 && currentIds.size > 0) {
      currentIds.forEach((id) => prev.add(id));
      return;
    }
    const newIds = [...currentIds].filter((id) => !prev.has(id));
    if (newIds.length > 0) {
      newIds.forEach((id) => prev.add(id));
      setAnimatingIds((prevSet) => new Set([...prevSet, ...newIds]));
      const t = setTimeout(() => {
        setAnimatingIds((prevSet) => {
          const next = new Set(prevSet);
          newIds.forEach((id) => next.delete(id));
          return next;
        });
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [participants]);

  useEffect(() => {
    if (timerState !== 'waiting' || !session?.scheduled_start_at) return;
    const startAt = new Date(session.scheduled_start_at).getTime();
    const tick = () => {
      const n = Date.now();
      setNow(n);
      if (n < startAt) hasBeenBeforeScheduledRef.current = true;
      if (n >= startAt - COUNTDOWN_WINDOW_MS && n < startAt) {
        setCountdownSeconds(Math.max(0, Math.floor((startAt - n) / 1000)));
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timerState, session?.scheduled_start_at]);

  useEffect(() => {
    if (
      !isHost ||
      timerState !== 'waiting' ||
      !session?.scheduled_start_at ||
      hasAutoStartedRef.current ||
      !hasBeenBeforeScheduledRef.current
    )
      return;
    const startAt = new Date(session.scheduled_start_at).getTime();
    if (now < startAt) return;
    hasAutoStartedRef.current = true;
    startSetup();
  }, [isHost, timerState, session?.scheduled_start_at, startSetup, now]);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (timerState === 'finished' && !finishSoundPlayedRef.current) {
      finishSoundPlayedRef.current = true;
      const ctx = getOrCreateAudioContext(audioContextRef);
      if (ctx) playSoundWithContext(ctx, 'finish');
    }
    if (timerState !== 'finished') finishSoundPlayedRef.current = false;
  }, [timerState]);

  useEffect(() => {
    if (timerState !== 'finished') {
      timerCompleteTrackedRef.current = false;
      if (timerCompleteTimeoutRef.current) {
        clearTimeout(timerCompleteTimeoutRef.current);
        timerCompleteTimeoutRef.current = null;
      }
      return;
    }
    if (timerCompleteTrackedRef.current) return;
    timerCompleteTrackedRef.current = true;
    timerCompleteTimeoutRef.current = setTimeout(() => {
      timerCompleteTimeoutRef.current = null;
      const pid = participantIdRef.current;
      const r = roundsRef.current;
      const t = totalTimeRef.current;
      const roundsCount = pid ? r.filter((x) => x.participant_id === pid).length : 0;
      trackEvent(
        supabase,
        'timer_session_complete',
        {
          source: 'amrap_friends',
          duration_seconds: t,
          rounds: roundsCount,
        },
        { appId: 'amrap' }
      );
    }, TIMER_COMPLETE_ROUNDS_GRACE_MS);
    return () => {
      if (timerCompleteTimeoutRef.current) {
        clearTimeout(timerCompleteTimeoutRef.current);
        timerCompleteTimeoutRef.current = null;
      }
    };
  }, [timerState]);

  useEffect(() => {
    if (timerState !== 'finished') {
      guestCompletedAtRef.current = null;
      return;
    }
    if (!user && sessionId && participantId) {
      if (!guestCompletedAtRef.current) {
        guestCompletedAtRef.current = new Date().toISOString();
      }
      const totalRounds = rounds.filter((r) => r.participant_id === participantId).length;
      saveGuestSessionResult(
        sessionId,
        participantId,
        totalRounds,
        session?.workout_list ?? [],
        session?.duration_minutes ?? 15,
        guestCompletedAtRef.current
      );
    }
  }, [timerState, user, sessionId, participantId, rounds, session?.workout_list, session?.duration_minutes]);

  return { animatingIds, countdownSeconds, now };
}
