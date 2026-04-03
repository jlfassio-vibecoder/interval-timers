/**
 * Unified AMRAP session shell. Renders leaderboard, timer, exercises (default) or timer, leaderboard, exercises (Trainer Live embed).
 * Used by both Solo (useSoloAmrap) and Social (useSocialAmrap) pages.
 */
import type { AmrapSessionEngine } from '@/types/amrap-session';
import AmrapTimerDisplay from './AmrapTimerDisplay';
import AmrapWorkPhaseControls from './AmrapWorkPhaseControls';
import AmrapExerciseList from './AmrapExerciseList';
import FinishCelebration from './FinishCelebration';
import LeaderboardRow from '@/components/LeaderboardRow';

export type AmrapSessionShellLayout = 'default' | 'trainerLiveEmbed';

export interface AmrapSessionShellProps {
  engine: AmrapSessionEngine;
  /**
   * `trainerLiveEmbed`: single column, full width of the host — use inside Trainer Live sidebar
   * (avoids the 3-column + max-width layout meant for full-page AMRAP).
   */
  shellLayout?: AmrapSessionShellLayout;
}

export default function AmrapSessionShell({
  engine,
  shellLayout = 'default',
}: AmrapSessionShellProps) {
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

  const embed = shellLayout === 'trainerLiveEmbed';
  const freeWorkoutWorkEmbed =
    embed && !!engine.isFreeWorkoutSegment && timerPhase === 'work';
  const workPhaseInTimerChildren = !embed || freeWorkoutWorkEmbed;

  const showHostControls =
    engine.isHost &&
    timerPhase !== 'waiting' &&
    timerPhase !== 'finished' &&
    (onPause || onResume);

  const renderHostSessionControls = (stacked: boolean) => {
    if (!showHostControls) return null;
    const btnClass = stacked
      ? 'w-full rounded-xl border border-white/20 py-3 font-bold'
      : 'flex-1 rounded-xl border border-white/20 py-3 font-bold';
    return (
      <>
        {(isPaused ? onResume : onPause) && (
          <button
            type="button"
            onClick={isPaused ? onResume : onPause}
            className={`${btnClass} bg-white/10 text-white hover:bg-white/20`}
          >
            {isPaused ? 'RESUME' : 'PAUSE'}
          </button>
        )}
        {timerPhase === 'setup' && onSkipSetup && (
          <button
            type="button"
            onClick={onSkipSetup}
            className={`${btnClass} text-white/80 hover:text-white`}
          >
            SKIP
          </button>
        )}
        {timerPhase !== 'setup' && onFinish && (
          <button
            type="button"
            onClick={onFinish}
            className={`${btnClass} text-white/80 hover:text-white`}
          >
            FINISH
          </button>
        )}
      </>
    );
  };

  const hostEmbedded = embed ? renderHostSessionControls(true) : null;
  const hostDefaultRow = !embed ? renderHostSessionControls(false) : null;

  const leaderboardColumn = (
    <div
      className={
        embed
          ? 'flex w-full flex-col gap-4'
          : 'flex w-full shrink-0 flex-col gap-4 lg:min-w-80 lg:flex-1 lg:max-w-[26rem] xl:max-w-[28rem]'
      }
    >
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
  );

  const timerColumn = (
    <div className={embed ? 'min-w-0 w-full' : 'min-w-0 flex-1 lg:max-w-2xl'}
    >
      <AmrapTimerDisplay
        phase={timerPhase}
        displayLabel={displayLabel}
        displayTitle={displayTitle}
        displaySub={displaySub}
        displayValue={displayValue}
        beforeCountdownWindow={!!beforeCountdownWindow}
        showStartButton={showStartButton}
        onStart={onStartSetup}
        stackStartWithClockAside={embed && showStartButton}
        clockAsideLeft={
          embed &&
          !freeWorkoutWorkEmbed &&
          (timerPhase === 'setup' || timerPhase === 'work') ? (
            <div className="flex w-full flex-col gap-3 text-left">
              {hostEmbedded ? (
                <div className="flex flex-col gap-2">
                  {hostEmbedded}
                </div>
              ) : null}
            </div>
          ) : undefined
        }
        clockAsideRight={
          embed &&
          !freeWorkoutWorkEmbed &&
          (timerPhase === 'setup' || timerPhase === 'work') ? (
            <AmrapWorkPhaseControls
              roundsCount={myRounds}
              logRoundError={logRoundError}
              timerState={
                timerPhase === 'setup' || timerPhase === 'work' ? timerPhase : 'finished'
              }
              onLogRound={onLogRound}
              hideAmrapRounds={!!engine.isFreeWorkoutSegment && timerPhase === 'work'}
              layout="embedBesideClockRounds"
            />
          ) : undefined
        }
      >
        {embed &&
          !freeWorkoutWorkEmbed &&
          timerPhase === 'work' && (
            <div className="mt-8 flex w-full flex-col items-center">
              {logRoundError && (
                <p className="mb-2 text-[1.3125rem] text-red-400">{logRoundError}</p>
              )}
              <button
                type="button"
                onClick={onLogRound}
                className="w-full max-w-[14rem] rounded-2xl border-2 border-orange-400 bg-orange-600 px-8 py-6 text-xl font-bold text-white shadow-[0_0_40px_rgba(234,88,12,0.4)] transition-all hover:bg-orange-500 active:scale-95 sm:text-2xl whitespace-nowrap"
              >
                LOG ROUND
              </button>
            </div>
          )}
        {workPhaseInTimerChildren && !embed && (
          <AmrapWorkPhaseControls
            roundsCount={myRounds}
            logRoundError={logRoundError}
            timerState={
              timerPhase === 'setup' || timerPhase === 'work' ? timerPhase : 'finished'
            }
            onLogRound={onLogRound}
            hideAmrapRounds={!!engine.isFreeWorkoutSegment && timerPhase === 'work'}
          />
        )}
        {embed &&
          showHostControls &&
          !!engine.isFreeWorkoutSegment &&
          timerPhase === 'work' &&
          hostEmbedded && (
            <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4 text-left">
              {hostEmbedded}
            </div>
          )}
        {timerPhase === 'finished' && !engine.recapDismissed && (
          <>
            <div className="mt-6 text-lg text-white/80 animate-finished-pulse-once">
              {engine.myRounds > 0
                ? `You completed ${engine.myRounds} round${engine.myRounds === 1 ? '' : 's'} in ${engine.durationMinutes ?? 15} min`
                : 'Work complete'}
            </div>
            {slots?.finishedActions}
          </>
        )}
        {hostDefaultRow && (
          <div className="mt-8 flex gap-3 border-t border-white/10 pt-6">{hostDefaultRow}</div>
        )}
      </AmrapTimerDisplay>

      {slots?.afterTimer}
    </div>
  );

  const exercisesColumn = (
    <div
      className={
        embed
          ? 'flex w-full flex-col gap-6'
          : 'flex w-full shrink-0 flex-col gap-6 lg:min-w-96 lg:flex-1 lg:max-w-[32rem] xl:max-w-[36rem]'
      }
    >
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
              {engine.isFreeWorkoutSegment && timerPhase === 'work'
                ? 'Free workout'
                : 'This round'}
            </h3>
            {slots?.exerciseHeader}
          </div>
          {engine.isFreeWorkoutSegment && timerPhase === 'work' ? (
            <p className="text-sm text-white/70">
              No prescribed list for this segment — the host demonstrates movements for the group.
            </p>
          ) : (
            <AmrapExerciseList workoutList={workoutList} fullWidthGrid={!embed} />
          )}
        </div>
      )}
    </div>
  );

  return (
    <div
      className={
        embed
          ? 'flex flex-col gap-6 px-3 pb-4 sm:px-4'
          : 'flex flex-col gap-6 px-4 pb-4 lg:flex-row lg:items-start'
      }
    >
      {timerPhase === 'finished' && engine.celebrateFinish && <FinishCelebration key="finish-celebration" />}
      {embed ? (
        <>
          {timerColumn}
          <div className="grid w-full grid-cols-1 items-start gap-6 md:grid-cols-2">
            {leaderboardColumn}
            {exercisesColumn}
          </div>
        </>
      ) : (
        <>
          {leaderboardColumn}
          {timerColumn}
          {exercisesColumn}
        </>
      )}
    </div>
  );
}
