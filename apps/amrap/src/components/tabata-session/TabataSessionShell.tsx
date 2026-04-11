/**
 * Tabata session UI: timer + exercise list. `trainerLiveEmbed` matches Trainer Live sidebar width.
 * With `embedSuppressExercises`, the host renders exercises on the video plane (see Trainer Live Tabata wrapper).
 */
import type { ReactNode } from 'react';
import type { TabataEngine, TabataPhase } from '@/types/tabata-session';
import AmrapTimerDisplay from '@/components/amrap-session/AmrapTimerDisplay';
import type { AmrapTimerPhase } from '@/components/amrap-session/AmrapTimerDisplay';

export type TabataSessionShellLayout = 'default' | 'trainerLiveEmbed';

export interface TabataSessionShellProps {
  engine: TabataEngine;
  shellLayout?: TabataSessionShellLayout;
  /**
   * When true with `trainerLiveEmbed`, omit the inline exercise list — host renders
   * `TabataEmbedExerciseSection` on the timer video background.
   */
  embedSuppressExercises?: boolean;
  /** Trainer Live: accessory before timer subtitle (e.g. Me/Leader toggle). */
  embedTitleBarAccessoryBeforeSub?: ReactNode;
}

/** Red / green main clock + WORK·REST label when Tabata is in work or rest (incl. paused). */
function tabataOverlayWorkRestClockTone(
  phase: TabataPhase,
  pausedFrom: 'work' | 'rest' | null
): { labelClass: string; valueClass: string } | null {
  const tone: 'work' | 'rest' | null =
    phase === 'work'
      ? 'work'
      : phase === 'rest'
        ? 'rest'
        : phase === 'paused' && pausedFrom
          ? pausedFrom
          : null;
  if (tone === 'work') {
    return {
      labelClass: 'mb-2 text-[15px] font-bold uppercase tracking-widest text-red-400',
      valueClass: 'font-mono text-red-500',
    };
  }
  if (tone === 'rest') {
    return {
      labelClass: 'mb-2 text-[15px] font-bold uppercase tracking-widest text-green-400',
      valueClass: 'font-mono text-green-400',
    };
  }
  return null;
}

function tabataPhaseToAmrapDisplay(phase: TabataPhase): AmrapTimerPhase {
  switch (phase) {
    case 'idle':
      return 'waiting';
    case 'setup':
      return 'setup';
    case 'work':
      return 'work';
    case 'rest':
      return 'waiting';
    case 'finished':
      return 'finished';
    case 'paused':
      return 'work';
    default:
      return 'waiting';
  }
}

