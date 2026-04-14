/**
 * Mission Control — system Daily Warm-up (same preset as interval timers and Live “Load saved”).
 */

import React from 'react';
import {
  DEFAULT_WARMUP_TOTAL_SECONDS,
  WARMUP_DURATION_PER_EXERCISE,
  WARMUP_EXERCISES,
} from '@/components/react/interval-timers/interval-timer-warmup';

const TrainerWarmupsView: React.FC = () => {
  const minutes = Math.round(DEFAULT_WARMUP_TOTAL_SECONDS / 60);

  return (
    <div className="mx-auto max-w-5xl pb-12">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-bold">Warmups</h1>
        <p className="mt-2 text-white/60">
          The <strong className="text-white/80">Daily Warm-up</strong> is a system preset shared by
          all trainers. It matches the warm-up used in interval timers and appears in{' '}
          <span className="font-mono text-xs text-orange-light/90">Live</span> when you set{' '}
          <span className="text-white/80">Add block</span> to <span className="text-white/80">Warm-up</span>{' '}
          and choose <span className="text-white/80">Load saved</span> → Daily Warm-up.
        </p>
      </header>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-1 font-heading text-lg font-semibold text-white">Daily Warm-up</h2>
        <p className="mb-4 text-sm text-white/50">
          {WARMUP_EXERCISES.length} exercises × {WARMUP_DURATION_PER_EXERCISE}s each (~{minutes}{' '}
          min total).
        </p>
        <ol className="list-decimal space-y-3 pl-5 text-sm text-white/85">
          {WARMUP_EXERCISES.map((ex, i) => (
            <li key={`${ex.name}-${ex.detail}-${i}`}>
              <span className="font-medium text-white">{ex.name}</span>
              {ex.detail ? (
                <span className="block text-white/45">{ex.detail}</span>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};

export default TrainerWarmupsView;
