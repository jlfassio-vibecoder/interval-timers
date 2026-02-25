/**
 * Reusable full-screen interval timer overlay. Queue-based: walks a timeline
 * of blocks (warmup / work / rest / cooldown), plays shared sounds at phase
 * transitions, same look for all 11 interval timers.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { HIITTimelineBlock } from '@/types/ai-workout';
import {
  playWorkStart,
  playRestStart,
  playReady,
  playRoundComplete,
  playCooldownStart,
  playBell,
} from '@/lib/interval-timer-sounds';
import WarmUpWheel from './WarmUpWheel';
import WarmupInstructionsPanel from './WarmupInstructionsPanel';
import type { WarmUpExercise } from './WarmUpWheel';
import {
  WARMUP_EXERCISES,
  WARMUP_DURATION_PER_EXERCISE,
  WARMUP_TRANSITION_SECONDS,
} from './interval-timer-warmup';

const WARMUP_INSTRUCTIONS_PREFERENCE_KEY = 'warmup-instructions-preference';

export interface IntervalTimerOverlayTheme {
  workBg: string;
}

interface IntervalTimerOverlayProps {
  timeline: HIITTimelineBlock[];
  onClose: () => void;
  theme?: IntervalTimerOverlayTheme;
  /** Enriched warmup exercises (imageUrl, instructions). When provided, used for warmup block header image and wheel. */
  warmupExercises?: WarmUpExercise[];
  /** Duration per warmup exercise in seconds. Used with warmupExercises. */
  warmupDurationPerExercise?: number;
}

const DEFAULT_THEME: IntervalTimerOverlayTheme = { workBg: 'bg-red-600' };

