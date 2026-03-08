/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * WOD index page content: LevelFilter + filtered WOD by name.
 */

import React, { useState, useMemo } from 'react';
import ArtistCard, { type OptimizedImageMeta } from '@/components/react/ArtistCard';
import LevelFilter, { type LevelFilterValue } from '@/components/react/LevelFilter';
import { WOD } from '@/data/wod';
import type { Artist } from '@/types';

export interface WODIndexContentProps {
  optimizedImages?: Record<string, OptimizedImageMeta>;
  /** When provided and non-empty, use published WODs from Firestore; otherwise use static WOD. */
  publishedWODs?: Artist[];
}

function filterByLevel(items: Artist[], level: LevelFilterValue): Artist[] {
  if (level === 'all') return items;
  const nameLower = level.toLowerCase();
  return items.filter((a) => a.name.toLowerCase() === nameLower);
}

const WODIndexContent: React.FC<WODIndexContentProps> = ({ optimizedImages, publishedWODs }) => {
  const [selectedLevel, setSelectedLevel] = useState<LevelFilterValue>('all');
  const sourceWODs = publishedWODs && publishedWODs.length > 0 ? publishedWODs : WOD;
  const filtered = useMemo(
    () => filterByLevel(sourceWODs, selectedLevel),
    [sourceWODs, selectedLevel]
  );

  const handleSelect = (workout: Artist) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('selectWorkout', { detail: workout, bubbles: true, cancelable: true })
      );
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:mb-10 md:flex-row md:items-end">
        <div>
          <h1 className="mb-2 font-heading text-4xl font-bold leading-tight md:text-5xl">WOD</h1>
          <p className="max-w-3xl text-lg font-light leading-relaxed text-gray-200 md:text-xl">
            Workout of the Day: one daily workout scaled by level.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <a
            href="/"
            className="rounded-full border border-white/10 bg-white/5 px-8 py-3 font-mono text-xs font-bold uppercase tracking-widest transition-all hover:bg-white/20"
          >
            Terminate Session
          </a>
        </div>
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
              <p className="text-white/60">No WODs at this level.</p>
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

export default WODIndexContent;
