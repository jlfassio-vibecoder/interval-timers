/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Dynamic Protocol Engine: queue-based interval timer that renders
 * AI-generated HIIT formats (EMOM, ratios, ladders) from HIITWorkoutData.
 */

import React, { useState, useCallback } from 'react';
import type { HIITWorkoutData, HIITTargetGoal } from '@/types/ai-workout';
import IntervalTimerOverlay from './interval-timers/IntervalTimerOverlay';

interface DynamicHIITIntervalProps {
  workout: HIITWorkoutData;
  onClose: () => void;
}

function getThemeClasses(targetGoal: HIITTargetGoal): {
  text: string;
  bg: string;
  border: string;
} {
  switch (targetGoal) {
    case 'VO2':
      return {
        text: 'text-red-600',
        bg: 'bg-red-600',
        border: 'border-red-200',
      };
    case 'Lactate':
      return {
        text: 'text-orange-500',
        bg: 'bg-orange-500',
        border: 'border-orange-200',
      };
    case 'Power':
      return {
        text: 'text-blue-600',
        bg: 'bg-blue-600',
        border: 'border-blue-200',
      };
    case 'FatOx':
      return {
        text: 'text-slate-600',
        bg: 'bg-slate-600',
        border: 'border-slate-200',
      };
    default:
      return {
        text: 'text-orange-light',
        bg: 'bg-orange-light',
        border: 'border-orange-light/50',
      };
  }
}

const DynamicHIITInterval: React.FC<DynamicHIITIntervalProps> = ({ workout, onClose }) => {
  const [isTimerOpen, setIsTimerOpen] = useState(false);

  const timeline = workout?.timeline ?? [];
  const _totalDuration = timeline.reduce((acc, b) => acc + b.duration, 0);

  const workBlocks = timeline.filter((t) => t.type === 'work');
  const restBlocks = timeline.filter((t) => t.type === 'rest');
  // Avoid showing misleading "30s : 30s" when timeline has no work segments (invalid HIIT structure).
  const avgWork = workBlocks.length > 0 ? workBlocks[0].duration : 30;
  const avgRest = restBlocks.length > 0 ? restBlocks[0].duration : 30;

  const startTimer = useCallback(() => {
    setIsTimerOpen(true);
  }, []);

  // No work segments → invalid HIIT structure; avoid showing misleading "30s : 30s" fallback.
  if (workBlocks.length === 0) return null;

  const theme = getThemeClasses(workout.meta.targetGoal);

  return (
    <div className="min-h-screen bg-bg-dark pb-20 font-sans text-slate-100">
      <nav className="bg-bg-dark/95 sticky top-0 z-50 border-b border-white/10 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <span className="font-display text-lg font-bold text-white">
            Pillar 4 · <span className="font-normal text-white/60">{workout.meta.protocol}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-black/50 p-2 text-white hover:bg-white/10"
            aria-label="Close"
          >
            <span className="text-xl leading-none">&times;</span>
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6">
        <section className="mx-auto max-w-4xl text-center">
          <div
            className={`mb-4 inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase ${theme.text}`}
          >
            {workout.meta.targetGoal} FOCUS
          </div>
          <h1 className="font-display mb-6 text-4xl font-bold text-white md:text-5xl">
            {workout.meta.title}
          </h1>
          <p className="mb-10 text-xl text-white/70">{workout.meta.description}</p>
          <button
            type="button"
            onClick={startTimer}
            className={`px-8 py-4 ${theme.bg} rounded-xl font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5 hover:brightness-110`}
          >
            Launch Interval Timer
          </button>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 md:p-12">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <h2 className="font-display mb-4 text-3xl font-bold text-white">
                {workout.science.title}
              </h2>
              <p className="mb-6 leading-relaxed text-white/70">{workout.science.summary}</p>
              <div className={`space-y-4 rounded-xl border-l-4 bg-white/5 p-6 ${theme.border}`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden>
                    🧪
                  </span>
                  <div>
                    <div className="text-sm font-bold text-white">Primary Benefit</div>
                    <div className="text-xs text-white/60">{workout.science.benefit1}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden>
                    ⚡
                  </span>
                  <div>
                    <div className="text-sm font-bold text-white">Secondary Benefit</div>
                    <div className="text-xs text-white/60">{workout.science.benefit2}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex h-[200px] flex-col items-center justify-center rounded-xl bg-white/5">
              <p className="mb-2 font-bold text-white/50">Work : Rest Ratio</p>
              <p className="font-mono text-4xl font-bold text-orange-light">
                {avgWork}s : {avgRest}s
              </p>
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-6 text-center text-2xl font-bold text-white">Sequence Architecture</h3>
          <div className="mx-auto max-w-2xl space-y-3">
            {timeline.map((block, idx) => (
              <div
                key={idx}
                className="flex items-center rounded-lg border border-white/10 bg-white/5 p-4"
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                    block.type === 'work'
                      ? theme.bg
                      : block.type === 'rest'
                        ? 'bg-blue-600'
                        : 'bg-white/20'
                  }`}
                >
                  {block.type === 'work' ? 'GO' : block.type === 'rest' ? 'RST' : 'PRE'}
                </div>
                <div className="ml-4 min-w-0 flex-1">
                  <div className="truncate font-bold text-white">{block.name}</div>
                  {block.notes && (
                    <div className="truncate text-xs text-white/50">{block.notes}</div>
                  )}
                </div>
                <div className="ml-2 shrink-0 font-mono font-bold text-white/40">
                  {block.duration}s
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {isTimerOpen && (
        <IntervalTimerOverlay
          timeline={timeline}
          onClose={() => setIsTimerOpen(false)}
          theme={{ workBg: theme.bg }}
        />
      )}
    </div>
  );
};

export default DynamicHIITInterval;
