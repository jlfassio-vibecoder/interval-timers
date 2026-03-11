import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AuthModal from '@/components/AuthModal';
import {
  useAmrapSession,
  getStoredHostToken,
  setStoredParticipantId,
} from '@/hooks/useAmrapSession';
import { useAmrapAuth } from '@/contexts/AmrapAuthContext';
import { useSessionState } from '@/hooks/useSessionState';
import type { AmrapRoundRow, AmrapParticipantRow } from '@/lib/supabase';
import type { SessionTimerState } from '@/hooks/useSessionState';
import LeaderboardRow from '@/components/LeaderboardRow';
import VideoTile from '@/components/VideoTile';
import SessionMessageBoard from '@/components/SessionMessageBoard';
import { useAgoraChannel } from '@/hooks/useAgoraChannel';
import { getWorkoutTitleAndDuration } from '@/lib/workoutLabel';
import NewWorkoutModal from '@/components/NewWorkoutModal';

const COUNTDOWN_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

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
      return { bg: 'bg-stone-800', text: 'Setup', sub: 'Get into position' };
    case 'work':
      return { bg: 'bg-orange-600', text: 'AMRAP', sub: 'Accumulate Volume' };
    case 'finished':
      return { bg: 'bg-stone-900', text: 'Time Cap', sub: 'Work Complete' };
    default:
      return { bg: 'bg-stone-800', text: 'Ready', sub: '' };
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

