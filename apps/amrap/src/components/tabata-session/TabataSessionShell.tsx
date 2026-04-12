/**
 * Tabata session UI: timer + exercise list. `trainerLiveEmbed` matches Trainer Live sidebar width.
 * With `embedSuppressExercises`, the host renders exercises on the video plane (see Trainer Live Tabata wrapper).
 * With `embedClientLiveLayout`, the client gets the AMRAP-style 16:9 timer band + exercises below the video.
 */
import type { ReactNode } from 'react';
import type { TabataEngine, TabataPhase } from '@/types/tabata-session';
import AmrapTimerDisplay from '@/components/amrap-session/AmrapTimerDisplay';
import type { AmrapTimerPhase } from '@/components/amrap-session/AmrapTimerDisplay';
import TabataEmbedExerciseSection from '@/components/tabata-session/TabataEmbedExerciseSection';

export type TabataSessionShellLayout = 'default' | 'trainerLiveEmbed';

export interface TabataSessionShellProps {
  engine: TabataEngine;
  shellLayout?: TabataSessionShellLayout;
  /**
   * When true with `trainerLiveEmbed`, omit the inline exercise list — host renders
   * `TabataEmbedExerciseSection` on the timer video background.
   */
  embedSuppressExercises?: boolean;
  /**
   * Trainer Live **client** embed: timer + round metrics in square cards over the 16:9 video; exercises
   * below (host keeps overlay exercises on video).
   */
  embedClientLiveLayout?: boolean;
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

/** Matches `AmrapTimerDisplay` default phase label (e.g. READY). */
const EMBED_CLOCK_LABEL_CLASS = 'mb-2 text-[15px] font-bold uppercase tracking-widest opacity-80';

function TabataEmbedBigNumber({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`flex w-full min-w-0 justify-center overflow-hidden text-center font-bold tabular-nums ${className ?? ''}`}
      style={{ containerType: 'inline-size' }}
    >
      <span style={{ fontSize: 'clamp(2rem, min(15cqw, 15cqh), 9rem)' }}>{children}</span>
    </div>
  );
}

function TabataMetricsAside({
  phase,
  displayTitle,
  displaySub,
  clientLiveLayout,
  roundCount,
  currentRoundOneBased,
  pausedFromPhase,
}: {
  phase: TabataPhase;
  displayTitle: string;
  displaySub?: string;
  /** Client Trainer Live: right column mirrors left clock — READY-style label + timer-sized digit(s). */
  clientLiveLayout: boolean;
  roundCount: number;
  currentRoundOneBased: number;
  pausedFromPhase: 'work' | 'rest' | null;
}) {
  const workRestTone = tabataOverlayWorkRestClockTone(
    phase,
    phase === 'paused' ? pausedFromPhase : null
  );
  const bigValueClass =
    phase === 'work' || phase === 'rest' || (phase === 'paused' && pausedFromPhase)
      ? workRestTone?.valueClass ?? 'font-mono text-white/90'
      : 'font-mono text-white/90';

  if (clientLiveLayout) {
    if (phase === 'setup' || phase === 'work' || phase === 'rest' || phase === 'paused') {
      return (
        <div className="flex min-w-0 flex-col items-center justify-center px-0.5 text-center">
          <div className={EMBED_CLOCK_LABEL_CLASS}>{roundCount} ROUNDS</div>
          <TabataEmbedBigNumber className={bigValueClass}>{currentRoundOneBased}</TabataEmbedBigNumber>
        </div>
      );
    }
  }

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
  embedClientLiveLayout = false,
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
    roundCount,
    currentIntervalIndex,
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
  const clientLiveLayout = embed && embedClientLiveLayout;
  const amrapPhase = tabataPhaseToAmrapDisplay(phase);

  const activeSplitPhase =
    phase === 'setup' || phase === 'work' || phase === 'rest' || phase === 'paused';
  /**
   * Two square cards (timer | metrics): only during active phases. If true during **idle**, the host
   * loses the Start button (it only renders in `AmrapTimerDisplay`’s non-split embed branch).
   */
  const useEmbedSplitSquareLayout = (overlayEmbed || clientLiveLayout) && activeSplitPhase;
  /** Right-column metrics: host overlay always (incl. idle); client only when split layout applies. */
  const showEmbedMetricsAside = overlayEmbed || (clientLiveLayout && activeSplitPhase);

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
    embed && !embedSuppressExercises ? (
      <>
        <TabataEmbedExerciseSection
          engine={engine}
          maxTwoColumns
          className="flex w-full flex-col gap-6"
        />
        {workoutList.length === 0 ? (
          <p className="text-sm text-white/70">No exercise list for this block. Follow your trainer.</p>
        ) : null}
      </>
    ) : !embedSuppressExercises && workoutList.length > 0 ? (
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

  const currentRoundOneBased = phase === 'setup' ? 1 : (currentIntervalIndex ?? 0) + 1;

  const metricsNode = showEmbedMetricsAside ? (
    <TabataMetricsAside
      phase={phase}
      displayTitle={displayTitle}
      displaySub={displaySub}
      clientLiveLayout={!!clientLiveLayout}
      roundCount={roundCount}
      currentRoundOneBased={currentRoundOneBased}
      pausedFromPhase={pausedFromPhase ?? null}
    />
  ) : undefined;

  const overlayTitleForSplit = useEmbedSplitSquareLayout ? 'Tabata' : displayTitle;
  const overlaySubForSplit = useEmbedSplitSquareLayout ? undefined : displaySub;

  const tabataWorkRestClockTone = useEmbedSplitSquareLayout
    ? tabataOverlayWorkRestClockTone(phase, pausedFromPhase ?? null)
    : null;

  const timerColumnInner = (
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
      containerClassName={overlayEmbed || clientLiveLayout ? 'bg-transparent' : undefined}
      embedHostAndTimerInLeftColumn={useEmbedSplitSquareLayout}
      embedMetricsVariant="participantTwoColumn"
      liveEmbedOverVideo={embed}
      liveEmbedClientSquareClock={clientLiveLayout}
      beforeMainClock={
        overlayEmbed && activeSplitPhase && hostEmbedded ? (
          <div className="mb-5 flex w-full flex-col text-left">{hostEmbedded}</div>
        ) : undefined
      }
      embedMainClockLabelClassName={tabataWorkRestClockTone?.labelClass}
      embedMainClockValueClassName={tabataWorkRestClockTone?.valueClass}
      clockAsideRight={showEmbedMetricsAside ? metricsNode : undefined}
      clockAsideLeft={
        !overlayEmbed && embed && (phase === 'work' || phase === 'rest' || phase === 'paused' || phase === 'setup')
          ? hostEmbedded
          : undefined
      }
    >
      {hostDefaultRow}
    </AmrapTimerDisplay>
  );

  const timerColumn = (
    <div
      className={embed ? 'min-w-0 w-full' : 'min-w-0 flex-1'}
      data-tl-embed-timer={embed ? true : undefined}
    >
      {embed && clientLiveLayout ? (
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
