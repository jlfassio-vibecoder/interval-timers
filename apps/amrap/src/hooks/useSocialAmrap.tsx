/**
 * Social AMRAP adapter hook. Returns AmrapSessionEngine for use with AmrapSessionShell.
 * Composes useAmrapSession, useSessionState, useAgoraChannel.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { trackEvent } from '@interval-timers/analytics';
import { supabase } from '@/lib/supabase';
import {
  useAmrapSession,
  getStoredHostToken,
  setStoredParticipantId,
} from '@/hooks/useAmrapSession';
import { useAmrapAuth } from '@/contexts/AmrapAuthContext';
import { useSessionState } from '@/hooks/useSessionState';
import { useAgoraChannel } from '@/hooks/useAgoraChannel';
import { getOrCreateAudioContext, playSoundWithContext } from '@/lib/amrapSounds';
import { HUD_REDIRECT_URL } from '@/lib/account-redirect-url';
import { saveGuestSessionResult } from '@/lib/guestSessionHistory';
import { getWorkoutTitle } from '@/lib/workoutLabel';
import { buildResultsText, computeVolumeLines } from '@/lib/workoutResults';
import type { AmrapRoundRow, AmrapParticipantRow } from '@/lib/supabase';
import type { SessionTimerState } from '@/hooks/useSessionState';
import type {
  AmrapSessionEngine,
  AmrapParticipantEngine,
  AmrapTimerPhase,
} from '@/types/amrap-session';
import SessionMessageBoard from '@/components/SessionMessageBoard';
import VideoTile from '@/components/VideoTile';

const COUNTDOWN_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const TIMER_COMPLETE_ROUNDS_GRACE_MS = 1500; // allow late round rows from realtime before analytics

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatScheduledAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function getTimerStyles(timerState: SessionTimerState) {
  switch (timerState) {
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

function buildLeaderboard(
  participants: AmrapParticipantRow[],
  rounds: AmrapRoundRow[]
): { participantId: string; nickname: string; totalRounds: number; splits: number[] }[] {
  const byParticipant = new Map<
    string,
    { nickname: string; elapsed: number[] }
  >();
  for (const p of participants) {
    byParticipant.set(p.id, { nickname: p.nickname, elapsed: [] });
  }
  for (const r of rounds) {
    const entry = byParticipant.get(r.participant_id);
    if (entry) {
      entry.elapsed.push(r.elapsed_sec_at_round);
    }
  }
  return Array.from(byParticipant.entries())
    .map(([participantId, { nickname, elapsed }]) => {
      elapsed.sort((a, b) => a - b);
      const splits: number[] = [];
      for (let i = 0; i < elapsed.length; i++) {
        splits.push(i === 0 ? elapsed[0]! : elapsed[i]! - elapsed[i - 1]!);
      }
      return {
        participantId,
        nickname,
        totalRounds: elapsed.length,
        splits,
      };
    })
    .sort((a, b) => b.totalRounds - a.totalRounds);
}

export function useSocialAmrap(
  sessionId: string | null | undefined
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
  };
} {
  const { user } = useAmrapAuth();
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
  } = useAmrapSession(effectiveSessionId);
  const hostToken = sessionId ? getStoredHostToken(sessionId) : null;
  const sessionState = useSessionState(
    effectiveSessionId,
    session,
    isHost,
    hostToken
  );
  const { joined, localVideoTrack, remoteUsers, error: agoraError } = useAgoraChannel(
    sessionId ?? '',
    participantId ?? null
  );

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
  } = sessionState;

  const [logRoundError, setLogRoundError] = useState<string | null>(null);
  const [joinNickname, setJoinNickname] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const [whosHereCollapsed, setWhosHereCollapsed] = useState(false);
  const [copyToast, setCopyToast] = useState<'success' | 'error' | null>(null);
  const copyToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copyResultsToast, setCopyResultsToast] = useState<'success' | 'error' | null>(null);
  const copyResultsToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showViewResultsModal, setShowViewResultsModal] = useState(false);
  const [viewResultsText, setViewResultsText] = useState('');
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set());
  const seenParticipantIdsRef = useRef<Set<string>>(new Set());
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const hasAutoStartedRef = useRef(false);
  const hasBeenBeforeScheduledRef = useRef(false);
  const finishSoundPlayedRef = useRef(false);
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
  }, [timerState, totalTime, participantId, rounds]);

  // Save guest result idempotently when finished; rounds may arrive late via realtime subscription.
  useEffect(() => {
    if (
      timerState === 'finished' &&
      !user &&
      sessionId &&
      participantId
    ) {
      const totalRounds = rounds.filter((r) => r.participant_id === participantId).length;
      saveGuestSessionResult(
        sessionId,
        participantId,
        totalRounds,
        session?.workout_list ?? [],
        session?.duration_minutes ?? 15,
        new Date().toISOString()
      );
    }
  }, [timerState, user, sessionId, participantId, rounds, session?.workout_list, session?.duration_minutes]);

  const handleJoinSession = useCallback(async () => {
    const name = joinNickname.trim();
    if (!name) {
      setJoinError('Enter your name or a nickname');
      return;
    }
    if (!sessionId) return;
    setJoinLoading(true);
    setJoinError(null);
    const { data, error: joinErr } = await supabase.rpc('join_session', {
      p_session_id: sessionId,
      p_nickname: name,
      p_user_id: user?.id ?? null,
    });
    setJoinLoading(false);
    if (joinErr) {
      setJoinError(joinErr.message);
      return;
    }
    const result = data as { participant_id: string };
    setStoredParticipantId(sessionId, result.participant_id);
    await refetch();
  }, [sessionId, joinNickname, refetch, user?.id]);

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
      if (timerState === 'setup' || timerState === 'work') {
        startSetup();
      }
    },
    [sessionId, hostToken, isHost, timerState, startSetup]
  );

  const logRound = useCallback(async () => {
    if (!sessionId || !participantId || timerState !== 'work') return;
    setLogRoundError(null);
    const elapsedSec = totalTime - timeLeft;
    const { error: logErr } = await supabase.rpc('log_round', {
      p_session_id: sessionId,
      p_participant_id: participantId,
      p_elapsed_sec_at_round: elapsedSec,
    });
    if (logErr) setLogRoundError(logErr.message);
  }, [sessionId, participantId, timerState, totalTime, timeLeft]);

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
      const myRoundsData = participantId
        ? rounds
            .filter((r) => r.participant_id === participantId)
            .sort((a, b) => a.round_index - b.round_index)
        : [];
      const myRoundsCount = myRoundsData.length;
      const splits = myRoundsData.map((r) => r.elapsed_sec_at_round);
      const workoutList = session?.workout_list ?? [];
      const sessionUrl = window.location.href.replace(/\?.*$/, '');
      const workoutTitle = getWorkoutTitle(workoutList);
      const volumeLines = computeVolumeLines(workoutList, myRoundsCount);
      const compact =
        opts?.forCopy === true && volumeLines.length > 6;
      return buildResultsText(workoutList, myRoundsCount, duration, sessionUrl, {
        workoutTitle,
        compact,
        splits,
      });
    },
    [session?.duration_minutes, session?.workout_list, participantId, rounds]
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
  const leaderboard = buildLeaderboard(participants, rounds);
  const hostParticipant = participants.find((p) => p.role === 'host');

  const timerStyle = getTimerStyles(timerState);
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
    timerStyle.text;
  const displaySub =
    waitingPreStartDisplay?.sub ??
    waitingScheduleDisplay?.sub ??
    timerStyle.sub;
  const displayValue =
    waitingPreStartDisplay?.value ??
    waitingScheduleDisplay?.value ??
    formatTime(timeLeft);

  const participantsEngine: AmrapParticipantEngine[] = leaderboard.map(
    (row) => {
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
    }
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

    loading: loading,
    error: error ?? null,
  };

  const beforeLeaderboardSlot = (
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
  );

  const rightColumnSlot = sessionId ? (
    <>
      <SessionMessageBoard
        sessionId={sessionId}
        participantId={participantId}
        participants={participants}
        isFinished={timerState === 'finished'}
      />
    </>
  ) : null;

  const finishedActionsSlot =
    timerState === 'finished' ? (
      <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6">
        <div className="flex flex-wrap gap-3">
          <Link
            to="/with-friends"
            className="flex-1 min-w-[8rem] rounded-xl border-2 border-orange-500 bg-orange-600 px-4 py-3 text-center font-bold text-white transition-colors hover:bg-orange-500"
          >
            Done
          </Link>
          <a
            href={HUD_REDIRECT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-[8rem] rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-center font-bold text-white transition-colors hover:bg-white/20"
          >
            View in History
          </a>
          <button
            type="button"
            onClick={handleOpenViewResults}
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
              <VideoTile videoTrack={hostTrack} label="Host" />
            </div>
          );
        })()
      : null;

  const exerciseHeaderSlot =
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
          </div>
        )
      : null;

  const errorActionSlot = (
    <Link
      to="/with-friends"
      className="text-orange-400 hover:underline"
    >
      Back to AMRAP With Friends
    </Link>
  );

  const engineWithSlots: AmrapSessionEngine = {
    ...engine,
    slots: {
      beforeLeaderboard: beforeLeaderboardSlot,
      afterTimer: hostLivestreamSlot ?? undefined,
      rightColumn: rightColumnSlot ?? undefined,
      exerciseHeader: exerciseHeaderSlot ?? undefined,
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
  };

  return {
    ...engineWithSlots,
    pageState,
  } as AmrapSessionEngine & {
    pageState: typeof pageState;
  };
}
