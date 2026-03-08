/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Workouts index page content: LevelFilter + filtered WORKOUTS by intensity band.
 */

import React, { useState, useMemo } from 'react';
import ArtistCard, { type OptimizedImageMeta } from '@/components/react/ArtistCard';
import LevelFilter, { type LevelFilterValue } from '@/components/react/LevelFilter';
import { WORKOUTS } from '@/data/workouts';
import type { Artist } from '@/types';

export interface WorkoutsIndexContentProps {
  optimizedImages?: Record<string, OptimizedImageMeta>;
}

function filterByLevel(items: Artist[], level: LevelFilterValue): Artist[] {
  if (level === 'all') return items;
  if (level === 'beginner') return items.filter((a) => a.intensity >= 1 && a.intensity <= 2);
  if (level === 'intermediate') return items.filter((a) => a.intensity === 3);
  if (level === 'advanced') return items.filter((a) => a.intensity >= 4 && a.intensity <= 5);
  return items;
}

const WorkoutsIndexContent: React.FC<WorkoutsIndexContentProps> = ({ optimizedImages }) => {
  const [selectedLevel, setSelectedLevel] = useState<LevelFilterValue>('all');
  const filtered = useMemo(() => filterByLevel(WORKOUTS, selectedLevel), [selectedLevel]);

  const handleSelect = (workout: Artist) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('selectWorkout', { detail: workout, bubbles: true, cancelable: true })
      );
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <div className="mb-8 md:mb-10">
        <h1 className="mb-6 font-heading text-4xl font-bold leading-tight md:mb-8 md:text-5xl">
          Workouts
        </h1>
        <p className="max-w-3xl text-lg font-light leading-relaxed text-gray-200 md:text-xl">
          AI-generated fusion zone workouts: prescribe by intensity and assign to clients in
          seconds.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-6 rounded-xl border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-white/90">
            Filter
          </h2>
          <LevelFilter selectedLevel={selectedLevel} onLevelChange={setSelectedLevel} />
        </aside>

        <div className="min-w-0">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-12 text-center backdrop-blur-sm">
              <p className="text-white/60">No workouts at this level.</p>
            </div>
          ) : (
            <div className="relative z-10 grid grid-cols-1 border-l border-t border-white/10 bg-black/20 backdrop-blur-sm md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((workout) => (
                <ArtistCard
                  key={workout.id}
                  artist={workout}
                  onClick={() => handleSelect(workout)}
                  optimizedImage={optimizedImages?.[workout.id]}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkoutsIndexContent;