const IntervalTimerOverlay: React.FC<IntervalTimerOverlayProps> = ({
  timeline,
  onClose,
  theme = DEFAULT_THEME,
  warmupExercises,
  warmupDurationPerExercise = WARMUP_DURATION_PER_EXERCISE,
}) => {
  const warmupList: WarmUpExercise[] =
    warmupExercises ?? WARMUP_EXERCISES.map((e) => ({ name: e.name, detail: e.detail }));
  const warmupDuration = warmupDurationPerExercise ?? WARMUP_DURATION_PER_EXERCISE;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isTransitioningToNext, setIsTransitioningToNext] = useState(false);
  const [transitionCountdown, setTransitionCountdown] = useState(0);
  const [instructionsDismissedThisSession, setInstructionsDismissedThisSession] = useState(false);
  const readyPlayedThisRestRef = useRef(false);
  const prevBlockTypeRef = useRef<HIITTimelineBlock['type'] | null>(null);

  const currentBlock = timeline[currentIndex];
  const nextBlock = timeline[currentIndex + 1] ?? null;

  // Initialize timeLeft when timeline or index changes (e.g. after skip/previous)
  useEffect(() => {
    const block = timeline[currentIndex];
    if (block) {
      setTimeLeft(block.duration);
      if (block.type === 'rest') readyPlayedThisRestRef.current = false;
    }
  }, [timeline, currentIndex]);

  // Play sound when entering a new block (including initial)
  useEffect(() => {
    if (!currentBlock) return;
    const type = currentBlock.type;
    const prevType = prevBlockTypeRef.current;

    if (type === 'work') playWorkStart();
    else if (type === 'rest') {
      playRestStart();
      if (prevType === 'work') playRoundComplete();
    } else if (type === 'cooldown') playCooldownStart();

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
    warmupList.length,
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
            playBell();
            setIsTransitioningToNext(true);
            setTransitionCountdown(WARMUP_TRANSITION_SECONDS);
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
    warmupList.length,
  ]);

  // Transition countdown timer (5s "Next" pause between warmup exercises)
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
      handlePhaseTransition();
  }, [currentBlock, hasStarted, isPaused, isTransitioningToNext, timeLeft, handlePhaseTransition]);

  const headerImageUrl = useMemo(() => {
    if (!currentBlock) return undefined;
    if (currentBlock.type === 'warmup' && warmupList.length > 0) {
      const elapsed = currentBlock.duration - timeLeft;
      const idx = Math.min(Math.floor(elapsed / warmupDuration), warmupList.length - 1);
      return warmupList[idx]?.imageUrl;
    }
    return currentBlock.imageUrl;
  }, [currentBlock, timeLeft, warmupList, warmupDuration]);

  useEffect(() => {
    setImageError(false);
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
      : currentBlock.type === 'work'
        ? 'MAX EFFORT'
        : currentBlock.type === 'rest'
          ? 'RECOVERY'
          : 'COOLDOWN';

  return (
    <div className="fixed inset-0 z-[200] flex h-full w-full flex-col overflow-hidden bg-[#0d0500]">
      <div
        className={`flex items-center justify-between gap-4 p-4 text-white transition-colors duration-300 sm:p-6 ${headerBg}`}
      >
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold uppercase opacity-80">{phaseLabel}</div>
          <h3 className="font-display truncate text-2xl font-bold sm:text-3xl">
            {currentBlock.name}
          </h3>
          <p className="truncate text-sm opacity-90">{currentBlock.notes ?? 'Focus on form'}</p>
        </div>
        {headerImageUrl && !imageError ? (
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-white/20 md:h-32 md:w-32">
            <img
              src={headerImageUrl}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setImageError(true)}
            />
          </div>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 p-2 text-2xl leading-none"
          aria-label="Close timer"
        >
          &times;
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-hidden md:flex-row md:gap-8">
        {currentBlock.type === 'warmup' && (
          <div className="flex w-full max-w-[400px] justify-center md:max-w-none md:flex-1 md:justify-end">
            <WarmUpWheel
              elapsedSeconds={currentBlock.duration - timeLeft}
              exercises={warmupList}
              durationPerExercise={warmupDuration}
            />
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
          {currentBlock.type === 'warmup' && isTransitioningToNext ? (
            <>
              <div className="mb-2 text-center text-sm font-bold uppercase tracking-wider text-white/70">
                Next
              </div>
              <div className="mb-2 text-center text-xl font-bold text-[#ffbf00] sm:text-2xl">
                {(() => {
                  const elapsed = currentBlock.duration - timeLeft;
                  const nextIdx = Math.min(
                    Math.floor(elapsed / warmupDuration),
                    warmupList.length - 1
                  );
                  return warmupList[nextIdx]?.name ?? 'Exercise';
                })()}
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

          <div className="mt-4 w-full px-8 sm:mt-6 md:mt-10">
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
                      const withinExercise = elapsed % warmupDuration;
                      return Math.min(100, (withinExercise / warmupDuration) * 100);
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
                    const elapsed = currentBlock.duration - timeLeft;
                    const exerciseIndex = Math.min(
                      Math.floor(elapsed / warmupDuration),
                      warmupList.length - 1
                    );
                    const nextExercise = warmupList[exerciseIndex + 1];
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
          </div>
        </div>
        {currentBlock.type === 'warmup' &&
          warmupList.length > 0 &&
          (() => {
            const elapsed = currentBlock.duration - timeLeft;
            const idx = Math.min(Math.floor(elapsed / warmupDuration), warmupList.length - 1);
            const exercise = warmupList[idx];
            const instructionSteps = exercise?.instructionSteps ?? [];
            const hidePreference =
              typeof window !== 'undefined' &&
              localStorage.getItem(WARMUP_INSTRUCTIONS_PREFERENCE_KEY) === 'hide';
            const showPanel =
              instructionSteps.length > 0 &&
              !hidePreference &&
              !instructionsDismissedThisSession;
            if (!showPanel) return null;
            return (
              <WarmupInstructionsPanel
                exerciseName={exercise?.name ?? 'Exercise'}
                steps={instructionSteps}
                onClose={() => setInstructionsDismissedThisSession(true)}
                onNeverShowAgain={() => {
                  if (typeof window !== 'undefined') {
                    localStorage.setItem(WARMUP_INSTRUCTIONS_PREFERENCE_KEY, 'hide');
                  }
                  setInstructionsDismissedThisSession(true);
                }}
              />
            );
          })()}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 p-4 sm:p-6 md:p-8">
        <button
          type="button"
          onClick={handlePrevious}
          disabled={(() => {
            if (currentBlock?.type === 'warmup') {
              const elapsed = currentBlock.duration - timeLeft;
              return Math.floor(elapsed / warmupDuration) === 0;
            }
            return currentIndex === 0;
          })()}
          className="font-bold text-white/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-white/60"
          aria-label="Previous exercise"
        >
          ← PREVIOUS EXERCISE
        </button>
        {!hasStarted ? (
          <button
            type="button"
            onClick={() => {
              if (currentBlock?.type === 'warmup') playBell();
              setHasStarted(true);
            }}
            className="max-w-[200px] flex-1 rounded-xl bg-[#ffbf00] px-8 py-4 font-bold text-black"
          >
            START
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className="max-w-[200px] flex-1 rounded-xl bg-white/10 px-8 py-4 font-bold text-white"
          >
            {isPaused ? 'RESUME' : 'PAUSE'}
          </button>
        )}
        <button
          type="button"
          onClick={handleSkip}
          className="font-bold text-white/60 hover:text-white"
        >
          {isTransitioningToNext ? 'SKIP PAUSE →' : 'SKIP EXERCISE →'}
        </button>
      </div>
    </div>
  );
};

export default IntervalTimerOverlay;
