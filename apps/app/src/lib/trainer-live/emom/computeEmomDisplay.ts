import { SETUP_DURATION_SECONDS } from '@interval-timers/timer-core';

export type EmomDerivedPhase = 'waiting' | 'setup' | 'working' | 'finished';

export interface EmomServerClock {
  phase: EmomDerivedPhase;
  /** Setup countdown seconds remaining (meaningful when phase is setup). */
  countdownRemaining: number;
  /** Seconds into the current minute during the main EMOM block (0–59). */
  secondsInMinute: number;
  /** 1-based minute index while in the main block. */
  roundIndex: number;
  totalRounds: number;
}

/** Logical elapsed ms since EMOM clock started, minus pauses (server `pause_accum_ms` + frozen `paused_at`). */
export function computeEmomLogicalElapsedMs(
  nowMs: number,
  startedAtIso: string | null,
  pausedAtIso: string | null,
  pauseAccumMs: number
): number | null {
  if (!startedAtIso) return null;
  const startMs = new Date(startedAtIso).getTime();
  if (!Number.isFinite(startMs)) return null;
  const anchorMs = pausedAtIso ? new Date(pausedAtIso).getTime() : nowMs;
  if (!Number.isFinite(anchorMs)) return null;
  return Math.max(0, anchorMs - startMs - pauseAccumMs);
}

/**
 * Derives EMOM UI state from `emom_sessions` timing (optional `started_at`, pause fields).
 * Prep is a single **setup** countdown (`SETUP_DURATION_SECONDS`, 10s) — not `emom_sessions.warmup_seconds`.
 */
export function computeEmomServerClock(
  nowMs: number,
  startedAtIso: string | null,
  pausedAtIso: string | null,
  pauseAccumMs: number,
  roundCount: number,
  status: 'active' | 'ended'
): EmomServerClock {
  if (status === 'ended') {
    return {
      phase: 'finished',
      countdownRemaining: 0,
      secondsInMinute: 0,
      roundIndex: roundCount,
      totalRounds: roundCount,
    };
  }

  if (!startedAtIso) {
    return {
      phase: 'waiting',
      countdownRemaining: 0,
      secondsInMinute: 0,
      roundIndex: 1,
      totalRounds: roundCount,
    };
  }

  const logicalMs = computeEmomLogicalElapsedMs(nowMs, startedAtIso, pausedAtIso, pauseAccumMs);
  if (logicalMs == null) {
    return {
      phase: 'waiting',
      countdownRemaining: 0,
      secondsInMinute: 0,
      roundIndex: 1,
      totalRounds: roundCount,
    };
  }

  const elapsedSec = Math.floor(logicalMs / 1000);

  if (elapsedSec < SETUP_DURATION_SECONDS) {
    return {
      phase: 'setup',
      countdownRemaining: SETUP_DURATION_SECONDS - elapsedSec,
      secondsInMinute: 0,
      roundIndex: 1,
      totalRounds: roundCount,
    };
  }

  const mainElapsed = elapsedSec - SETUP_DURATION_SECONDS;
  if (mainElapsed >= roundCount * 60) {
    return {
      phase: 'finished',
      countdownRemaining: 0,
      secondsInMinute: 0,
      roundIndex: roundCount,
      totalRounds: roundCount,
    };
  }

  const roundIndex = Math.floor(mainElapsed / 60) + 1;
  const secondsInMinute = mainElapsed % 60;

  return {
    phase: 'working',
    countdownRemaining: 0,
    secondsInMinute,
    roundIndex,
    totalRounds: roundCount,
  };
}

/** Progress 0–1 for the circular ring (setup uses setup countdown; work uses seconds in minute). */
export function emomRingProgress(
  phase: EmomDerivedPhase,
  setupDurationSeconds: number,
  countdownRemaining: number,
  secondsInMinute: number
): number {
  if (phase === 'setup') {
    if (setupDurationSeconds <= 0) return 0;
    return (setupDurationSeconds - countdownRemaining) / setupDurationSeconds;
  }
  if (phase === 'working') {
    return secondsInMinute / 60;
  }
  return 0;
}
