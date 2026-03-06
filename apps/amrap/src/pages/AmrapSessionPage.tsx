import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  useAmrapSession,
  getStoredHostToken,
} from '@/hooks/useAmrapSession';
import { useSessionState } from '@/hooks/useSessionState';
import type { AmrapRoundRow, AmrapParticipantRow } from '@/lib/supabase';
import type { SessionTimerState } from '@/hooks/useSessionState';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
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
  const {
    session,
    participants,
    rounds,
    isHost,
    participantId,
    error,
    loading,
  } = useAmrapSession(sessionId);
  const hostToken = sessionId ? getStoredHostToken(sessionId) : null;
  const sessionState = useSessionState(sessionId, session, isHost, hostToken);

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
  const workoutList = session?.workout_list ?? [];
  const myRounds = participantId
    ? rounds.filter((r) => r.participant_id === participantId)
    : [];
  const leaderboard = buildLeaderboard(participants, rounds);

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

  const copyShareLink = useCallback(() => {
    try {
      const url = window.location.href.replace(/\?.*$/, '');
      void navigator.clipboard.writeText(url);
    } catch {}
  }, []);

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

  return (
    <div className="min-h-screen bg-[#0d0500] text-white">
      <div className="mx-auto max-w-2xl px-4 py-4">
        <div className="mb-4 flex items-center justify-between">
          <Link
            to="/with-friends"
            className="text-sm font-bold text-white/70 hover:text-orange-400"
          >
            ← Exit session
          </Link>
          {isHost && (
            <button
              type="button"
              onClick={copyShareLink}
              className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/20"
            >
              Copy link
            </button>
          )}
        </div>

        <div
          className={`rounded-2xl border border-white/10 ${timerStyle.bg} p-6 transition-colors`}
        >
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest opacity-80">
            {timerState === 'setup'
              ? 'Preparation'
              : timerState === 'finished'
                ? 'Complete'
                : 'Time Remaining'}
          </div>
          <h2 className="font-display text-2xl font-bold">{timerStyle.text}</h2>
          <p className="mt-1 text-sm opacity-90">{timerStyle.sub}</p>

          <div className="mt-8 text-center">
            <div
              className={`font-mono text-7xl font-bold tabular-nums md:text-8xl ${timerState === 'work' ? 'text-orange-500' : 'text-white/90'}`}
            >
              {formatTime(timeLeft)}
            </div>

            {showStartButton && (
              <button
                type="button"
                onClick={startSetup}
                className="mt-8 rounded-2xl bg-orange-600 px-12 py-4 text-xl font-bold text-white shadow-[0_0_40px_rgba(234,88,12,0.4)] hover:bg-orange-500"
              >
                Start
              </button>
            )}

            {(timerState === 'setup' || timerState === 'work') && !showStartButton && (
              <div className="mt-8 flex flex-col items-center">
                <div className="mb-4 text-sm font-bold uppercase tracking-widest text-white/60">
                  Your rounds
                </div>
                <div className="mb-4 text-4xl font-bold text-white">
                  {myRounds.length}
                </div>
                {workoutList.length > 0 && (
                  <div className="mb-4 max-w-md rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-left">
                    <div className="mb-2 text-xs font-bold uppercase tracking-widest text-white/50">
                      This round
                    </div>
                    <ul className="list-inside list-disc space-y-1 text-sm text-white/90">
                      {workoutList.map((ex, i) => (
                        <li key={i}>{ex}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {timerState === 'work' && (
                  <>
                    {logRoundError && (
                      <p className="mb-2 text-sm text-red-400">{logRoundError}</p>
                    )}
                    <button
                      type="button"
                      onClick={logRound}
                      className="rounded-2xl bg-orange-600 px-12 py-6 text-xl font-bold text-white shadow-[0_0_40px_rgba(234,88,12,0.4)] transition-all hover:bg-orange-500 active:scale-95"
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

        {/* Who's here */}
        <section className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-6">
          <h3 className="mb-4 text-lg font-bold text-white">
            Who&apos;s here <span className="font-normal text-white/60">({participants.length})</span>
          </h3>
          <ul className="flex flex-wrap gap-2">
            {participants.map((p) => (
              <li
                key={p.id}
                className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
              >
                <span className="font-bold text-white">{p.nickname}</span>
                {p.role === 'host' && (
                  <span className="ml-2 rounded bg-orange-600/30 px-1.5 py-0.5 text-[10px] font-bold uppercase text-orange-300">
                    Host
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Leaderboard: round counts and splits */}
        <section className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-6">
          <h3 className="mb-4 text-lg font-bold text-white">Leaderboard</h3>
          <p className="mb-4 text-sm text-white/60">
            Round counts and split times once the workout has started.
          </p>
          <ul className="space-y-4">
            {leaderboard.map((row) => (
              <li
                key={row.participantId}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3"
              >
                <div>
                  <span className="font-bold text-white">{row.nickname}</span>
                  <span className="ml-2 text-white/60">
                    {row.totalRounds} round{row.totalRounds !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="text-right text-sm text-white/70">
                  {row.splits.length > 0
                    ? row.splits.map((s) => formatTime(s)).join(', ')
                    : '—'}
                </div>
              </li>
            ))}
          </ul>
          {leaderboard.length === 0 && (
            <p className="text-sm text-white/50">No rounds logged yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
