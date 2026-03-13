/**
 * Reusable full-screen interval timer overlay. Queue-based: walks a timeline
 * of blocks (warmup / work / rest / cooldown), plays shared sounds at phase
 * transitions, same look for all 11 interval timers.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { HIITTimelineBlock, InstructionStep } from '@interval-timers/types';
import {
  playReady,
  playBell,
  playBeeps,
  playLongTone,
  setSoundVolume as setSoundVolumeModule,
} from '@interval-timers/timer-sounds';
import ExerciseSubtitle from './ExerciseSubtitle';
import ExpandableInstructions from './ExpandableInstructions';
import ExpandableMistakesCorrections from './ExpandableMistakesCorrections';
import RoundsCounter from './RoundsCounter';
import WarmUpWheel from './WarmUpWheel';
import type { WarmupExercise } from './useWarmupConfig';
import {
  WARMUP_EXERCISES,
  WARMUP_DURATION_PER_EXERCISE,
  getWarmupTransitionSeconds,
} from '@interval-timers/timer-core';

const SOUND_VOLUME_KEY = 'interval-timer-sound-volume';
const VOLUME_MIN = 0.1;
const VOLUME_MAX = 1;
const VOLUME_STEP = 0.1;

export interface IntervalTimerOverlayTheme {
  workBg: string;
}

interface IntervalTimerOverlayProps {
  timeline: HIITTimelineBlock[];
  onClose: () => void;
  theme?: IntervalTimerOverlayTheme;
  /** Enriched warmup exercises (imageUrl, instructions, subtitle, mistakeCorrections). When provided, used for the warmup wheel and sidebar content (image, subtitle, step-by-step, mistakes & corrections). */
  warmupExercises?: WarmupExercise[];
  /** Duration per warmup exercise in seconds. Used with warmupExercises. */
  warmupDurationPerExercise?: number;
  /** When true, hide the "Skip Warm-up" button (e.g. when the app is warmup-only). */
  hideSkipWarmup?: boolean;
  /** Override for rounds counter: current round (0-based). When with roundsTotal, used instead of block index. */
  roundsCurrent?: number;
  /** Override for rounds counter: total rounds. When with roundsCurrent, used instead of timeline length. */
  roundsTotal?: number;
  /** Optional per-block instructions shown in the sidebar when current block name matches (e.g. Warm-Up Walk script). */
  customBlockInstructions?: Array<{ blockName: string; steps: InstructionStep[]; title?: string }>;
  /** When true, start the timer immediately on mount (e.g. for synced session warmup). */
  autoStart?: boolean;
  /** When true, use absolute positioning to fill parent instead of fixed viewport (e.g. when embedded in a layout). */
  embedded?: boolean;
  /** Optional content to render in the sidebar below the exercise image (e.g. host video for AMRAP sessions). */
  sidebarSlot?: React.ReactNode;
  /** When true, hide the close button (e.g. when only host can close, as in synced session warmup). */
  hideClose?: boolean;
}

const DEFAULT_THEME: IntervalTimerOverlayTheme = { workBg: 'bg-red-600' };

