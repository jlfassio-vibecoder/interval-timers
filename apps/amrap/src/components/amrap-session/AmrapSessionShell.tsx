/**
 * Unified AMRAP session shell. Renders timer, leaderboard, exercises from AmrapSessionEngine.
 * Used by both Solo (useSoloAmrap) and Social (useSocialAmrap) pages.
 */
import type { AmrapSessionEngine } from '@/types/amrap-session';
import AmrapTimerDisplay from './AmrapTimerDisplay';
import AmrapWorkPhaseControls from './AmrapWorkPhaseControls';
import AmrapExerciseList from './AmrapExerciseList';
import LeaderboardRow from '@/components/LeaderboardRow';

export interface AmrapSessionShellProps {
  engine: AmrapSessionEngine;
}

export default function AmrapSessionShell({ engine }: AmrapSessionShellProps) {
  const {
    timerPhase,
    displayLabel,
    displayTitle,
    displaySub,
    displayValue,
    beforeCountdownWindow,
    onLogRound,
    onPause,
    onResume,
    onFinish,
    onSkipSetup,
    onStartSetup,
    myRounds,
    logRoundError,
    isPaused,
    participants,
    workoutList,
    slots,
    loading,
    error,
  } = engine;

  const showStartButton = timerPhase === 'waiting' && !!onStartSetup;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0500] text-white">
        <p className="text-white/70">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0d0500] px-4 text-white">
        <p className="text-red-400">{error}</p>
        {slots?.errorAction}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-4 pb-4 lg:flex-row lg:items-start">
      {/* Left column: slots.beforeLeaderboard + Leaderboard */}
      <div className="flex w-full shrink-0 flex-col gap-4 lg:min-w-80 lg:flex-1 lg:max-w-[26rem] xl:max-w-[28rem]">
        {slots?.beforeLeaderboard}

        <section className="rounded-2xl border border-white/10 bg-black/30 p-4 lg:max-h-[56rem] lg:overflow-y-auto">
          <h3 className="mb-2 text-lg font-bold text-white sm:text-xl">
            Leaderboard
          </h3>
          <p className="mb-4 text-sm text-white/80">
            Round counts and split times once the workout has started.
          </p>
          {participants.length === 0 ? (
            <p className="text-sm text-white/50">No rounds logged yet.</p>
          ) : (
            <ul className="space-y-4">
              {participants.map((p, index) => (
                <li key={p.id}>
                  <LeaderboardRow
                    nickname={p.name}
                    totalRounds={p.rounds}
                    splits={p.splits}
                    rank={index + 1}
                    videoTrack={p.videoTrack ?? undefined}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Center: Timer + WorkPhaseControls + slots.afterTimer */}
      <div className="min-w-0 flex-1 lg:max-w-2xl">
        <AmrapTimerDisplay
          phase={timerPhase}
          displayLabel={displayLabel}
          displayTitle={displayTitle}
          displaySub={displaySub}
          displayValue={displayValue}
          beforeCountdownWindow={!!beforeCountdownWindow}
          showStartButton={showStartButton}
          onStart={onStartSetup}
        >
          <AmrapWorkPhaseControls
            roundsCount={myRounds}
            logRoundError={logRoundError}
            timerState={
              timerPhase === 'setup' || timerPhase === 'work'
                ? timerPhase
                : 'finished'
            }
            onLogRound={onLogRound}
          />
          {timerPhase === 'finished' && (
            <>
              <div className="mt-6 text-lg text-white/80 animate-finished-pulse-once">
                {engine.myRounds > 0
                  ? `You completed ${engine.myRounds} round${engine.myRounds === 1 ? '' : 's'} in ${engine.durationMinutes ?? 15} min`
                  : 'Work complete'}
              </div>
              {slots?.finishedActions}
            </>
          )}
          {engine.isHost &&
            timerPhase !== 'waiting' &&
            timerPhase !== 'finished' &&
            (onPause || onResume) && (
              <div className="mt-8 flex gap-3 border-t border-white/10 pt-6">
                {(isPaused ? onResume : onPause) && (
                  <button
                    type="button"
                    onClick={isPaused ? onResume : onPause}
                    className="flex-1 rounded-xl border border-white/20 bg-white/10 py-3 font-bold text-white hover:bg-white/20"
                  >
                    {isPaused ? 'RESUME' : 'PAUSE'}
                  </button>
                )}
                {timerPhase === 'setup' && onSkipSetup && (
                  <button
                    type="button"
                    onClick={onSkipSetup}
                    className="flex-1 rounded-xl border border-white/20 py-3 font-bold text-white/80 hover:text-white"
                  >
                    SKIP
                  </button>
                )}
                {timerPhase !== 'setup' && onFinish && (
                  <button
                    type="button"
                    onClick={onFinish}
                    className="flex-1 rounded-xl border border-white/20 py-3 font-bold text-white/80 hover:text-white"
                  >
                    FINISH
                  </button>
                )}
              </div>
            )}
        </AmrapTimerDisplay>

        {slots?.afterTimer}
      </div>

      {/* Right column: slots.rightColumn + ExerciseList */}
      <div className="flex w-full shrink-0 flex-col gap-6 lg:min-w-96 lg:flex-1 lg:max-w-[32rem] xl:max-w-[36rem]">
        {slots?.rightColumn}

        {(workoutList.length > 0 ||
          (engine.isHost &&
            (timerPhase === 'waiting' ||
              timerPhase === 'setup' ||
              timerPhase === 'work' ||
              timerPhase === 'finished'))) && (
          <div>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-bold uppercase tracking-widest text-white/90 sm:text-2xl">
                This round
              </h3>
              {slots?.exerciseHeader}
            </div>
            <AmrapExerciseList workoutList={workoutList} />
          </div>
        )}
      </div>
    </div>
  );
}
