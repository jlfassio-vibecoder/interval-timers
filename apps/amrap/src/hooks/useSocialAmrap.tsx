/**
 * Social AMRAP adapter hook. Returns AmrapSessionEngine for use with AmrapSessionShell.
 * Composes useAmrapSession, useSessionState, useAgoraChannel.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { trackEvent } from '@interval-timers/analytics';
import { supabase } from '@/lib/supabase';
import {
  useAmrapSession,
  getStoredHostToken,
  setStoredGuestClaimToken,
  setStoredParticipantId,
} from '@/hooks/useAmrapSession';
import { useAmrapAuth } from '@/contexts/AmrapAuthContext';
import { useSessionState } from '@/hooks/useSessionState';
import { useAgoraChannel } from '@/hooks/useAgoraChannel';
import { HUD_REDIRECT_URL } from '@/lib/account-redirect-url';
import { buildRecoveryUrl } from '@/lib/recovery-url';
import {
  withLockRetry,
  isLockAbortError,
  isLockAbortInResult,
} from '@/lib/lock-retry';
import { getWorkoutTitle } from '@/lib/workoutLabel';
import {
  buildResultsText,
  buildTrainerClassResultsText,
  computeVolumeLines,
  formatCompactVolumeSummary,
  type AmrapSessionResultsParticipantRow,
} from '@/lib/workoutResults';
import {
  formatTime,
  formatScheduledAt,
  getTimerStyles,
  buildLeaderboard,
  buildSplitRecordsForSegment,
  computeElapsedSecForLogRound,
} from '@/lib/socialAmrapUtils';
import type { AmrapParticipantRow } from '@/lib/supabase';
import type {
  AmrapSessionEngine,
  AmrapParticipantEngine,
  AmrapTimerPhase,
} from '@/types/amrap-session';
import SessionMessageBoard from '@/components/SessionMessageBoard';
import SessionMessageBoardDrawer from '@/components/SessionMessageBoardDrawer';
import VideoTile from '@/components/VideoTile';
import AmrapLeaderboardSection from '@/components/amrap-session/AmrapLeaderboardSection';
import { useSocialAmrapEffects } from '@/hooks/useSocialAmrapEffects';

const COUNTDOWN_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/** Dedupe concurrent Trainer Live embed auto-join for the same AMRAP session (e.g. React Strict Mode). */
const trainerLiveAmrapAutoJoinBySession = new Map<string, Promise<void>>();

export interface UseSocialAmrapOptions {
  /** Called when user dismisses the post-workout recap; keeps them in the live session */
  onDismissFinishedRecap?: () => void;
  /** When true, finished-state controls and round counts are hidden (ready for next workout) */
  recapDismissed?: boolean;
  /** Optional guest gate intercept for "View in History" actions. Return true to stop default behavior. */
  onAttemptViewHistory?: () => boolean;
  /** Optional guest gate intercept for opening results. Return true to stop default behavior. */
  onAttemptViewResults?: () => boolean;
  /**
   * When true, do not initialize Agora for the AMRAP session channel (e.g. Trainer Live embed
   * provides video separately).
   */
  skipAgora?: boolean;
  /**
   * When true, render the message board in a right-edge collapsible rail (Trainer Live embed).
   */
  collapsibleMessageBoard?: boolean;
  /** Initial open state for the message board rail when `collapsibleMessageBoard` is true. */
  messageBoardDrawerDefaultOpen?: boolean;
  /** When true, omit the AMRAP message board from the shell (e.g. Trainer Live room chat). */
  hideMessageBoard?: boolean;
  /**
   * When true, render Who's Here in `slots.sessionDrawer` instead of `slots.beforeLeaderboard`
   * (Trainer Live Session rail consumes `sessionDrawer`).
   */
  whosHereInSessionDrawer?: boolean;
  /**
   * When true, put host exercise actions (New Workout, Daily Warmup, etc.) in `slots.hostNavActions`
   * instead of `slots.exerciseHeader` (Trainer Live main nav consumes `hostNavActions`).
   */
  trainerLiveHostNavActions?: boolean;
  /**
   * When true, expose `slots.chatDrawerLeaderboard` for Trainer Live chat drawer (embed only).
   */
  trainerLiveChatDrawerLeaderboard?: boolean;
  /**
   * Trainer Live embed: auto `join_session` with this nickname when the user has no stored AMRAP
   * participant and is not the host (so clients can log rounds without the standalone join UI).
   */
  trainerLiveJoinNickname?: string;
}

