/**
 * AMRAP session engine types. Used by AmrapSessionShell and adapter hooks
 * (useSoloAmrap, useSocialAmrap) for unified Solo/Social views.
 */
import type { ReactNode } from 'react';

/** Video source: Agora track (live) or MediaStream (solo recording) */
export type AmrapVideoSource =
  | import('agora-rtc-sdk-ng').ICameraVideoTrack
  | import('agora-rtc-sdk-ng').IRemoteVideoTrack
  | MediaStream;

export type AmrapTimerPhase = 'waiting' | 'setup' | 'work' | 'finished';
export type AmrapSessionMode = 'solo' | 'live' | 'published';

export interface AmrapParticipantEngine {
  id: string;
  name: string;
  rounds: number;
  splits: number[];
  videoTrack?: AmrapVideoSource | null;
  isMe: boolean;
  isHost?: boolean;
}

export interface AmrapSessionEngine {
  timerPhase: AmrapTimerPhase;
  currentTimeFormatted: string;
  displayLabel: string;
  displayTitle: string;
  displaySub?: string;
  displayValue: string;
  /** When true, timer uses compact text (e.g. scheduled/countdown display) */
  beforeCountdownWindow?: boolean;

  onLogRound: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onFinish?: () => void;
  onSkipSetup?: () => void;
  onStartSetup?: () => void;

  myRounds: number;
  logRoundError: string | null;
  isPaused?: boolean;

  participants: AmrapParticipantEngine[];

  isHost: boolean;
  sessionMode: AmrapSessionMode;

  /** Optional slots for mode-specific UI (Who's Here, Message Board, etc.) */
  slots?: {
    beforeLeaderboard?: ReactNode;
    afterTimer?: ReactNode;
    rightColumn?: ReactNode;
    /** Content for exercise section header (e.g. New Workout button) */
    exerciseHeader?: ReactNode;
    /** Shown below error message when engine.error is set */
    errorAction?: ReactNode;
    /** Actions when timer is finished (e.g. Done, View in History, Copy results) */
    finishedActions?: ReactNode;
  };

  /** Workout config for ExerciseList */
  workoutList: string[];

  /** Duration in minutes (for finished-state summary) */
  durationMinutes?: number;

  /** Loading/error states */
  loading?: boolean;
  error?: string | null;
}
