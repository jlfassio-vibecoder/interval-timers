/**
 * AMRAP session engine types. Used by AmrapSessionShell and adapter hooks
 * (useSoloAmrap, useSocialAmrap) for unified Solo/Social views.
 */
import type { ReactNode } from 'react';
import type { AmrapSplitRecord } from '@/lib/amrapSplitTypes';

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

  /** Return `false` on failure so UI can revert optimistic updates; void/`true` = success. */
  onLogRound: () => void | boolean | Promise<void | boolean | undefined>;
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
    /** Trainer Live embed: Who's Here / join UI in the left Session drawer (not leaderboard column). */
    sessionDrawer?: ReactNode;
    afterTimer?: ReactNode;
    rightColumn?: ReactNode;
    /** Content for exercise section header (e.g. New Workout button) */
    exerciseHeader?: ReactNode;
    /** Trainer Live embed: host actions (New Workout, Daily Warmup) rendered in main nav instead of exercise header */
    hostNavActions?: ReactNode;
    /** Trainer Live: AMRAP leaderboard panel for the chat drawer (below room chat). */
    chatDrawerLeaderboard?: ReactNode;
    /** Shown below error message when engine.error is set */
    errorAction?: ReactNode;
    /** Actions when timer is finished (e.g. Done, View in History, Copy results) */
    finishedActions?: ReactNode;
  };

  /** Workout config for ExerciseList */
  workoutList: string[];

  /** Duration in minutes (for finished-state summary) */
  durationMinutes?: number;

  /** When true, show visual celebration on transition to finished (Social only). */
  celebrateFinish?: boolean;

  /** When true, finished-state summary and actions are hidden (recap dismissed, ready for next workout). */
  recapDismissed?: boolean;

  /** Free-workout segment: hide LOG ROUND and show host-led copy instead of exercise list. */
  isFreeWorkoutSegment?: boolean;

  /** Host can edit workout lines in-place (social/live; not during finished — see onSaveWorkoutList). */
  hostCanEditWorkoutList?: boolean;
  /** Persist workout list without New Workout modal side effects; only when hostCanEditWorkoutList. */
  onSaveWorkoutList?: (
    workoutList: string[]
  ) => Promise<{ ok: boolean; error?: string }>;

  /** Loading/error states */
  loading?: boolean;
  error?: string | null;

  /** Logged rounds for every participant in the current segment (Trainer Live / shared UI). */
  allUsersSplitRecords?: AmrapSplitRecord[];
}