function TabataMetricsAside({
  phase,
  displayTitle,
  displaySub,
}: {
  phase: TabataPhase;
  displayTitle: string;
  displaySub?: string;
}) {
  if (phase === 'idle') {
    return displaySub ? (
      <p className="max-w-[12rem] text-balance text-center text-sm font-medium leading-snug text-white/90">
        {displaySub}
      </p>
    ) : null;
  }
  if (phase === 'finished') {
    return (
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-white/70">Done</p>
        <p className="text-sm font-semibold text-white">{displayTitle}</p>
        {displaySub ? <p className="text-xs text-white/75">{displaySub}</p> : null}
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-center">
      <p className="text-xs font-bold uppercase tracking-wide text-white/75">Tabata</p>
      <p className="text-sm font-semibold leading-tight text-white">{displayTitle}</p>
      {displaySub ? <p className="text-xs leading-snug text-white/85">{displaySub}</p> : null}
    </div>
  );
}

export default function TabataSessionShell({
  engine,
  shellLayout = 'default',
  embedSuppressExercises = false,
  embedTitleBarAccessoryBeforeSub,
}: TabataSessionShellProps) {
  const {
    loading,
    error,
    phase,
    displayLabel,
    displayTitle,
    displaySub,
    displayValue,
    workoutList,
    isTrainer,
    onStart,
    onSkipSetup,
    onPause,
    onResume,
    onFinish,
    pausedFromPhase,
  } = engine;

  const embed = shellLayout === 'trainerLiveEmbed';
  const overlayEmbed = embed && embedSuppressExercises;
  const amrapPhase = tabataPhaseToAmrapDisplay(phase);

  const showStart = phase === 'idle' && isTrainer && !!onStart;
  const showHostControls =
    isTrainer &&
    phase !== 'idle' &&
    phase !== 'finished' &&
    (onPause || onResume || onFinish || onSkipSetup);

  const hostEmbedded =
    embed && showHostControls ? (
      <div className="flex w-full flex-col gap-4">
        {(phase === 'work' || phase === 'rest') && onPause ? (
          <button
            type="button"
            onClick={onPause}
            className="w-full rounded-xl border border-white/20 bg-white/10 py-3 font-bold text-white hover:bg-white/20"
          >
            PAUSE
          </button>
        ) : null}
        {phase === 'paused' && onResume ? (
          <button
            type="button"
            onClick={onResume}
            className="w-full rounded-xl border border-white/20 bg-white/10 py-3 font-bold text-white hover:bg-white/20"
          >
            RESUME
          </button>
        ) : null}
        {phase === 'setup' && onSkipSetup ? (
          <button
            type="button"
            onClick={onSkipSetup}
            className="w-full rounded-xl border border-white/20 py-3 font-bold text-white/80 hover:text-white"
          >
            SKIP
          </button>
        ) : null}
        {phase !== 'setup' && onFinish ? (
          <button
            type="button"
            onClick={onFinish}
            className="w-full rounded-xl border border-white/20 py-3 font-bold text-white/80 hover:text-white"
          >
            FINISH
          </button>
        ) : null}
      </div>
    ) : null;

  const hostDefaultRow =
    !embed && showHostControls ? (
      <div className="mt-6 flex w-full flex-wrap gap-3 border-t border-white/10 pt-6">
        {(phase === 'work' || phase === 'rest') && onPause ? (
          <button
            type="button"
            onClick={onPause}
            className="flex-1 rounded-xl border border-white/20 bg-white/10 py-3 font-bold text-white hover:bg-white/20"
          >
            PAUSE
          </button>
        ) : null}
        {phase === 'paused' && onResume ? (
          <button
            type="button"
            onClick={onResume}
            className="flex-1 rounded-xl border border-white/20 bg-white/10 py-3 font-bold text-white hover:bg-white/20"
          >
            RESUME
          </button>
        ) : null}
        {phase === 'setup' && onSkipSetup ? (
          <button
            type="button"
            onClick={onSkipSetup}
            className="flex-1 rounded-xl border border-white/20 py-3 font-bold text-white/80 hover:text-white"
          >
            SKIP
          </button>
        ) : null}
        {phase !== 'setup' && onFinish ? (
          <button
            type="button"
            onClick={onFinish}
            className="flex-1 rounded-xl border border-white/20 py-3 font-bold text-white/80 hover:text-white"
          >
            FINISH
          </button>
        ) : null}
      </div>
    ) : null;

  if (loading) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center bg-[#0d0500] text-white">
        <p className="text-white/70">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 bg-[#0d0500] px-4 text-white">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  const exerciseBlock =
    !embedSuppressExercises && workoutList.length > 0 ? (
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <h3 className="mb-3 text-lg font-bold text-white">This round</h3>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-white/90">
          {workoutList.map((name, i) => (
            <li key={`${i}-${name}`}>{name}</li>
          ))}
        </ol>
      </div>
    ) : !embedSuppressExercises ? (
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
        No exercise list for this block. Follow your trainer.
      </div>
    ) : null;

  const metricsNode = overlayEmbed ? (
    <TabataMetricsAside phase={phase} displayTitle={displayTitle} displaySub={displaySub} />
  ) : undefined;

  const overlayTitleForSplit =
    overlayEmbed && (phase === 'setup' || phase === 'work' || phase === 'rest' || phase === 'paused')
      ? 'Tabata'
      : displayTitle;
  const overlaySubForSplit =
    overlayEmbed && (phase === 'setup' || phase === 'work' || phase === 'rest' || phase === 'paused')
      ? undefined
      : displaySub;

  const tabataWorkRestClockTone =
    overlayEmbed ? tabataOverlayWorkRestClockTone(phase, pausedFromPhase ?? null) : null;

  const timerColumn = (
    <div className={embed ? 'min-w-0 w-full' : 'min-w-0 flex-1'}>
      <AmrapTimerDisplay
        phase={amrapPhase}
        displayLabel={displayLabel}
        displayTitle={overlayTitleForSplit}
        displaySub={overlaySubForSplit}
        displayValue={displayValue}
        showStartButton={showStart}
        onStart={onStart}
        stackStartWithClockAside={overlayEmbed ? showStart : embed && showStart}
        titleBarAccessoryBeforeSub={embed ? embedTitleBarAccessoryBeforeSub : undefined}
        containerClassName={overlayEmbed ? 'bg-transparent' : undefined}
        embedHostAndTimerInLeftColumn={
          overlayEmbed &&
          (phase === 'setup' || phase === 'work' || phase === 'rest' || phase === 'paused')
        }
        embedMetricsVariant="participantTwoColumn"
        beforeMainClock={
          overlayEmbed &&
          (phase === 'setup' || phase === 'work' || phase === 'rest' || phase === 'paused') &&
          hostEmbedded ? (
            <div className="mb-5 flex w-full flex-col text-left">{hostEmbedded}</div>
          ) : undefined
        }
        embedMainClockLabelClassName={tabataWorkRestClockTone?.labelClass}
        embedMainClockValueClassName={tabataWorkRestClockTone?.valueClass}
        clockAsideRight={overlayEmbed ? metricsNode : undefined}
        clockAsideLeft={
          !overlayEmbed && embed && (phase === 'work' || phase === 'rest' || phase === 'paused' || phase === 'setup')
            ? hostEmbedded
            : undefined
        }
      >
        {hostDefaultRow}
      </AmrapTimerDisplay>
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
      {embed ? (
        <>
          {timerColumn}
          {exerciseBlock}
        </>
      ) : (
        <>
          {timerColumn}
          <div className="flex w-full min-w-0 flex-col gap-4 lg:max-w-md">{exerciseBlock}</div>
        </>
      )}
    </div>
  );
}
