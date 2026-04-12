/**
 * Unified AMRAP session shell. Renders leaderboard, timer, exercises (default) or timer, exercises,
 * and optionally leaderboard (Trainer Live embed — when `slots.chatDrawerLeaderboard` is set, the
 * leaderboard is only in the chat drawer, not below exercises).
 * Used by both Solo (useSoloAmrap) and Social (useSocialAmrap) pages.
 */
import type { ReactNode } from 'react';
import type { AmrapSessionEngine } from '@/types/amrap-session';
import AmrapTimerDisplay from './AmrapTimerDisplay';
import AmrapWorkPhaseControls from './AmrapWorkPhaseControls';
import AmrapEmbedExerciseSection from './AmrapEmbedExerciseSection';
import AmrapLeaderboardSection from './AmrapLeaderboardSection';
import AmrapAllUsersSplitGrid from './AmrapAllUsersSplitGrid';
import FinishCelebration from './FinishCelebration';

export type AmrapSessionShellLayout = 'default' | 'trainerLiveEmbed';

export interface AmrapSessionShellProps {
  engine: AmrapSessionEngine;
  /**
   * `trainerLiveEmbed`: single column, full width of the host — use inside Trainer Live sidebar
   * (avoids the 3-column + max-width layout meant for full-page AMRAP).
   */
  shellLayout?: AmrapSessionShellLayout;
  /**
   * Trainer Live host: Me/Leader timer-background toggle, placed before the timer subtitle.
   */
  embedTitleBarAccessoryBeforeSub?: ReactNode;
  /**
   * When true with `trainerLiveEmbed`, omit the exercise list from this shell — host renders it
   * on the timer video background (e.g. `TrainerLiveAmrapTimerBackground`).
   */
  embedSuppressExercises?: boolean;
  /**
   * Trainer Live **client** embed: clock styling + exercises stay in the shell below the 16:9 video
   * region (host keeps overlay exercises on video).
   */
  embedClientLiveLayout?: boolean;
}

export default function AmrapSessionShell({
  engine,
  shellLayout = 'default',
  embedTitleBarAccessoryBeforeSub,
  embedSuppressExercises = false,
  embedClientLiveLayout = false,
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

      <AmrapLeaderboardSection
        participants={participants}
        variant={embed ? 'embed' : 'default'}
      />
    </div>
  );

  const timerColumnInner = (
    <>
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
        embedHostAndTimerInLeftColumn={
          embed && !freeWorkoutWorkEmbed && (timerPhase === 'setup' || timerPhase === 'work')
        }
        embedMetricsVariant={showHostControls ? 'hostFourColumn' : 'participantTwoColumn'}
        titleBarAccessoryBeforeSub={embed ? embedTitleBarAccessoryBeforeSub : undefined}
        beforeMainClock={
          embed &&
          !freeWorkoutWorkEmbed &&
          (timerPhase === 'setup' || timerPhase === 'work') &&
          hostEmbedded ? (
            <div className="flex w-full flex-col gap-2 text-left">{hostEmbedded}</div>
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
              optimisticLogRoundCount={engine.sessionMode === 'live'}
            />
          ) : undefined
        }
        liveEmbedOverVideo={embed}
        liveEmbedClientSquareClock={embed && embedClientLiveLayout}
      >
        {workPhaseInTimerChildren && !embed && (
          <AmrapWorkPhaseControls
            roundsCount={myRounds}
            logRoundError={logRoundError}
            timerState={
              timerPhase === 'setup' || timerPhase === 'work' ? timerPhase : 'finished'
            }
            onLogRound={onLogRound}
            hideAmrapRounds={!!engine.isFreeWorkoutSegment && timerPhase === 'work'}
            optimisticLogRoundCount={engine.sessionMode === 'live'}
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
              {engine.isHost
                ? (() => {
                    const athletesWithRounds = engine.participants.filter(
                      (p) => !p.isHost && p.rounds > 0
                    ).length;
                    if (athletesWithRounds > 0) {
                      return `Session complete! ${athletesWithRounds} athlete${athletesWithRounds === 1 ? '' : 's'} finished.`;
                    }
                    if (engine.myRounds > 0) {
                      return `You completed ${engine.myRounds} round${engine.myRounds === 1 ? '' : 's'} in ${engine.durationMinutes ?? 15} min`;
                    }
                    return 'Session complete!';
                  })()
                : engine.myRounds > 0
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

      {embed &&
        !freeWorkoutWorkEmbed &&
        timerPhase === 'work' &&
        engine.allUsersSplitRecords &&
        engine.allUsersSplitRecords.length > 0 && (
          <AmrapAllUsersSplitGrid records={engine.allUsersSplitRecords} />
        )}

      {slots?.afterTimer}
    </>
  );

  const timerColumn = (
    <div
      className={embed ? 'min-w-0 w-full' : 'min-w-0 flex-1 lg:max-w-2xl'}
      data-tl-embed-timer={embed ? true : undefined}
    >
      {embed && embedClientLiveLayout ? (
        <div className="relative w-full shrink-0 aspect-[16/9]">
          <div className="absolute inset-0 z-10 flex min-h-0 flex-col overflow-y-auto overflow-x-hidden px-1 sm:px-0">
            {timerColumnInner}
          </div>
        </div>
      ) : (
        timerColumnInner
      )}
    </div>
  );

  const exercisesColumn =
    embed && embedSuppressExercises ? null : (
      <div
        className={
          embed
            ? 'flex w-full flex-col gap-6'
            : 'flex w-full shrink-0 flex-col gap-6 lg:min-w-96 lg:flex-1 lg:max-w-[32rem] xl:max-w-[36rem]'
        }
      >
        {!embed && slots?.exerciseHeader ? (
          <div className="mb-6 flex flex-wrap items-center justify-end gap-3">
            {slots.exerciseHeader}
          </div>
        ) : null}
        <AmrapEmbedExerciseSection engine={engine} maxTwoColumns={embed} />
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
          {exercisesColumn}
          {!slots?.chatDrawerLeaderboard ? leaderboardColumn : null}
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
