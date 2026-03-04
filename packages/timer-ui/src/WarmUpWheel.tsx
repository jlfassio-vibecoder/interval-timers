/**
 * Scrollable warm-up exercise wheel. Advances every 30s when started.
 * Centered item is highlighted; others faded. Optional progress bar per segment.
 * Shows name + detail only; image and Execution Protocol steps are handled by the surrounding sidebar/layout UI.
 */
import React, { useState, useEffect } from 'react';
import {
  WARMUP_EXERCISES,
  WARMUP_DURATION_PER_EXERCISE,
} from '@interval-timers/timer-core';
import type { WarmupExercise } from './useWarmupConfig';

const TAILWIND_BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280 };

const DIMENSIONS_BY_BREAKPOINT: Record<
  'default' | 'sm' | 'md' | 'lg' | 'xl',
  { containerHeight: number; itemHeight: number; itemGap: number }
> = {
  default: { containerHeight: 300, itemHeight: 100, itemGap: 48 },
  sm: { containerHeight: 330, itemHeight: 110, itemGap: 52 },
  md: { containerHeight: 360, itemHeight: 120, itemGap: 56 },
  lg: { containerHeight: 400, itemHeight: 140, itemGap: 64 },
  xl: { containerHeight: 460, itemHeight: 160, itemGap: 72 },
};

function useWarmupWheelDimensions(): {
  itemHeight: number;
  itemGap: number;
  containerHeight: number;
  centerOffset: number;
} {
  const getBreakpoint = (): keyof typeof DIMENSIONS_BY_BREAKPOINT => {
    if (typeof window === 'undefined') return 'lg';
    const w = window.innerWidth;
    if (w >= TAILWIND_BREAKPOINTS.xl) return 'xl';
    if (w >= TAILWIND_BREAKPOINTS.lg) return 'lg';
    if (w >= TAILWIND_BREAKPOINTS.md) return 'md';
    if (w >= TAILWIND_BREAKPOINTS.sm) return 'sm';
    return 'default';
  };

  const [breakpoint, setBreakpoint] = useState<keyof typeof DIMENSIONS_BY_BREAKPOINT>(getBreakpoint);

  useEffect(() => {
    const media = [
      window.matchMedia(`(min-width: ${TAILWIND_BREAKPOINTS.xl}px)`),
      window.matchMedia(`(min-width: ${TAILWIND_BREAKPOINTS.lg}px)`),
      window.matchMedia(`(min-width: ${TAILWIND_BREAKPOINTS.md}px)`),
      window.matchMedia(`(min-width: ${TAILWIND_BREAKPOINTS.sm}px)`),
    ];
    const update = () => setBreakpoint(getBreakpoint());
    media.forEach((m) => m.addEventListener('change', update));
    update();
    return () => media.forEach((m) => m.removeEventListener('change', update));
  }, []);

  const { containerHeight, itemHeight, itemGap } = DIMENSIONS_BY_BREAKPOINT[breakpoint];
  const centerOffset = containerHeight / 2 - itemHeight / 2;

  return { itemHeight, itemGap, containerHeight, centerOffset };
}

interface WarmUpWheelProps {
  /** Current elapsed time in the warm-up block (in seconds). Controlled by parent. */
  elapsedSeconds: number;
  /** Enriched exercises from API (name, detail, imageUrl?, instructions?). If omitted, uses static WARMUP_EXERCISES. */
  exercises?: WarmupExercise[];
  /** Duration per exercise in seconds. Used with elapsedSeconds to compute active index. */
  durationPerExercise?: number;
}

const WarmUpWheel: React.FC<WarmUpWheelProps> = ({
  elapsedSeconds,
  exercises: exercisesProp,
  durationPerExercise: durationProp,
}) => {
  const { itemHeight, itemGap, containerHeight, centerOffset } = useWarmupWheelDimensions();
  const exercises =
    exercisesProp ?? WARMUP_EXERCISES.map((e) => ({ name: e.name, detail: e.detail }));
  const durationPerExercise = durationProp ?? WARMUP_DURATION_PER_EXERCISE;

  const activeIndex = Math.min(Math.floor(elapsedSeconds / durationPerExercise), exercises.length);
  const isFinished = activeIndex >= exercises.length;
  const segmentProgress =
    activeIndex < exercises.length
      ? ((elapsedSeconds % durationPerExercise) / durationPerExercise) * 100
      : 100;
  const translateY = -(activeIndex * (itemHeight + itemGap));

  return (
    <div
      className="relative w-full max-w-[900px] flex-shrink-0 overflow-hidden"
      style={{ height: containerHeight }}
    >
      <div
        className="flex w-full flex-col items-center transition-transform duration-[600ms] ease-[cubic-bezier(0.33,1,0.68,1)] px-4 sm:px-6"
        style={{
          transform: `translateY(${translateY}px)`,
          marginTop: centerOffset * 0.5,
          gap: itemGap,
        }}
      >
        {exercises.map((exercise, index) => {
          const isActive = index === activeIndex;
          return (
            <div
              key={index}
              className="flex w-full flex-col items-center justify-center text-center transition-all duration-300 min-w-0"
              style={{
                height: itemHeight,
                opacity: isActive ? 1 : 0.3,
              }}
            >
              <div className="flex w-full min-w-0 items-center justify-center px-2 sm:px-3">
                <div className="min-w-0 flex-1 text-center">
                  <h3
                    className={`font-display m-0 min-w-0 font-bold line-clamp-2 ${isActive ? 'text-[#ffbf00]' : 'text-white'}`}
                    style={{ fontSize: 'clamp(1.75rem, 4.5vw, 4rem)' }}
                  >
                    {exercise.name}
                  </h3>
                  {exercise.detail && (
                    <span
                      className={`mt-3 block min-w-0 line-clamp-1 ${isActive ? 'text-[#ffbf00]/80' : 'text-white/70'}`}
                      style={{ fontSize: 'clamp(1rem, 2.5vw, 1.5rem)' }}
                    >
                      {exercise.detail}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div
          className="flex w-full flex-col items-center justify-center text-center transition-all duration-300"
          style={{
            height: itemHeight,
            opacity: activeIndex === exercises.length ? 1 : 0.3,
          }}
        >
          <h3
            className="font-display m-0 min-w-0 font-bold line-clamp-2 text-[#ffbf00]"
            style={{ fontSize: 'clamp(1.75rem, 4.5vw, 4rem)' }}
          >
            Warm-up Complete!
          </h3>
        </div>
      </div>

      {elapsedSeconds > 0 && !isFinished && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
          <div
            className="h-full bg-[#ffbf00] transition-all duration-1000 ease-linear"
            style={{ width: `${segmentProgress}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default WarmUpWheel;