const IntervalTimerOverlay: React.FC<IntervalTimerOverlayProps> = ({
  timeline,
  onClose,
  theme = DEFAULT_THEME,
  warmupExercises,
  warmupDurationPerExercise = WARMUP_DURATION_PER_EXERCISE,
  hideSkipWarmup = false,
  roundsCurrent: roundsCurrentProp,
  roundsTotal: roundsTotalProp,
  customBlockInstructions,
  autoStart = false,
  embedded = false,
  sidebarSlot,
  hideClose = false,
}) => {
  const warmupList: WarmupExercise[] =
    warmupExercises ?? WARMUP_EXERCISES.map((e) => ({ name: e.name, detail: e.detail }));
  const warmupDuration = warmupDurationPerExercise ?? WARMUP_DURATION_PER_EXERCISE;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isTransitioningToNext, setIsTransitioningToNext] = useState(false);
  const [transitionCountdown, setTransitionCountdown] = useState(0);
  const [isControlsDrawerOpen, setIsControlsDrawerOpen] = useState(false);
  const [soundVolume, setSoundVolumeState] = useState(() => {
    try {
      const v = parseFloat(localStorage.getItem(SOUND_VOLUME_KEY) ?? '');
      if (Number.isFinite(v) && v >= VOLUME_MIN && v <= VOLUME_MAX) return v;
    } catch {
      // Ignore
    }
    return VOLUME_MIN;
  });
  const readyPlayedThisRestRef = useRef(false);
  const prevBlockTypeRef = useRef<HIITTimelineBlock['type'] | null>(null);

  // Auto-start mirrors manual START: play warmup bell when first block is warmup, then start
  useEffect(() => {
    if (!autoStart || hasStarted) return;
    const firstBlock = timeline[0];
    if (firstBlock?.type === 'warmup') playBell();
    setHasStarted(true);
  }, [autoStart, hasStarted, timeline]);

  // Sync volume to sound module on mount and when user changes it
  useEffect(() => {
    setSoundVolumeModule(soundVolume);
  }, [soundVolume]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    if (Number.isFinite(v)) {
      setSoundVolumeState(Math.max(VOLUME_MIN, Math.min(VOLUME_MAX, v)));
      try {
        localStorage.setItem(SOUND_VOLUME_KEY, String(v));
      } catch {
        // Ignore
      }
    }
  }, []);

  const currentBlock = timeline[currentIndex];
  const nextBlock = timeline[currentIndex + 1] ?? null;

  // Same formula as WarmUpWheel (elapsedSeconds / durationPerExercise capped by list length) so counter and wheel always show the same exercise.
  const isWarmupBlock = currentBlock?.type === 'warmup';
  const warmupElapsed = isWarmupBlock ? currentBlock.duration - timeLeft : 0;
  const warmupActiveIndex =
    isWarmupBlock && warmupList.length > 0 && warmupDuration > 0
      ? Math.min(Math.floor(warmupElapsed / warmupDuration), warmupList.length)
      : 0;

  const roundsCurrent =
    roundsCurrentProp !== undefined && roundsTotalProp !== undefined
      ? roundsCurrentProp
      : isWarmupBlock
        ? !hasStarted
          ? 0
          : Math.min(warmupActiveIndex + 1, warmupList.length)
        : currentIndex;
  const roundsTotal =
    roundsCurrentProp !== undefined && roundsTotalProp !== undefined
      ? roundsTotalProp
      : (isWarmupBlock ? warmupList.length : timeline.length);

  // Initialize timeLeft when timeline or index changes (e.g. after skip/previous)
  useEffect(() => {
    const block = timeline[currentIndex];
    if (block) {
      queueMicrotask(() => setTimeLeft(block.duration));
      if (block.type === 'rest') readyPlayedThisRestRef.current = false;
    }
  }, [timeline, currentIndex]);

  // Play sound when entering a new block (including initial). Warm-up sounds unchanged.
  useEffect(() => {
    if (!currentBlock) return;
    const type = currentBlock.type;
    const prevType = prevBlockTypeRef.current;

    if (type === 'setup') playBell();
    else if (type === 'work') {
      // First work after setup or rest: 3 beeps; next work (e.g. 10/20/30): 1 beep
      if (prevType === 'setup' || prevType === 'rest') playBeeps(3);
      else playBeeps(1);
    } else if (type === 'rest') {
      // End of work: 1 beep
      playBeeps(1);
    } else if (type === 'cooldown') {
      playLongTone(1.5);
    }

    prevBlockTypeRef.current = type;
  }, [currentIndex, currentBlock]);

  // Ready: once per rest block when timeLeft hits 3
  useEffect(() => {
    if (!currentBlock || currentBlock.type !== 'rest' || isPaused) return;
    if (timeLeft === 3 && !readyPlayedThisRestRef.current) {
      playReady();
      readyPlayedThisRestRef.current = true;
    }
  }, [currentBlock, timeLeft, isPaused]);

  const handlePhaseTransition = useCallback(() => {
    if (currentIndex >= timeline.length - 1) {
      onClose();
      return;
    }
    setHasStarted(true);
    const nextIdx = currentIndex + 1;
    const next = timeline[nextIdx];
    setCurrentIndex(nextIdx);
    setTimeLeft(next?.duration ?? 0);
  }, [currentIndex, timeline, onClose]);

  const handlePrevious = useCallback(() => {
    if (isTransitioningToNext) {
      const elapsed = currentBlock ? currentBlock.duration - timeLeft : 0;
      const nextExerciseIndex = Math.floor(elapsed / warmupDuration);
      const prevExerciseIndex = nextExerciseIndex - 1;
      if (prevExerciseIndex < 0) return;
      setIsTransitioningToNext(false);
      setTransitionCountdown(0);
      const timeLeftAtPrevExercise = currentBlock!
        .duration - prevExerciseIndex * warmupDuration;
      setTimeLeft(timeLeftAtPrevExercise);
      return;
    }
    if (currentBlock?.type === 'warmup') {
      const elapsed = currentBlock.duration - timeLeft;
      const currentExerciseIndex = Math.floor(elapsed / warmupDuration);
      const prevExerciseIndex = currentExerciseIndex - 1;
      if (prevExerciseIndex < 0) return;
      const timeLeftAtPrevExercise = currentBlock.duration - prevExerciseIndex * warmupDuration;
      setTimeLeft(timeLeftAtPrevExercise);
      return;
    }
    if (currentIndex <= 0) return;
    const prevIdx = currentIndex - 1;
    const prev = timeline[prevIdx];
    setCurrentIndex(prevIdx);
    setTimeLeft(prev?.duration ?? 0);
  }, [
    currentBlock,
    currentIndex,
    timeLeft,
    timeline,
    warmupDuration,
    isTransitioningToNext,
  ]);

  const handleSkip = useCallback(() => {
    if (isTransitioningToNext) {
      playBell();
      setIsTransitioningToNext(false);
      setTransitionCountdown(0);
      return;
    }
    if (currentBlock?.type === 'warmup') {
      const elapsed = currentBlock.duration - timeLeft;
      const currentExerciseIndex = Math.floor(elapsed / warmupDuration);
      const nextExerciseIndex = currentExerciseIndex + 1;
      if (nextExerciseIndex >= warmupList.length) {
        handlePhaseTransition();
        return;
      }
      const timeLeftAtNextExercise = currentBlock.duration - nextExerciseIndex * warmupDuration;
      setTimeLeft(timeLeftAtNextExercise);
      return;
    }
    handlePhaseTransition();
  }, [
    currentBlock,
    timeLeft,
    handlePhaseTransition,
    warmupDuration,
    warmupList,
    isTransitioningToNext,
  ]);

  // Main timer tick - pause during warmup transition
  useEffect(() => {
    if (
      !currentBlock ||
      !hasStarted ||
      isPaused ||
      isTransitioningToNext ||
      timeLeft <= 0
    )
      return;
    const interval = window.setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        // Warmup: check if we just completed an exercise (elapsed becomes multiple of warmupDuration)
        if (
          currentBlock.type === 'warmup' &&
          next >= 0 &&
          next < currentBlock.duration
        ) {
          const elapsedAfterTick = currentBlock.duration - next;
          const isExerciseBoundary =
            elapsedAfterTick > 0 &&
            elapsedAfterTick % warmupDuration === 0 &&
            Math.floor(elapsedAfterTick / warmupDuration) < warmupList.length;
          if (isExerciseBoundary) {
            const nextExerciseIndex = Math.floor(elapsedAfterTick / warmupDuration);
            const transitionSeconds = getWarmupTransitionSeconds(
              warmupList[nextExerciseIndex - 1].name,
              warmupList[nextExerciseIndex].name
            );
            playBell();
            setIsTransitioningToNext(true);
            setTransitionCountdown(transitionSeconds);
            return next;
          }
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [
    currentBlock,
    hasStarted,
    isPaused,
    isTransitioningToNext,
    timeLeft,
    warmupDuration,
    warmupList,
  ]);

  // Transition countdown timer (5s or 10s "Next" pause between warmup exercises)
  useEffect(() => {
    if (!isTransitioningToNext || transitionCountdown <= 0) return;
    const interval = window.setInterval(
      () =>
        setTransitionCountdown((prev) => {
          if (prev <= 1) {
            playBell();
            setIsTransitioningToNext(false);
            return 0;
          }
          return prev - 1;
        }),
      1000
    );
    return () => clearInterval(interval);
  }, [isTransitioningToNext, transitionCountdown]);

  useEffect(() => {
    if (currentBlock && hasStarted && !isPaused && !isTransitioningToNext && timeLeft === 0)
      queueMicrotask(() => handlePhaseTransition());
  }, [currentBlock, hasStarted, isPaused, isTransitioningToNext, timeLeft, handlePhaseTransition]);

  // Use same index as WarmUpWheel/counter; clamp only when indexing into warmupList.
  const sidebarExerciseIndex =
    isWarmupBlock && warmupList.length > 0
      ? Math.min(warmupActiveIndex, warmupList.length - 1)
      : 0;
  const isWarmupComplete = isWarmupBlock && warmupActiveIndex >= warmupList.length;

  const headerImageUrl = useMemo(() => {
    if (!currentBlock) return undefined;
    if (currentBlock.type === 'warmup' && warmupList.length > 0) {
      return warmupList[sidebarExerciseIndex]?.imageUrl;
    }
    return currentBlock.imageUrl;
  }, [currentBlock, warmupList, sidebarExerciseIndex]);

  useEffect(() => {
    queueMicrotask(() => setImageError(false));
  }, [headerImageUrl]);

  if (timeline.length === 0 || !currentBlock) return null;

  const headerBg =
    currentBlock.type === 'work'
      ? theme.workBg
      : currentBlock.type === 'rest'
        ? 'bg-blue-600'
        : 'bg-white/20';

  const phaseLabel =
    currentBlock.type === 'warmup'
      ? 'WARM UP'
      : currentBlock.type === 'setup'
        ? 'SETUP'
        : currentBlock.type === 'work'
          ? 'MAX EFFORT'
          : currentBlock.type === 'rest'
            ? 'RECOVERY'
            : 'COOLDOWN';

  const renderControls = (volumeId: string) => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor={volumeId} className="text-sm font-medium text-white/80">
          Volume
        </label>
        <div className="flex w-full items-center gap-3">
          <input
            id={volumeId}
            type="range"
            min={VOLUME_MIN}
            max={VOLUME_MAX}
            step={VOLUME_STEP}
            value={soundVolume}
            onChange={handleVolumeChange}
            className="h-2 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-[#ffbf00]"
            aria-label="Sound volume (low to 10x)"
          />
          <span className="w-8 shrink-0 text-right font-mono text-xs text-white/60" aria-hidden>
            {Math.round(soundVolume * 10)}×
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {!hasStarted ? (
          <button
            type="button"
            onClick={() => {
              if (currentBlock?.type === 'warmup') playBell();
              setHasStarted(true);
            }}
            className="rounded-xl bg-[#ffbf00] px-6 py-3 font-bold text-black"
          >
            START
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className="rounded-xl bg-white/10 px-6 py-3 font-bold text-white"
          >
            {isPaused ? 'RESUME' : 'PAUSE'}
          </button>
        )}
        {currentBlock?.type === 'warmup' && !hideSkipWarmup ? (
          <button
            type="button"
            onClick={handlePhaseTransition}
            className="rounded-xl bg-white/10 px-6 py-3 font-bold text-white hover:bg-white/20"
            aria-label="Skip warm-up"
          >
            Skip Warm-up
          </button>
        ) : null}
      </div>
    </div>
  );

  const containerClass = embedded
    ? 'absolute inset-0 z-0 flex h-full w-full flex-col overflow-hidden bg-[#0d0500]'
    : 'fixed inset-0 z-[200] flex h-full w-full flex-col overflow-hidden bg-[#0d0500]';

  return (
    <div className={containerClass}>
      <div
        className={`flex items-center justify-between gap-4 p-1 text-white transition-colors duration-300 sm:p-1.5 ${headerBg}`}
      >
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold uppercase opacity-80">{phaseLabel}</div>
          <h3 className="font-display line-clamp-2 text-2xl font-bold sm:text-3xl">
            {currentBlock.name}
          </h3>
          <p className="truncate text-sm opacity-90">{currentBlock.notes ?? 'Focus on form'}</p>
        </div>
        {hideClose ? null : (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 text-2xl leading-none"
            aria-label="Close timer"
          >
            &times;
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden pl-1 sm:pl-1.5">
        <aside className={`hidden md:flex md:min-h-0 md:flex-col md:shrink-0 md:p-4 md:gap-4 border-2 border-white/30 rounded-lg ${sidebarSlot ? 'md:w-[24rem]' : 'md:w-[20.84rem]'}`}>
          {renderControls('timer-volume')}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {currentBlock.type === 'warmup' &&
              (isWarmupComplete ? (
                <div className="mt-1 flex flex-col items-center justify-center gap-2 py-6 text-center">
                  <p className="font-display text-lg font-bold text-[#ffbf00]">Warm-up complete</p>
                  <p className="text-sm text-white/70">You're ready for the main workout.</p>
                </div>
              ) : (() => {
                const exercise = warmupList[sidebarExerciseIndex];
                const subtitle = exercise?.subtitle ?? '';
                const instructionSteps = exercise?.instructionSteps ?? [];
                const mistakeCorrections = exercise?.mistakeCorrections ?? [];
                const imageUrl = exercise?.imageUrl;
                return (
                  <div className="mt-1 flex flex-col gap-1">
                    {sidebarSlot ? (
                      <div className="w-full shrink-0">
                        {sidebarSlot}
                      </div>
                    ) : null}
                    {imageUrl && !imageError ? (
                      <div className={`w-full overflow-hidden rounded-lg border border-white/20 aspect-video shrink-0 ${sidebarSlot ? 'mt-2' : ''}`}>
                        <img
                          src={imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                          onError={() => setImageError(true)}
                        />
                      </div>
                    ) : null}
                    <ExerciseSubtitle text={subtitle} className="border-t border-white/10 pt-2" />
                    <ExpandableInstructions steps={instructionSteps} />
                    <ExpandableMistakesCorrections rows={mistakeCorrections} />
                  </div>
                );
              })())}
            {currentBlock.type !== 'warmup' &&
              (() => {
                const custom = customBlockInstructions?.find(
                  (c) => c.blockName === currentBlock.name
                );
                if (!custom?.steps.length) return null;
                return (
                  <div className="mt-1 flex min-h-0 flex-1 flex-col">
                    <ExpandableInstructions
                      steps={custom.steps}
                      title={custom.title ?? 'Instructions'}
                      defaultExpanded={true}
                      className="min-h-0 flex-1 shrink flex flex-col"
                      contentClassName="min-h-0 flex-1 overflow-y-auto pt-2"
                    />
                  </div>
                );
              })()}
          </div>
          <div className="mt-auto flex shrink-0 justify-center border-t border-white/10 pt-4">
            <RoundsCounter
              current={roundsCurrent}
              total={roundsTotal}
              label="Interval"
              className="text-center"
              valueIsOneBased={isWarmupBlock}
            />
          </div>
        </aside>
        <div
          className={`flex min-h-0 flex-1 flex-col items-center overflow-hidden ${currentBlock.type === 'warmup' ? 'justify-start gap-2 pt-0 sm:gap-3' : 'justify-center gap-6 md:flex-row md:gap-8'}`}
        >
        {currentBlock.type === 'warmup' && (
          <div className="flex w-full max-w-[900px] min-h-0 shrink-0 justify-center overflow-hidden">
            <WarmUpWheel
              elapsedSeconds={currentBlock.duration - timeLeft}
              exercises={warmupList}
              durationPerExercise={warmupDuration}
            />
          </div>
        )}
        <div className={`flex min-h-0 flex-1 flex-col items-center overflow-hidden ${currentBlock.type === 'warmup' ? 'justify-start' : 'justify-center'}`}>
          {currentBlock.type === 'setup' ? (
            <>
              <div className="mb-2 text-center text-sm font-bold uppercase tracking-wider text-white/70">
                Get Set
              </div>
              <div
                className="font-mono font-bold tabular-nums leading-none text-white"
                style={{ fontSize: 'clamp(4rem, 18vmin, 180px)' }}
              >
                {timeLeft}
              </div>
            </>
          ) : currentBlock.type === 'warmup' && isTransitioningToNext ? (
            <>
              <div className="mb-2 text-center text-sm font-bold uppercase tracking-wider text-white/70">
                Next
              </div>
              <div className="mb-2 text-center text-xl font-bold text-[#ffbf00] sm:text-2xl">
                {isWarmupComplete
                  ? (nextBlock?.name ?? 'Finish')
                  : (warmupList[sidebarExerciseIndex]?.name ?? 'Exercise')}
              </div>
              <div
                className="font-mono font-bold tabular-nums leading-none text-[#ffbf00]"
                style={{ fontSize: 'clamp(4rem, 18vmin, 180px)' }}
              >
                {transitionCountdown}
              </div>
              <p className="mt-4 text-sm text-white/60">
                Position yourself for the next exercise
              </p>
            </>
          ) : (
            <div
              className="font-mono font-bold tabular-nums leading-none text-white"
              style={{ fontSize: 'clamp(4rem, 18vmin, 180px)' }}
            >
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </div>
          )}

          <div className="mt-[10vh] w-full px-4 sm:px-6">
            <div className="h-4 overflow-hidden rounded-full bg-white/20">
              <div
                className={`h-full transition-all duration-1000 ease-linear ${
                  currentBlock.type === 'work' ? 'bg-white' : 'bg-blue-400'
                }`}
                style={{
                  width: `${(() => {
                    if (!hasStarted) return 0;
                    if (currentBlock.type === 'warmup' && isTransitioningToNext) return 100;
                    const elapsed = currentBlock.duration - timeLeft;
                    if (currentBlock.type === 'warmup') {
                      return Math.min(100, (elapsed / currentBlock.duration) * 100);
                    }
                    return Math.min(100, (elapsed / currentBlock.duration) * 100);
                  })()}%`,
                }}
              />
            </div>
            <div className="mt-2 flex justify-between font-mono text-xs text-white/50">
              <span>
                Next:{' '}
                {(() => {
                  if (currentBlock.type === 'warmup') {
                    const nextExercise = warmupList[sidebarExerciseIndex + 1];
                    return nextExercise ? nextExercise.name : nextBlock ? nextBlock.name : 'Finish';
                  }
                  return nextBlock ? nextBlock.name : 'Finish';
                })()}
              </span>
              <span>
                Total:{' '}
                {(() => {
                  if (currentBlock.type === 'warmup') {
                    const elapsed = currentBlock.duration - timeLeft;
                    const completedExercises = Math.floor(elapsed / warmupDuration);
                    return `${Math.round((completedExercises / warmupList.length) * 100)}%`;
                  }
                  return `${Math.round(((currentIndex + 1) / timeline.length) * 100)}%`;
                })()}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={(() => {
                  if (currentBlock?.type === 'warmup') {
                    const elapsed = currentBlock.duration - timeLeft;
                    return Math.floor(elapsed / warmupDuration) === 0;
                  }
                  if (currentBlock?.type === 'setup') return false;
                  return currentIndex === 0;
                })()}
                className="font-bold text-white/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-white/60"
                aria-label="Previous exercise"
              >
                ← PREVIOUS EXERCISE
              </button>
              <button
                type="button"
                onClick={handleSkip}
                className="font-bold text-white/60 hover:text-white"
              >
                {isTransitioningToNext
                  ? 'SKIP PAUSE →'
                  : currentBlock?.type === 'setup'
                    ? 'SKIP →'
                    : 'SKIP EXERCISE →'}
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsControlsDrawerOpen(true)}
        className="fixed bottom-6 right-6 z-[210] flex items-center justify-center rounded-full bg-[#ffbf00] px-5 py-3 font-bold text-black shadow-lg md:hidden"
        aria-label="Open controls"
      >
        Controls
      </button>

      <button
        type="button"
        className={`fixed inset-0 z-[205] bg-black/50 transition-opacity duration-300 md:hidden ${isControlsDrawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setIsControlsDrawerOpen(false)}
        aria-label="Close controls"
      />

      <div
        className={`fixed inset-x-0 bottom-0 z-[210] max-h-[70vh] overflow-y-auto rounded-t-xl border-t border-white/10 bg-[#0d0500] p-4 transition-transform duration-300 ease-out md:hidden ${isControlsDrawerOpen ? 'translate-y-0' : 'translate-y-full'}`}
        role="dialog"
        aria-label="Timer controls"
      >
        {renderControls('timer-volume-drawer')}
        <button
          type="button"
          onClick={() => setIsControlsDrawerOpen(false)}
          className="mt-4 w-full rounded-xl bg-white/10 py-3 font-bold text-white"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default IntervalTimerOverlay;
