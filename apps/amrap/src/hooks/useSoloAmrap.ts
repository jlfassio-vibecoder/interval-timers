/**
 * Solo AMRAP adapter hook. Returns AmrapSessionEngine for use with AmrapSessionShell.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { trackEvent } from '@interval-timers/analytics';
import { supabase } from '@/lib/supabase';
import { SETUP_DURATION_SECONDS } from '@interval-timers/timer-core';
import type { AmrapSessionEngine, AmrapTimerPhase } from '@/types/amrap-session';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function getTimerStyles(phase: AmrapTimerPhase) {
  switch (phase) {
    case 'setup':
      return { text: 'Setup', sub: 'Get into position' };
    case 'work':
      return { text: 'AMRAP', sub: 'Accumulate Volume' };
    case 'finished':
      return { text: 'Time Cap', sub: 'Work Complete' };
    default:
      return { text: 'Ready', sub: '' };
  }
}

export interface UseSoloAmrapInput {
  durationMinutes: number;
  workoutList: string[];
}

function getOrCreateAudioContext(
  ref: { current: AudioContext | null }
): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;
  if (!ref.current || ref.current.state === 'closed') {
    ref.current = new AudioContextCtor();
  }
  const ctx = ref.current;
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function playSoundWithContext(
  ctx: AudioContext,
  type: 'start' | 'round' | 'warning' | 'finish'
) {
  try {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'start') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.5);
      gainNode.gain.setValueAtTime(0.3, now);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.8);
      osc.start(now);
      osc.stop(now + 0.9);
    } else if (type === 'round') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.3);
      gainNode.gain.setValueAtTime(0.5, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'warning') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.15);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.5);
      gainNode.gain.setValueAtTime(0.3, now);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.6);
    }
  } catch (e) {
    console.error(e);
  }
};

export function useSoloAmrap(
  input: UseSoloAmrapInput
): AmrapSessionEngine & { onStartSetup: () => void } {
  const { durationMinutes, workoutList } = input;
  const totalTime = durationMinutes * 60;

  const [timerPhase, setTimerPhase] = useState<AmrapTimerPhase>('waiting');
  const [timeLeft, setTimeLeft] = useState(SETUP_DURATION_SECONDS);
  const [rounds, setRounds] = useState(0);
  const [elapsedAtRounds, setElapsedAtRounds] = useState<number[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [workPhaseTotalTime, setWorkPhaseTotalTime] = useState(totalTime);

  const timerCompleteTrackedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const playSound = useCallback((type: 'start' | 'round' | 'warning' | 'finish') => {
    const ctx = getOrCreateAudioContext(audioContextRef);
    if (ctx) playSoundWithContext(ctx, type);
  }, []);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (timerPhase === 'finished' && !timerCompleteTrackedRef.current) {
      timerCompleteTrackedRef.current = true;
      trackEvent(
        supabase,
        'timer_session_complete',
        {
          source: 'amrap',
          duration_seconds: workPhaseTotalTime,
          rounds,
        },
        { appId: 'amrap' }
      );
    }
    if (timerPhase !== 'finished') timerCompleteTrackedRef.current = false;
  }, [timerPhase, workPhaseTotalTime, rounds]);

  const onStartSetup = useCallback(() => {
    setTimerPhase('setup');
    setTimeLeft(SETUP_DURATION_SECONDS);
    setRounds(0);
    setElapsedAtRounds([]);
    setIsPaused(false);
    setWorkPhaseTotalTime(totalTime);
    playSound('warning');
  }, [totalTime, playSound]);

  const onLogRound = useCallback(() => {
    if (timerPhase === 'work') {
      const elapsed = workPhaseTotalTime - timeLeft;
      setRounds((prev) => prev + 1);
      setElapsedAtRounds((prev) => [...prev, elapsed]);
      playSound('round');
    }
  }, [timerPhase, workPhaseTotalTime, timeLeft, playSound]);

  const onPause = useCallback(() => setIsPaused(true), []);
  const onResume = useCallback(() => setIsPaused(false), []);

  const onFinish = useCallback(() => {
    setTimerPhase('finished');
    setTimeLeft(0);
  }, []);

  const onSkipSetup = useCallback(() => {
    setTimerPhase('work');
    setTimeLeft(workPhaseTotalTime);
    playSound('start');
  }, [workPhaseTotalTime, playSound]);

  useEffect(() => {
    if (
      timerPhase !== 'setup' &&
      timerPhase !== 'work' &&
      timerPhase !== 'finished'
    ) {
      return;
    }
    if (isPaused) return;

    const interval = window.setInterval(() => {
      if (timerPhase === 'setup') {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setTimerPhase('work');
            setTimeLeft(workPhaseTotalTime);
            playSound('start');
            return workPhaseTotalTime;
          }
          return prev - 1;
        });
      } else if (timerPhase === 'work') {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setTimerPhase('finished');
            playSound('finish');
            return 0;
          }
          if (prev <= 11 && prev > 1) playSound('warning');
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timerPhase, isPaused, workPhaseTotalTime, playSound]);

  const timerStyle = getTimerStyles(timerPhase);
  const sortedElapsed = [...elapsedAtRounds].sort((a, b) => a - b);
  const splits: number[] = [];
  for (let i = 0; i < sortedElapsed.length; i++) {
    splits.push(
      i === 0 ? sortedElapsed[0]! : sortedElapsed[i]! - sortedElapsed[i - 1]!
    );
  }

  const displayLabel =
    timerPhase === 'waiting'
      ? 'AMRAP Duration'
      : timerPhase === 'setup'
        ? 'Preparation'
        : timerPhase === 'finished'
          ? 'Complete'
          : 'Time Remaining';
  const displayTitle =
    timerPhase === 'waiting' ? 'Get Ready' : timerStyle.text;
  const displaySub = timerPhase === 'waiting' ? undefined : timerStyle.sub;
  const displayValue =
    timerPhase === 'waiting' ? formatTime(totalTime) : formatTime(timeLeft);

  return {
    timerPhase,
    currentTimeFormatted: formatTime(timeLeft),
    displayLabel,
    displayTitle,
    displaySub,
    displayValue,
    beforeCountdownWindow: false,

    onLogRound,
    onPause,
    onResume,
    onFinish,
    onSkipSetup,
    onStartSetup,

    myRounds: rounds,
    logRoundError: null,
    isPaused: isPaused,

    participants: [
      {
        id: 'solo',
        name: 'You',
        rounds,
        splits,
        isMe: true,
      },
    ],

    isHost: true,
    sessionMode: 'solo',

    workoutList,

    loading: false,
    error: null,
  };
}