export function useSocialAmrap(
  sessionId: string | null | undefined,
  options?: UseSocialAmrapOptions
): AmrapSessionEngine & {
  /** Additional state for page chrome (header, copy link, auth buttons) */
  pageState: {
    session: ReturnType<typeof useAmrapSession>['session'];
    participantId: string | null | undefined;
    hostToken: string | null;
    isHost: boolean;
    participants: AmrapParticipantRow[];
    joinNickname: string;
    setJoinNickname: (v: string) => void;
    joinError: string | null;
    joinLoading: boolean;
    handleJoinSession: () => Promise<void>;
    whosHereCollapsed: boolean;
    setWhosHereCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
    copyToast: 'success' | 'error' | null;
    copyShareLink: () => Promise<void>;
    copyResults: () => Promise<void>;
    showViewResultsModal: boolean;
    viewResultsText: string;
    handleOpenViewResults: () => void;
    handleCloseViewResults: () => void;
    copyResultsToast: 'success' | 'error' | null;
    roundDurations: number[];
    user: ReturnType<typeof useAmrapAuth>['user'];
    agoraError: string | null;
    joined: boolean;
    localVideoTrack: ReturnType<typeof useAgoraChannel>['localVideoTrack'];
    remoteUsers: ReturnType<typeof useAgoraChannel>['remoteUsers'];
    hostParticipant: AmrapParticipantRow | undefined;
    handleOpenNewWorkoutModal: () => Promise<void>;
    handleCloseNewWorkoutModal: () => Promise<void>;
    handleNewWorkoutSelect: (
      workoutList: string[],
      durationMinutes: number
    ) => Promise<void>;
    handleOpenWarmupOverlay: () => Promise<void>;
    handleCloseWarmupOverlay: () => Promise<void>;
    handleStartWarmup: () => Promise<void>;
    /** Called when host completes warmup overlay timer; persists to training log for all participants. */
    handleWarmupComplete: (durationSec: number) => void;
    /** Recovery PWA URL for desktop-to-phone QR flow when finished */
    recoveryUrl: string | null;
    showRecoveryQrModal: boolean;
    handleOpenRecoveryQr: () => void;
    handleCloseRecoveryQr: () => void;
    showFreeWorkoutModal: boolean;
    handleOpenFreeWorkoutModal: () => void;
    handleCloseFreeWorkoutModal: () => void;
    startFreeWorkout: (durationSec: number) => Promise<boolean>;
    /** When Agora is connected, camera/mic can be toggled (privacy / bandwidth). */
    localCameraOff: boolean;
    localMicMuted: boolean;
    toggleLocalCamera: () => void;
    toggleLocalMic: () => void;
    sessionResultsParticipantRows: AmrapSessionResultsParticipantRow[];
  };
} {
  const { user, loading: authLoading } = useAmrapAuth();
  const effectiveSessionId =
    sessionId === null || sessionId === undefined ? undefined : sessionId;
  const {
    session,
    participants,
    rounds,
    isHost,
    participantId,
    error,
    loading,
    refetch,
  } = useAmrapSession(effectiveSessionId, {
    // Defer session fetch and realtime until auth has settled to avoid navigator.locks
    // contention (getSession vs onAuthStateChange) when user is logged in.
    startFetch: !authLoading,
  });
  const hostToken = sessionId ? getStoredHostToken(sessionId) : null;
  const sessionState = useSessionState(
    effectiveSessionId,
    session,
    isHost,
    hostToken
  );
  const {
    joined,
    localVideoTrack,
    remoteUsers,
    error: agoraError,
    muteVideo,
    muteAudio,
  } = useAgoraChannel(sessionId ?? '', participantId ?? null, {
    disabled: options?.skipAgora === true,
  });

  const [localCameraOff, setLocalCameraOff] = useState(false);
  const [localMicMuted, setLocalMicMuted] = useState(false);

  useEffect(() => {
    if (!joined) {
      setLocalCameraOff(false);
      setLocalMicMuted(false);
    }
  }, [joined]);

  const toggleLocalCamera = useCallback(() => {
    setLocalCameraOff((prev) => {
      const next = !prev;
      muteVideo(next);
      return next;
    });
  }, [muteVideo]);

  const toggleLocalMic = useCallback(() => {
    setLocalMicMuted((prev) => {
      const next = !prev;
      muteAudio(next);
      return next;
    });
  }, [muteAudio]);

  const {
    timeLeft,
    totalTime,
    timerState,
    isPaused,
    pushState,
    setIsPaused,
    skipSetup,
    finish,
    startSetup,
    startFreeWorkout,
  } = sessionState;

  const [logRoundError, setLogRoundError] = useState<string | null>(null);
  const [joinNickname, setJoinNickname] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const [whosHereCollapsed, setWhosHereCollapsed] = useState(false);
  const [copyToast, setCopyToast] = useState<'success' | 'error' | null>(null);
  /** Same reference whenever we need “no rounds” so downstream useMemos stay stable. */
  const emptyRoundsForDisplayRef = useRef<typeof rounds>([]);
  const copyToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copyResultsToast, setCopyResultsToast] = useState<'success' | 'error' | null>(null);
  const copyResultsToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showViewResultsModal, setShowViewResultsModal] = useState(false);
  const [viewResultsText, setViewResultsText] = useState('');
  const [showRecoveryQrModal, setShowRecoveryQrModal] = useState(false);
  const [showFreeWorkoutModal, setShowFreeWorkoutModal] = useState(false);

  const { animatingIds, countdownSeconds, now } = useSocialAmrapEffects({
    participants,
    timerState,
    session,
    isHost,
    sessionId: sessionId ?? undefined,
    participantId: participantId ?? null,
    rounds,
    totalTime,
    user: user ?? null,
    startSetup,
  });

  const handleJoinSession = useCallback(async () => {
    const name = joinNickname.trim();
    if (!name) {
      setJoinError('Enter your name or a nickname');
      return;
    }
    if (!sessionId) return;
    setJoinLoading(true);
    setJoinError(null);
    let data: unknown;
    let joinErr: { message?: string } | null = null;
    try {
      const res = await withLockRetry(() =>
        supabase.rpc('join_session', {
          p_session_id: sessionId,
          p_nickname: name,
          p_user_id: user?.id ?? null,
        })
      );
      data = res.data;
      joinErr = res.error ?? null;
    } catch (e) {
      setJoinLoading(false);
      setJoinError(
        isLockAbortError(e)
          ? 'Join was interrupted. Please try again.'
          : e instanceof Error
            ? e.message
            : 'Something went wrong. Please try again.'
      );
      return;
    }
    setJoinLoading(false);
    if (joinErr) {
      setJoinError(
        isLockAbortInResult({ error: joinErr })
          ? 'Join was interrupted. Please try again.'
          : joinErr.message ?? 'Something went wrong.'
      );
      return;
    }
    const result = data as { participant_id: string; claim_token?: string | null };
    setStoredParticipantId(sessionId, result.participant_id);
    if (typeof result.claim_token === 'string' && result.claim_token.trim()) {
      setStoredGuestClaimToken(sessionId, result.claim_token.trim());
    }
    await refetch();
  }, [sessionId, joinNickname, refetch, user?.id]);

  const trainerLiveJoinNickname = options?.trainerLiveJoinNickname;

  useEffect(() => {
    const nick = trainerLiveJoinNickname?.trim();
    if (!nick || !effectiveSessionId || authLoading) return;
    if (participantId || hostToken) return;

    const sid = effectiveSessionId;
    const existing = trainerLiveAmrapAutoJoinBySession.get(sid);
    if (existing) {
      void existing.then(() => refetch());
      return;
    }

    const p = (async () => {
      try {
        const res = await withLockRetry(() =>
          supabase.rpc('join_session', {
            p_session_id: sid,
            p_nickname: nick,
            p_user_id: user?.id ?? null,
          })
        );
        if (res.error) {
          setJoinError(
            isLockAbortInResult({ error: res.error })
              ? 'Join was interrupted. Please try again.'
              : res.error.message ?? 'Could not join this AMRAP session.'
          );
          return;
        }
        const data = res.data as { participant_id?: string; claim_token?: string | null } | null;
        const pid = data?.participant_id;
        if (!pid) {
          setJoinError('Join failed');
          return;
        }
        setStoredParticipantId(sid, pid);
        if (typeof data?.claim_token === 'string' && data.claim_token.trim()) {
          setStoredGuestClaimToken(sid, data.claim_token.trim());
        }
        await refetch();
      } catch (e) {
        setJoinError(
          isLockAbortError(e)
            ? 'Join was interrupted. Please try again.'
            : e instanceof Error
              ? e.message
              : 'Something went wrong.'
        );
      } finally {
        trainerLiveAmrapAutoJoinBySession.delete(sid);
      }
    })();

    trainerLiveAmrapAutoJoinBySession.set(sid, p);
    void p;
  }, [
    trainerLiveJoinNickname,
    effectiveSessionId,
    authLoading,
    participantId,
    hostToken,
    user?.id,
    refetch,
  ]);

  const handleOpenNewWorkoutModal = useCallback(async () => {
    if (!sessionId || !hostToken || !isHost) return;
    await supabase.rpc('set_new_workout_modal', {
      p_session_id: sessionId,
      p_host_token: hostToken,
      p_open: true,
    });
  }, [sessionId, hostToken, isHost]);

  const handleCloseNewWorkoutModal = useCallback(async () => {
    if (!sessionId || !hostToken || !isHost) return;
    await supabase.rpc('set_new_workout_modal', {
      p_session_id: sessionId,
      p_host_token: hostToken,
      p_open: false,
    });
  }, [sessionId, hostToken, isHost]);

  const handleOpenWarmupOverlay = useCallback(async () => {
    if (!sessionId || !hostToken || !isHost) return;
    await supabase.rpc('set_warmup_overlay', {
      p_session_id: sessionId,
      p_host_token: hostToken,
      p_open: true,
    });
  }, [sessionId, hostToken, isHost]);

  const handleCloseWarmupOverlay = useCallback(async () => {
    if (!sessionId || !hostToken || !isHost) return;
    await supabase.rpc('set_warmup_overlay', {
      p_session_id: sessionId,
      p_host_token: hostToken,
      p_open: false,
    });
  }, [sessionId, hostToken, isHost]);

  const handleStartWarmup = useCallback(async () => {
    if (!sessionId || !hostToken || !isHost) return;
    await supabase.rpc('start_warmup', {
      p_session_id: sessionId,
      p_host_token: hostToken,
    });
  }, [sessionId, hostToken, isHost]);

  const handleWarmupComplete = useCallback(
    (durationSec: number) => {
      if (!sessionId || !hostToken || !isHost) return;
      trackEvent(supabase, 'timer_session_complete', {
        source: 'amrap_friends_warmup',
        duration_seconds: durationSec,
      }, { appId: 'amrap' });
      void supabase.rpc('persist_amrap_warmup_completion', {
        p_session_id: sessionId,
        p_host_token: hostToken,
        p_duration_sec: durationSec,
      });
    },
    [sessionId, hostToken, isHost]
  );

  const handleNewWorkoutSelect = useCallback(
    async (workoutList: string[], durationMinutes: number) => {
      if (!sessionId || !hostToken || !isHost) return;
      const { data } = await supabase.rpc('update_session_workout', {
        p_session_id: sessionId,
        p_host_token: hostToken,
        p_workout_list: workoutList,
        p_duration_minutes: durationMinutes,
      });
      if (data !== 1) return;
      await supabase.rpc('set_new_workout_modal', {
        p_session_id: sessionId,
        p_host_token: hostToken,
        p_open: false,
      });
      if (timerState === 'setup' || timerState === 'work' || timerState === 'finished') {
        startSetup();
      }
    },
    [sessionId, hostToken, isHost, timerState, startSetup]
  );

  /** In-place list update only (no startSetup / modal). Not used in `finished`: update_session_workout bumps segment_index when state is finished. */
  const saveWorkoutListInPlace = useCallback(
    async (nextList: string[]): Promise<{ ok: boolean; error?: string }> => {
      if (!sessionId || !hostToken || !isHost) {
        return { ok: false, error: 'Only the host can update the workout.' };
      }
      if (
        timerState !== 'waiting' &&
        timerState !== 'setup' &&
        timerState !== 'work'
      ) {
        return {
          ok: false,
          error: 'Workout can only be edited before the round ends.',
        };
      }
      if (timerState === 'work' && session?.timer_segment === 'free_workout') {
        return { ok: false, error: 'Not available during this segment.' };
      }
      const dm = session?.duration_minutes;
      if (dm == null || !Number.isInteger(dm) || dm < 1 || dm > 180) {
        return { ok: false, error: 'Invalid session duration.' };
      }
      if (!Array.isArray(nextList) || nextList.length < 1) {
        return { ok: false, error: 'Add at least one exercise.' };
      }
      const trimmed = nextList.map((s) => (typeof s === 'string' ? s.trim() : ''));
      if (!trimmed.every((s) => s.length > 0)) {
        return { ok: false, error: 'Each exercise must be non-empty.' };
      }
      const { data, error: rpcError } = await supabase.rpc('update_session_workout', {
        p_session_id: sessionId,
        p_host_token: hostToken,
        p_workout_list: trimmed,
        p_duration_minutes: dm,
      });
      if (rpcError) {
        return { ok: false, error: rpcError.message };
      }
      if (data !== 1) {
        return { ok: false, error: 'Update failed.' };
      }
      return { ok: true };
    },
    [sessionId, hostToken, isHost, timerState, session?.duration_minutes, session?.timer_segment]
  );

  const currentSegmentIndex = session?.segment_index ?? 0;
  const participantRoundCountInSegment = useMemo(
    () =>
      participantId
        ? rounds.filter(
            (r) =>
              r.participant_id === participantId &&
              (r.segment_index ?? 0) === currentSegmentIndex
          ).length
        : 0,
    [rounds, participantId, currentSegmentIndex]
  );

  const logRound = useCallback(async () => {
    if (!sessionId || !participantId || timerState !== 'work') return false;
    setLogRoundError(null);
    const elapsedSec = computeElapsedSecForLogRound({
      totalTime,
      timeLeft,
      timerState,
      isPaused,
      session,
      participantRoundCountInSegment,
    });
    const { error: logErr } = await supabase.rpc('log_round', {
      p_session_id: sessionId,
      p_participant_id: participantId,
      p_elapsed_sec_at_round: elapsedSec,
    });
    if (logErr) {
      setLogRoundError(logErr.message);
      return false;
    }
    return true;
  }, [
    sessionId,
    participantId,
    timerState,
    totalTime,
    timeLeft,
    isPaused,
    session,
    participantRoundCountInSegment,
  ]);

  const copyShareLink = useCallback(async () => {
    if (copyToastTimeoutRef.current) {
      clearTimeout(copyToastTimeoutRef.current);
      copyToastTimeoutRef.current = null;
    }
    try {
      const url = window.location.href.replace(/\?.*$/, '');
      await navigator.clipboard.writeText(url);
      setCopyToast('success');
    } catch {
      setCopyToast('error');
    }
    copyToastTimeoutRef.current = setTimeout(() => {
      copyToastTimeoutRef.current = null;
      setCopyToast(null);
    }, 2500);
  }, []);

  const getResultsText = useCallback(
    (opts?: { forCopy?: boolean }) => {
      const duration = session?.duration_minutes ?? 15;
      const workoutListLocal = session?.workout_list ?? [];
      const sessionUrl = window.location.href.replace(/\?.*$/, '');
      const workoutTitle = getWorkoutTitle(workoutListLocal);

      if (isHost) {
        const hp = participants.find((p) => p.role === 'host');
        const lb = buildLeaderboard(participants, rounds);
        const roster = lb.map((row) => ({
          participantId: row.participantId,
          nickname: row.nickname,
          isHostParticipant: row.participantId === hp?.id,
          roundCount: row.totalRounds,
        }));
        return buildTrainerClassResultsText(
          workoutListLocal,
          duration,
          sessionUrl,
          roster,
          workoutTitle,
          { forCopy: opts?.forCopy === true }
        );
      }

      const myRoundsData = participantId
        ? rounds
            .filter((r) => r.participant_id === participantId)
            .sort((a, b) => a.round_index - b.round_index)
        : [];
      const myRoundsCount = myRoundsData.length;
      const splits = myRoundsData.map((r) => r.elapsed_sec_at_round);
      const volumeLines = computeVolumeLines(workoutListLocal, myRoundsCount);
      const compact = opts?.forCopy === true && volumeLines.length > 6;
      return buildResultsText(workoutListLocal, myRoundsCount, duration, sessionUrl, {
        workoutTitle,
        compact,
        splits,
      });
    },
    [
      session?.duration_minutes,
      session?.workout_list,
      participantId,
      rounds,
      isHost,
      participants,
    ]
  );

  const copyResults = useCallback(async () => {
    if (copyResultsToastTimeoutRef.current) {
      clearTimeout(copyResultsToastTimeoutRef.current);
      copyResultsToastTimeoutRef.current = null;
    }
    const text = getResultsText({ forCopy: true });
    try {
      await navigator.clipboard.writeText(text);
      setCopyResultsToast('success');
    } catch {
      setCopyResultsToast('error');
    }
    copyResultsToastTimeoutRef.current = setTimeout(() => {
      copyResultsToastTimeoutRef.current = null;
      setCopyResultsToast(null);
    }, 2500);
  }, [getResultsText]);

  const handleOpenViewResults = useCallback(() => {
    setViewResultsText(getResultsText({ forCopy: false }));
    setShowViewResultsModal(true);
  }, [getResultsText]);

  const handleCloseViewResults = useCallback(() => {
    setShowViewResultsModal(false);
  }, []);

  useEffect(() => {
    return () => {
      if (copyToastTimeoutRef.current) {
        clearTimeout(copyToastTimeoutRef.current);
        copyToastTimeoutRef.current = null;
      }
      if (copyResultsToastTimeoutRef.current) {
        clearTimeout(copyResultsToastTimeoutRef.current);
        copyResultsToastTimeoutRef.current = null;
      }
    };
  }, []);

  const workoutList = session?.workout_list ?? [];
  const sessionResultsParticipantRows: AmrapSessionResultsParticipantRow[] = useMemo(() => {
    const hp = participants.find((p) => p.role === 'host');
    const lb = buildLeaderboard(participants, rounds);
    return lb.map((row) => ({
      participantId: row.participantId,
      nickname: row.nickname,
      isHostParticipant: row.participantId === hp?.id,
      roundCount: row.totalRounds,
      volumeSummary: formatCompactVolumeSummary(workoutList, row.totalRounds),
    }));
  }, [participants, rounds, workoutList]);
  const myRounds = participantId
    ? rounds.filter((r) => r.participant_id === participantId)
    : [];
  const myRoundsData = participantId
    ? rounds
        .filter((r) => r.participant_id === participantId)
        .sort((a, b) => a.round_index - b.round_index)
    : [];
  const elapsed = myRoundsData.map((r) => r.elapsed_sec_at_round);
  const roundDurations = elapsed.map((e, i) =>
    i === 0 ? e : e - (elapsed[i - 1] ?? 0)
  );
  const recapDismissed = options?.recapDismissed ?? false;
  // When recap dismissed, clear round display for next workout segment
  const roundsForDisplay =
    recapDismissed && timerState === 'finished'
      ? emptyRoundsForDisplayRef.current
      : rounds;
  const leaderboard = useMemo(
    () => buildLeaderboard(participants, roundsForDisplay),
    [participants, roundsForDisplay]
  );
  const segmentIndexForSplits = session?.segment_index ?? 0;
  const allUsersSplitRecords = useMemo(
    () => buildSplitRecordsForSegment(participants, roundsForDisplay, segmentIndexForSplits),
    [participants, roundsForDisplay, segmentIndexForSplits]
  );
  const hostParticipant = participants.find((p) => p.role === 'host');

  const timerStyle = getTimerStyles(timerState);
  const isFreeWorkoutWork =
    timerState === 'work' && session?.timer_segment === 'free_workout';
  const scheduledStartAt = session?.scheduled_start_at ?? null;
  const startAt = scheduledStartAt ? new Date(scheduledStartAt).getTime() : 0;
  const inCountdownWindow =
    timerState === 'waiting' &&
    scheduledStartAt &&
    now >= startAt - COUNTDOWN_WINDOW_MS &&
    now < startAt;
  const scheduledTimePassed =
    timerState === 'waiting' && !!scheduledStartAt && now >= startAt;
  const beforeCountdownWindow =
    timerState === 'waiting' && !!scheduledStartAt && now < startAt - COUNTDOWN_WINDOW_MS;

  const waitingScheduleDisplay =
    timerState === 'waiting' && scheduledStartAt
      ? scheduledTimePassed
        ? {
            label: 'Time Remaining',
            title: 'Ready',
            sub: 'Scheduled time passed — start when ready',
            value: formatTime(timeLeft),
          }
        : inCountdownWindow
          ? {
              label: 'Starts in',
              title: 'Starts in',
              sub: '',
              value: formatTime(countdownSeconds),
            }
          : beforeCountdownWindow
            ? {
                label: 'Scheduled',
                title: 'Scheduled for',
                sub: 'Countdown starts 10 minutes before start time.',
                value: formatScheduledAt(scheduledStartAt),
              }
            : null
      : null;

  const waitingPreStartDisplay =
    timerState === 'waiting' && (!scheduledStartAt || scheduledTimePassed)
      ? {
          label: 'AMRAP Duration',
          title: 'Get Ready',
          value: formatTime(totalTime),
          sub: undefined as string | undefined,
        }
      : null;

  const displayLabel =
    waitingPreStartDisplay?.label ??
    waitingScheduleDisplay?.label ??
    (timerState === 'setup'
      ? 'Setup'
      : timerState === 'finished'
        ? 'Complete'
        : 'Time Remaining');
  const displayTitle =
    waitingPreStartDisplay?.title ??
    waitingScheduleDisplay?.title ??
    (isFreeWorkoutWork ? 'Free workout' : timerStyle.text);
  const displaySub =
    waitingPreStartDisplay?.sub ??
    waitingScheduleDisplay?.sub ??
    (isFreeWorkoutWork ? 'Lead by example' : timerStyle.sub);
  const displayValue =
    waitingPreStartDisplay?.value ??
    waitingScheduleDisplay?.value ??
    formatTime(timeLeft);

  const hostCanEditWorkoutList =
    !!isHost &&
    !!hostToken &&
    !!effectiveSessionId &&
    (timerState === 'waiting' ||
      timerState === 'setup' ||
      timerState === 'work') &&
    !isFreeWorkoutWork;

  const participantsEngine: AmrapParticipantEngine[] = useMemo(
    () =>
      leaderboard.map((row) => {
        const isSelf = row.participantId === participantId;
        const isHostRow = row.participantId === hostParticipant?.id;
        const videoUser = remoteUsers.find(
          (u) => String(u.uid) === row.participantId
        );
        const videoTrack = isHostRow
          ? undefined
          : isSelf
            ? localVideoTrack ?? undefined
            : videoUser?.videoTrack;
        return {
          id: row.participantId,
          name: row.nickname,
          rounds: row.totalRounds,
          splits: row.splits,
          videoTrack: videoTrack ?? null,
          isMe: isSelf,
          isHost: isHostRow,
        };
      }),
    [leaderboard, participantId, hostParticipant?.id, remoteUsers, localVideoTrack]
  );

  const engine: AmrapSessionEngine = {
    timerPhase: timerState as AmrapTimerPhase,
    currentTimeFormatted: formatTime(timeLeft),
    displayLabel,
    displayTitle,
    displaySub,
    displayValue,
    beforeCountdownWindow: beforeCountdownWindow,

    onLogRound: logRound,
    onPause: isHost
      ? async () => {
          await pushState({
            state: timerState,
            time_left_sec: timeLeft,
            is_paused: true,
          });
          setIsPaused(true);
        }
      : undefined,
    onResume: isHost
      ? async () => {
          await pushState({
            state: timerState,
            time_left_sec: timeLeft,
            is_paused: false,
          });
          setIsPaused(false);
        }
      : undefined,
    onFinish: isHost ? finish : undefined,
    onSkipSetup: isHost && timerState === 'setup' ? skipSetup : undefined,
    onStartSetup: isHost && timerState === 'waiting' ? startSetup : undefined,

    myRounds: myRounds.length,
    logRoundError,
    isPaused: isPaused,

    participants: participantsEngine,

    isHost: !!isHost,
    sessionMode: 'live',

    workoutList,
    durationMinutes: session?.duration_minutes,
    celebrateFinish: true,
    recapDismissed: recapDismissed && timerState === 'finished',
    isFreeWorkoutSegment: isFreeWorkoutWork,

    hostCanEditWorkoutList,
    onSaveWorkoutList: hostCanEditWorkoutList ? saveWorkoutListInPlace : undefined,

    loading: loading,
    error: error ?? null,

    allUsersSplitRecords,
  };

  const beforeLeaderboardSlot = useMemo(
    () => (
    <section className="rounded-2xl border border-white/10 bg-black/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setWhosHereCollapsed((c) => !c)}
        className="flex w-full items-center justify-between gap-2 p-4 text-left transition-colors hover:bg-white/5"
        aria-expanded={!whosHereCollapsed}
      >
        <h3 className="text-sm font-bold uppercase tracking-wider text-white/90">
          Who&apos;s here{' '}
          <span className="font-normal text-white/60">({participants.length})</span>
        </h3>
        {whosHereCollapsed ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-white/60" aria-hidden />
        ) : (
          <ChevronUp className="h-4 w-4 shrink-0 text-white/60" aria-hidden />
        )}
      </button>
      {!whosHereCollapsed && (
        <div className="max-h-[28rem] overflow-y-auto border-t border-white/10 p-4">
          {!participantId && !isHost && (
            <div className="mb-3 rounded-xl border border-orange-500/30 bg-black/20 p-3">
              <p className="mb-2 text-xs text-white/80">
                Add your name to join and appear on the leaderboard.
              </p>
              <div className="flex flex-col gap-2">
                <label htmlFor="join-nickname" className="sr-only">
                  Your name or nickname
                </label>
                <input
                  id="join-nickname"
                  type="text"
                  value={joinNickname}
                  onChange={(e) => setJoinNickname(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-lg border border-white/20 bg-black/30 px-2.5 py-2 text-sm text-white placeholder:text-white/50 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  disabled={joinLoading}
                />
                <button
                  type="button"
                  onClick={handleJoinSession}
                  disabled={joinLoading || !joinNickname.trim()}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white shadow-[0_0_12px_rgba(234,88,12,0.3)] transition-all hover:bg-orange-500 disabled:opacity-50"
                >
                  {joinLoading ? 'Joining…' : 'Join'}
                </button>
              </div>
              {joinError && (
                <p className="mt-1.5 text-xs text-red-400">{joinError}</p>
              )}
            </div>
          )}
          <ul className="flex flex-col gap-2">
            {participants.map((p) => (
              <li
                key={p.id}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                  animatingIds.has(p.id)
                    ? 'animate-participant-enter border-orange-500/50 bg-orange-500/10 shadow-[0_0_16px_rgba(234,88,12,0.4)]'
                    : 'border-white/10 bg-black/20'
                }`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white/90">
                  {(p.nickname || '?').slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-white">
                  {p.nickname}
                </span>
                {p.role === 'host' && (
                  <span className="shrink-0 rounded bg-orange-600/30 px-1.5 py-0.5 text-[10px] font-bold uppercase text-orange-300">
                    Host
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
    ),
    [
      participants,
      whosHereCollapsed,
      participantId,
      isHost,
      joinNickname,
      joinLoading,
      joinError,
      animatingIds,
      handleJoinSession,
    ]
  );

  const messageBoard =
    sessionId && !options?.hideMessageBoard ? (
      <SessionMessageBoard
        sessionId={sessionId}
        participantId={participantId}
        participants={participants}
        isFinished={timerState === 'finished'}
        className={options?.collapsibleMessageBoard ? 'lg:static' : undefined}
      />
    ) : null;

  const rightColumnSlot =
    sessionId && !options?.hideMessageBoard ? (
      options?.collapsibleMessageBoard ? (
        <SessionMessageBoardDrawer
          sessionId={sessionId}
          defaultOpen={options?.messageBoardDrawerDefaultOpen === true}
        >
          {messageBoard}
        </SessionMessageBoardDrawer>
      ) : (
        messageBoard
      )
    ) : null;

  const recoveryUrl =
    timerState === 'finished' && session && sessionId
      ? buildRecoveryUrl(
          sessionId,
          session.started_at
            ? new Date(session.started_at).getTime() +
                session.duration_minutes * 60 * 1000
            : now - 15000
        )
      : null;

  const onDismissFinishedRecap = options?.onDismissFinishedRecap;

  const finishedActionsSlot =
    timerState === 'finished' && !recapDismissed ? (
      <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6">
        <div className="flex flex-wrap gap-3">
          {onDismissFinishedRecap ? (
            <button
              type="button"
              onClick={onDismissFinishedRecap}
              className="flex-1 min-w-[8rem] rounded-xl border-2 border-orange-500 bg-orange-600 px-4 py-3 font-bold text-white transition-colors hover:bg-orange-500"
            >
              Continue
            </button>
          ) : (
            <Link
              to="/with-friends"
              className="flex-1 min-w-[8rem] rounded-xl border-2 border-orange-500 bg-orange-600 px-4 py-3 text-center font-bold text-white transition-colors hover:bg-orange-500"
            >
              Done
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              if (options?.onAttemptViewHistory?.()) return;
              window.open(HUD_REDIRECT_URL, '_blank', 'noopener,noreferrer');
            }}
            className="flex-1 min-w-[8rem] rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-center font-bold text-white transition-colors hover:bg-white/20"
          >
            View in History
          </button>
          <button
            type="button"
            onClick={() => {
              if (options?.onAttemptViewResults?.()) return;
              handleOpenViewResults();
            }}
            className="flex-1 min-w-[8rem] rounded-xl border border-white/20 bg-white/10 px-4 py-3 font-bold text-white transition-colors hover:bg-white/20"
          >
            View results
          </button>
          <button
            type="button"
            onClick={copyResults}
            className="flex-1 min-w-[8rem] rounded-xl border border-white/20 bg-white/10 px-4 py-3 font-bold text-white transition-colors hover:bg-white/20"
          >
            Copy results
          </button>
          {recoveryUrl && (
            <button
              type="button"
              onClick={() => setShowRecoveryQrModal(true)}
              className="flex-1 min-w-[8rem] rounded-xl border border-white/20 bg-white/10 px-4 py-3 font-bold text-white transition-colors hover:bg-white/20"
            >
              Continue on phone
            </button>
          )}
        </div>
        {copyResultsToast && (
          <p
            role="status"
            aria-live="polite"
            className={`text-sm font-medium ${
              copyResultsToast === 'success' ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {copyResultsToast === 'success' ? 'Copied to clipboard!' : 'Failed to copy'}
          </p>
        )}
      </div>
    ) : null;

  const hostLivestreamSlot =
    (timerState === 'waiting' ||
      timerState === 'setup' ||
      timerState === 'work' ||
      timerState === 'finished') &&
    !agoraError &&
    joined &&
    hostParticipant
      ? (() => {
          const hostRemote = remoteUsers.find(
            (u) => String(u.uid) === hostParticipant.id
          );
          const hostTrack = isHost
            ? localVideoTrack
            : hostRemote?.videoTrack;
          if (!hostTrack) return null;
          return (
            <div className="mt-4 min-h-[10rem] overflow-hidden rounded-2xl border border-white/10 bg-black/30">
              <VideoTile
                key={session?.show_warmup_overlay ? 'warmup-open' : 'warmup-closed'}
                videoTrack={hostTrack}
                label="Host"
              />
            </div>
          );
        })()
      : null;

  const exerciseHeaderSlot = useMemo(
    () =>
      isHost &&
      (timerState === 'waiting' ||
        timerState === 'setup' ||
        timerState === 'work' ||
        timerState === 'finished')
        ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleOpenNewWorkoutModal}
                className="rounded-xl border border-orange-500/50 bg-orange-600/20 px-4 py-2 text-sm font-bold text-orange-300 transition-colors hover:border-orange-500 hover:bg-orange-600/30"
              >
                New Workout
              </button>
              <button
                type="button"
                onClick={handleOpenWarmupOverlay}
                className="rounded-xl border border-orange-500/50 bg-orange-600/20 px-4 py-2 text-sm font-bold text-orange-300 transition-colors hover:border-orange-500 hover:bg-orange-600/30"
              >
                Daily Warmup
              </button>
              {timerState === 'finished' && recapDismissed && (
                <button
                  type="button"
                  onClick={() => setShowFreeWorkoutModal(true)}
                  className="rounded-xl border border-emerald-500/50 bg-emerald-600/20 px-4 py-2 text-sm font-bold text-emerald-200 transition-colors hover:border-emerald-500 hover:bg-emerald-600/30"
                >
                  Free workout timer
                </button>
              )}
            </div>
          )
        : null,
    [
      isHost,
      timerState,
      recapDismissed,
      handleOpenNewWorkoutModal,
      handleOpenWarmupOverlay,
    ]
  );

  const errorActionSlot = (
    <Link
      to="/with-friends"
      className="text-orange-400 hover:underline"
    >
      Back to AMRAP With Friends
    </Link>
  );

  const chatDrawerLeaderboardSlot = useMemo(
    () =>
      options?.trainerLiveChatDrawerLeaderboard === true ? (
        <AmrapLeaderboardSection
          participants={participantsEngine}
          variant="chatDrawer"
        />
      ) : null,
    [options?.trainerLiveChatDrawerLeaderboard, participantsEngine]
  );

  const engineWithSlots: AmrapSessionEngine = {
    ...engine,
    slots: {
      beforeLeaderboard: options?.whosHereInSessionDrawer
        ? undefined
        : beforeLeaderboardSlot,
      sessionDrawer: options?.whosHereInSessionDrawer
        ? beforeLeaderboardSlot
        : undefined,
      afterTimer: hostLivestreamSlot ?? undefined,
      rightColumn: rightColumnSlot ?? undefined,
      exerciseHeader: options?.trainerLiveHostNavActions
        ? undefined
        : exerciseHeaderSlot ?? undefined,
      hostNavActions: options?.trainerLiveHostNavActions
        ? exerciseHeaderSlot ?? undefined
        : undefined,
      chatDrawerLeaderboard: chatDrawerLeaderboardSlot ?? undefined,
      errorAction: errorActionSlot,
      finishedActions: finishedActionsSlot ?? undefined,
    },
  };

  const pageState = {
    session,
    participantId,
    hostToken,
    isHost,
    participants,
    joinNickname,
    setJoinNickname,
    joinError,
    joinLoading,
    handleJoinSession,
    whosHereCollapsed,
    setWhosHereCollapsed,
    copyToast,
    copyShareLink,
    copyResults,
    showViewResultsModal,
    viewResultsText,
    handleOpenViewResults,
    handleCloseViewResults,
    copyResultsToast,
    roundDurations,
    user,
    agoraError,
    joined,
    localVideoTrack,
    remoteUsers,
    hostParticipant,
    handleOpenNewWorkoutModal,
    handleCloseNewWorkoutModal,
    handleNewWorkoutSelect,
    handleOpenWarmupOverlay,
    handleCloseWarmupOverlay,
    handleStartWarmup,
    handleWarmupComplete,
    recoveryUrl,
    showRecoveryQrModal,
    handleOpenRecoveryQr: () => setShowRecoveryQrModal(true),
    handleCloseRecoveryQr: () => setShowRecoveryQrModal(false),
    showFreeWorkoutModal,
    handleOpenFreeWorkoutModal: () => setShowFreeWorkoutModal(true),
    handleCloseFreeWorkoutModal: () => setShowFreeWorkoutModal(false),
    startFreeWorkout,
    localCameraOff,
    localMicMuted,
    toggleLocalCamera,
    toggleLocalMic,
    sessionResultsParticipantRows,
  };

  return {
    ...engineWithSlots,
    pageState,
  } as AmrapSessionEngine & {
    pageState: typeof pageState;
  };
}