export default function AmrapSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAmrapAuth();
  const {
    session,
    participants,
    rounds,
    isHost,
    participantId,
    error,
    loading,
    refetch,
  } = useAmrapSession(sessionId);
  const hostToken = sessionId ? getStoredHostToken(sessionId) : null;
  const sessionState = useSessionState(sessionId, session, isHost, hostToken);
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
  const [, setJoinKey] = useState(0);
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set());
  const seenParticipantIdsRef = useRef<Set<string>>(new Set());
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [whosHereCollapsed, setWhosHereCollapsed] = useState(false);
  const [copyToast, setCopyToast] = useState<'success' | 'error' | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalSignUp, setAuthModalSignUp] = useState(false);
  const hasAutoStartedRef = useRef(false);
  const hasBeenBeforeScheduledRef = useRef(false);

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

  // Countdown to scheduled start: track "before scheduled" for auto-start, and tick countdown in 10-min window.
  useEffect(() => {
    if (timerState !== 'waiting' || !session?.scheduled_start_at) return;
    const startAt = new Date(session.scheduled_start_at).getTime();
    const windowStart = startAt - COUNTDOWN_WINDOW_MS;

    const tick = () => {
      const n = Date.now();
      setNow(n);
      if (n < startAt) hasBeenBeforeScheduledRef.current = true;
      if (n >= windowStart && n < startAt) {
        setCountdownSeconds(Math.max(0, Math.floor((startAt - n) / 1000)));
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timerState, session?.scheduled_start_at]);

  // At scheduled time, host auto-starts once (only if we were previously in the countdown window).
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

  const workoutList = session?.workout_list ?? [];
  const myRounds = participantId
    ? rounds.filter((r) => r.participant_id === participantId)
    : [];
  const leaderboard = buildLeaderboard(participants, rounds);
  const hostParticipant = participants.find((p) => p.role === 'host');

  const logRound = useCallback(async () => {
    if (!sessionId || !participantId || timerState !== 'work') return;
    setLogRoundError(null);
    const elapsedSec = totalTime - timeLeft;
    const { error } = await supabase.rpc('log_round', {
      p_session_id: sessionId,
      p_participant_id: participantId,
      p_elapsed_sec_at_round: elapsedSec,
    });
    if (error) setLogRoundError(error.message);
  }, [sessionId, participantId, timerState, totalTime, timeLeft]);

  const copyToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copyShareLink = useCallback(async () => {
    try {
      const url = window.location.href.replace(/\?.*$/, '');
      await navigator.clipboard.writeText(url);
      setCopyToast('success');
    } catch {
      setCopyToast('error');
    }
    if (copyToastTimeoutRef.current) clearTimeout(copyToastTimeoutRef.current);
    copyToastTimeoutRef.current = setTimeout(() => setCopyToast(null), 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (copyToastTimeoutRef.current) clearTimeout(copyToastTimeoutRef.current);
    };
  }, []);

  const handleJoinSession = useCallback(async () => {
    const name = joinNickname.trim();
    if (!name) {
      setJoinError('Enter your name or a nickname');
      return;
    }
    if (!sessionId) return;
    setJoinLoading(true);
    setJoinError(null);
    const { data, error } = await supabase.rpc('join_session', {
      p_session_id: sessionId,
      p_nickname: name,
      p_user_id: user?.id ?? null,
    });
    setJoinLoading(false);
    if (error) {
      setJoinError(error.message);
      return;
    }
    const result = data as { participant_id: string };
    setStoredParticipantId(sessionId, result.participant_id);
    await refetch();
    setJoinKey((k) => k + 1);
  }, [sessionId, joinNickname, refetch, user?.id]);

  if (loading || !sessionId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0500] text-white">
        <p className="text-white/70">
          {!sessionId ? 'No session' : 'Loading session…'}
        </p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0d0500] px-4 text-white">
        <p className="text-red-400">{error ?? 'Session not found'}</p>
        <Link to="/with-friends" className="text-orange-400 hover:underline">
          Back to AMRAP With Friends
        </Link>
      </div>
    );
  }

  const timerStyle = getTimerStyles(timerState);
  const showStartButton = isHost && timerState === 'waiting';

  const scheduledStartAt = session?.scheduled_start_at ?? null;
  const startAt = scheduledStartAt ? new Date(scheduledStartAt).getTime() : 0;
  const inCountdownWindow =
    timerState === 'waiting' &&
    scheduledStartAt &&
    now >= startAt - COUNTDOWN_WINDOW_MS &&
    now < startAt;
  const scheduledTimePassed =
    timerState === 'waiting' && scheduledStartAt && now >= startAt;
  const beforeCountdownWindow =
    timerState === 'waiting' && scheduledStartAt && now < startAt - COUNTDOWN_WINDOW_MS;

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

  // Pre-start screen (before Start clicked): Get Ready, AMRAP Duration, full workout time
  const waitingPreStartDisplay =
    timerState === 'waiting' && (!scheduledStartAt || scheduledTimePassed)
      ? { label: 'AMRAP Duration', title: 'Get Ready', value: formatTime(totalTime), sub: undefined as string | undefined }
      : null;

  const displayLabel = waitingPreStartDisplay?.label ?? waitingScheduleDisplay?.label ?? (timerState === 'setup' ? 'Setup' : timerState === 'finished' ? 'Complete' : 'Time Remaining');
  const displayTitle = waitingPreStartDisplay?.title ?? waitingScheduleDisplay?.title ?? timerStyle.text;
  const displaySub = waitingPreStartDisplay?.sub ?? waitingScheduleDisplay?.sub ?? timerStyle.sub;
  const displayValue = waitingPreStartDisplay?.value ?? waitingScheduleDisplay?.value ?? formatTime(timeLeft);

  return (
    <>
    <div className="min-h-screen bg-[#0d0500] text-white">
      <div className="px-4 py-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link
            to="/with-friends"
            className="shrink-0 text-sm font-bold text-white/70 hover:text-orange-400"
          >
            ← Exit session
          </Link>
          <span
            className="min-w-0 flex-1 truncate text-center text-sm font-medium text-white/90"
            title={session ? getWorkoutTitleAndDuration(session.workout_list, session.duration_minutes) : undefined}
          >
            {session ? getWorkoutTitleAndDuration(session.workout_list, session.duration_minutes) : ''}
          </span>
          <div className="flex flex-1 items-center justify-end gap-2">
            {isHost && (
              <button
                type="button"
                onClick={copyShareLink}
                className="shrink-0 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/20"
              >
                Copy link
              </button>
            )}
            {!user && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalSignUp(false);
                    setShowAuthModal(true);
                  }}
                  className="text-sm font-bold text-white/70 hover:text-orange-400"
                >
                  Log in
                </button>
                <span className="text-white/40">/</span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalSignUp(true);
                    setShowAuthModal(true);
                  }}
                  className="text-sm font-bold text-white/70 hover:text-orange-400"
                >
                  Create account
                </button>
              </>
            )}
          </div>
        </div>

        {copyToast && (
          <div
            role="status"
            aria-live="polite"
            className={`fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg ${
              copyToast === 'success'
                ? 'border border-emerald-500/40 bg-emerald-900/95 text-emerald-100'
                : 'border border-red-500/40 bg-red-900/95 text-red-100'
            }`}
          >
            {copyToast === 'success' ? 'Link copied!' : 'Failed to copy link'}
          </div>
        )}

        {agoraError && (
          <div className="mx-4 mb-4 rounded-xl border border-red-500/50 bg-red-600/20 p-4">
            <p className="text-sm font-medium text-red-300">Video unavailable</p>
            <p className="mt-1 text-xs text-red-200/90">{agoraError}</p>
          </div>
        )}

      <div className="flex flex-col gap-6 px-4 pb-4 lg:flex-row lg:items-start">
        {/* Left column: Who's Here (collapsible) + Leaderboard — grows on xl+ */}
        <div className="flex w-full shrink-0 flex-col gap-4 lg:min-w-80 lg:flex-1 lg:max-w-[26rem] xl:max-w-[28rem]">
          {/* Who's Here — collapsible */}
          <section className="rounded-2xl border border-white/10 bg-black/30 overflow-hidden">
            <button
              type="button"
              onClick={() => setWhosHereCollapsed((c) => !c)}
              className="flex w-full items-center justify-between gap-2 p-4 text-left hover:bg-white/5 transition-colors"
              aria-expanded={!whosHereCollapsed}
            >
              <h3 className="text-sm font-bold uppercase tracking-wider text-white/90">
                Who&apos;s here <span className="font-normal text-white/60">({participants.length})</span>
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
                      <label htmlFor="join-nickname" className="sr-only">Your name or nickname</label>
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
                    {joinError && <p className="mt-1.5 text-xs text-red-400">{joinError}</p>}
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
                      <span className="min-w-0 flex-1 truncate font-medium text-white">{p.nickname}</span>
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

          {/* Leaderboard — taller when Who's Here is closed so all participants fit */}
          <section
            className={`rounded-2xl border border-white/10 bg-black/30 p-4 lg:overflow-y-auto ${
              whosHereCollapsed ? 'lg:max-h-[56rem]' : 'lg:max-h-[40rem]'
            }`}
          >
            <h3 className="mb-2 text-lg font-bold text-white sm:text-xl">Leaderboard</h3>
            <p className="mb-4 text-sm text-white/80">
              Round counts and split times once the workout has started.
            </p>
            {leaderboard.length === 0 ? (
              <p className="text-sm text-white/50">No rounds logged yet.</p>
            ) : (
              <ul className="space-y-4">
                {leaderboard.map((row, index) => {
                  const isSelf = row.participantId === participantId;
                  const isHostRow = row.participantId === hostParticipant?.id;
                  const videoUser = remoteUsers.find((u) => String(u.uid) === row.participantId);
                  // Host video is featured below timer — omit video from host row only (host row stays for rounds/splits)
                  const videoTrack = isHostRow ? undefined : (isSelf ? localVideoTrack : videoUser?.videoTrack);
                  return (
                    <li key={row.participantId}>
                      <LeaderboardRow
                        nickname={row.nickname}
                        totalRounds={row.totalRounds}
                        splits={row.splits}
                        rank={index + 1}
                        videoTrack={videoTrack}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Timer — center, capped so left/right get more space on large screens */}
        <div className="min-w-0 flex-1 lg:max-w-2xl">
        <div
          className={`rounded-2xl border border-white/10 ${timerStyle.bg} p-6 transition-colors`}
        >
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-2xl font-bold">{displayTitle}</h2>
            {displaySub ? (
              <p className="text-right text-sm font-medium opacity-90">{displaySub}</p>
            ) : (
              <span />
            )}
          </div>

          <div className="mt-8 text-center">
            <div className="mb-2 text-[15px] font-bold uppercase tracking-widest opacity-80">
              {displayLabel}
            </div>
            <div
              className={`overflow-hidden min-w-0 font-bold tabular-nums ${beforeCountdownWindow ? 'text-[2.25rem] text-white/90 md:text-[2.8125rem]' : `font-mono ${timerState === 'work' ? 'text-orange-500' : 'text-white/90'}`}`}
              style={!beforeCountdownWindow ? { containerType: 'inline-size' } : undefined}
            >
              {beforeCountdownWindow ? (
                displayValue
              ) : (
                <span
                  style={
                    /^\d{1,2}:\d{2}$/.test(displayValue)
                      ? { fontSize: 'clamp(2rem, min(15cqw, 15cqh), 9rem)' }
                      : undefined
                  }
                  className={
                    /^\d{1,2}:\d{2}$/.test(displayValue)
                      ? undefined
                      : 'text-[clamp(1.5rem,5vmin,4rem)]'
                  }
                >
                  {displayValue}
                </span>
              )}
            </div>

            {showStartButton && (
              <button
                type="button"
                onClick={startSetup}
                className="mt-8 rounded-2xl bg-orange-600 px-[4.5rem] py-6 text-[1.875rem] font-bold text-white shadow-[0_0_40px_rgba(234,88,12,0.4)] hover:bg-orange-500"
              >
                Start
              </button>
            )}

            {(timerState === 'setup' || timerState === 'work') && !showStartButton && (
              <div className="mt-8 flex flex-col items-center">
                <div className="mb-4 text-[1.3125rem] font-bold uppercase tracking-widest text-white/60">
                  Your rounds
                </div>
                <div className="mb-4 text-[3.375rem] font-bold text-white">
                  {myRounds.length}
                </div>
                {timerState === 'work' && (
                  <>
                    {logRoundError && (
                      <p className="mb-2 text-[1.3125rem] text-red-400">{logRoundError}</p>
                    )}
                    <button
                      type="button"
                      onClick={logRound}
                      className="rounded-2xl border-2 border-orange-400 bg-orange-600 px-[4.5rem] py-9 text-[1.875rem] font-bold text-white shadow-[0_0_40px_rgba(234,88,12,0.4)] transition-all hover:bg-orange-500 active:scale-95"
                    >
                      LOG ROUND
                    </button>
                  </>
                )}
              </div>
            )}

            {timerState === 'finished' && (
              <div className="mt-6 text-lg text-white/80">Work complete</div>
            )}
          </div>

          {isHost && timerState !== 'waiting' && timerState !== 'finished' && (
            <div className="mt-8 flex gap-3 border-t border-white/10 pt-6">
              <button
                type="button"
                onClick={async () => {
                  const nextPaused = !isPaused;
                  await pushState({
                    state: timerState,
                    time_left_sec: timeLeft,
                    is_paused: nextPaused,
                  });
                  setIsPaused(nextPaused);
                }}
                className="flex-1 rounded-xl border border-white/20 bg-white/10 py-3 font-bold text-white hover:bg-white/20"
              >
                {isPaused ? 'RESUME' : 'PAUSE'}
              </button>
              {timerState === 'setup' && (
                <button
                  type="button"
                  onClick={skipSetup}
                  className="flex-1 rounded-xl border border-white/20 py-3 font-bold text-white/80 hover:text-white"
                >
                  SKIP
                </button>
              )}
              {timerState !== 'setup' && (
                <button
                  type="button"
                  onClick={finish}
                  className="flex-1 rounded-xl border border-white/20 py-3 font-bold text-white/80 hover:text-white"
                >
                  FINISH
                </button>
              )}
            </div>
          )}
        </div>

        {/* Host livestream — below timer, during waiting/setup/work */}
        {(timerState === 'waiting' || timerState === 'setup' || timerState === 'work') &&
          !agoraError &&
          joined &&
          hostParticipant &&
          (() => {
            const hostRemote = remoteUsers.find((u) => String(u.uid) === hostParticipant.id);
            const hostTrack = isHost ? localVideoTrack : hostRemote?.videoTrack;
            if (!hostTrack) return null;
            return (
              <div className="mt-4 min-h-[10rem] overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                <VideoTile videoTrack={hostTrack} label="Host" />
              </div>
            );
          })()}
        </div>

        {/* Right column: Message board + Exercises — grows on xl+ so names/reps stay on one line */}
        <div className="flex w-full shrink-0 flex-col gap-6 lg:min-w-96 lg:flex-1 lg:max-w-[32rem] xl:max-w-[36rem]">
          <SessionMessageBoard
            sessionId={sessionId}
            participantId={participantId}
            participants={participants}
          />
          {/* Exercises — same style/format, stacked under message board */}
          {(workoutList.length > 0 || (isHost && (timerState === 'waiting' || timerState === 'setup' || timerState === 'work' || timerState === 'finished'))) && (
            <div>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xl font-bold uppercase tracking-widest text-white/90 sm:text-2xl">
                  This round
                </h3>
                {isHost && (timerState === 'waiting' || timerState === 'setup' || timerState === 'work' || timerState === 'finished') && (
                  <button
                    type="button"
                    onClick={handleOpenNewWorkoutModal}
                    className="rounded-xl border border-orange-500/50 bg-orange-600/20 px-4 py-2 text-sm font-bold text-orange-300 transition-colors hover:border-orange-500 hover:bg-orange-600/30"
                  >
                    New Workout
                  </button>
                )}
              </div>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:gap-6">
                {workoutList.map((ex, i) => {
                  const match = ex.trim().match(/^(\d+(?:-\d+)?|\d+m)\s+(.+)$/);
                  const reps = match ? match[1] : null;
                  const name = match ? match[2] : ex.trim();
                  return (
                    <li
                      key={i}
                      className="rounded-2xl border border-white/10 bg-black/30 px-6 py-5 sm:px-8 sm:py-6"
                    >
                      <div className="flex flex-wrap items-baseline gap-2 text-xl font-semibold text-white/95 sm:text-2xl">
                        <span className="text-white/50">{i + 1}.</span>
                        <span>{name}</span>
                        {reps != null && (
                          <span className="inline-flex shrink-0 items-center rounded-md border border-white/10 bg-black/20 px-2 py-0.5 text-base font-medium text-white/80 sm:text-lg">
                            {reps}
                            {/\d$/.test(reps) ? ` rep${reps === '1' ? '' : 's'}` : ''}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>

    <AuthModal
      isOpen={showAuthModal}
      onClose={() => setShowAuthModal(false)}
      defaultSignUp={authModalSignUp}
    />

    <NewWorkoutModal
      isOpen={session?.show_new_workout_modal === true}
      onClose={handleCloseNewWorkoutModal}
      onSelect={handleNewWorkoutSelect}
      isHost={isHost}
    />
    </>
  );
}
