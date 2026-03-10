/**
 * Scrollable warm-up exercise wheel. Advances every 30s when started.
 * Centered item is highlighted; others faded. Optional progress bar per segment.
 * Shows name + detail only; image and Execution Protocol steps are shown in the overlay header.
 */
import React from 'react';
import { WARMUP_EXERCISES, WARMUP_DURATION_PER_EXERCISE } from './interval-timer-warmup';

const ITEM_HEIGHT = 80;
const CONTAINER_HEIGHT = 240; // ~3 items visible
const CENTER_OFFSET = CONTAINER_HEIGHT / 2 - ITEM_HEIGHT / 2; // 80px top padding

export interface WarmUpExercise {
  name: string;
  detail: string;
  imageUrl?: string;
  instructions?: string[];
}

interface WarmUpWheelProps {
  /** Current elapsed time in the warm-up block (in seconds). Controlled by parent. */
  elapsedSeconds: number;
  /** Enriched exercises from API (name, detail, imageUrl?, instructions?). If omitted, uses static WARMUP_EXERCISES. */
  exercises?: WarmUpExercise[];
  /** Duration per exercise in seconds. Used with elapsedSeconds to compute active index. */
  durationPerExercise?: number;
}

const WarmUpWheel: React.FC<WarmUpWheelProps> = ({
  elapsedSeconds,
  exercises: exercisesProp,
  durationPerExercise: durationProp,
}) => {
  const exercises =
    exercisesProp ?? WARMUP_EXERCISES.map((e) => ({ name: e.name, detail: e.detail }));
  const durationPerExercise = durationProp ?? WARMUP_DURATION_PER_EXERCISE;

  const activeIndex = Math.min(Math.floor(elapsedSeconds / durationPerExercise), exercises.length);
  const isFinished = activeIndex >= exercises.length;
  const segmentProgress =
    activeIndex < exercises.length
      ? ((elapsedSeconds % durationPerExercise) / durationPerExercise) * 100
      : 100;
  const translateY = -(activeIndex * ITEM_HEIGHT);

  return (
    <div
      className="relative w-full max-w-[400px] flex-shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/30"
      style={{ height: CONTAINER_HEIGHT }}
    >
      {/* Top fade mask */}
      <div
        className="pointer-events-none absolute left-0 right-0 z-10"
        style={{
          height: ITEM_HEIGHT,
          background: 'linear-gradient(to bottom, #0d0500, transparent)',
        }}
      />
      {/* Bottom fade mask */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 z-10"
        style={{
          height: ITEM_HEIGHT,
          background: 'linear-gradient(to top, #0d0500, transparent)',
        }}
      />

      <div
        className="flex flex-col items-center transition-transform duration-[600ms] ease-[cubic-bezier(0.33,1,0.68,1)]"
        style={{
          transform: `translateY(${translateY}px)`,
          marginTop: CENTER_OFFSET,
        }}
      >
        {exercises.map((exercise, index) => {
          const isActive = index === activeIndex;
          return (
            <div
              key={index}
              className="flex w-full flex-col items-center justify-center text-center transition-all duration-300"
              style={{
                height: ITEM_HEIGHT,
                opacity: isActive ? 1 : 0.3,
                transform: isActive ? 'scale(1.1)' : 'scale(0.9)',
              }}
            >
              <div className="flex w-full items-center justify-center px-4">
                <div className="min-w-0 flex-1 text-center">
                  <h3 className="font-display m-0 text-lg font-bold text-white">{exercise.name}</h3>
                  {exercise.detail && (
                    <span className="mt-1 block text-sm text-white/70">{exercise.detail}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div
          className="flex w-full flex-col items-center justify-center text-center transition-all duration-300"
          style={{
            height: ITEM_HEIGHT,
            opacity: activeIndex === exercises.length ? 1 : 0.3,
            transform: activeIndex === exercises.length ? 'scale(1.1)' : 'scale(0.9)',
          }}
        >
          <h3 className="font-display m-0 text-lg font-bold text-orange-light">
            Warm-up Complete!
          </h3>
        </div>
      </div>

      {elapsedSeconds > 0 && !isFinished && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
          <div
            className="h-full bg-orange-light transition-all duration-1000 ease-linear"
            style={{ width: `${segmentProgress}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default WarmUpWheel;
