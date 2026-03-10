/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import ArtistCard, { type OptimizedImageMeta } from './ArtistCard';
import { WORKOUTS } from '../../data/workouts';
import type { Artist } from '@/types';

interface WorkoutCardsProps {
  optimizedImages?: Record<string, OptimizedImageMeta>;
}

const WorkoutCards: React.FC<WorkoutCardsProps> = ({ optimizedImages }) => {
  const handleSelect = (workout: Artist) => {
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('selectWorkout', {
        detail: workout,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(event);
    }
  };

  return (
    <div className="relative z-10 grid grid-cols-1 border-l border-t border-white/10 bg-black/20 backdrop-blur-sm md:grid-cols-2 lg:grid-cols-3">
      {WORKOUTS.map((workout) => (
        <ArtistCard
          key={workout.id}
          artist={workout}
          onClick={() => handleSelect(workout)}
          optimizedImage={optimizedImages?.[workout.id]}
        />
      ))}
    </div>
  );
};

export default WorkoutCards;
