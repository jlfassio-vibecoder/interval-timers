/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  workoutBlocksToWorkoutDetail,
  supabaseWorkoutRowToArtist,
} from '@/lib/coach-assignment-map';

describe('workoutBlocksToWorkoutDetail', () => {
  it('maps typed blocks to WorkoutDetail', () => {
    const detail = workoutBlocksToWorkoutDetail(
      [
        {
          type: 'warmup',
          name: 'Prep',
          exercises: [{ name: 'Arm circles' }],
          order: 0,
        },
        {
          type: 'main',
          name: 'Strength',
          exercises: [{ name: 'Squat' }, { name: 'Press' }],
          order: 1,
        },
      ],
      'Main block title'
    );
    expect(detail.warmup.title).toBe('Prep');
    expect(detail.warmup.exercises).toEqual(['Arm circles']);
    expect(detail.main.title).toBe('Strength');
    expect(detail.main.exercises).toEqual(['Squat', 'Press']);
    expect(detail.finisher.title).toBe('Finisher');
  });

  it('uses fallback title for main when missing block', () => {
    const detail = workoutBlocksToWorkoutDetail([], 'Custom title');
    expect(detail.main.title).toBe('Custom title');
  });
});

describe('supabaseWorkoutRowToArtist', () => {
  it('builds Artist with workoutDetail', () => {
    const artist = supabaseWorkoutRowToArtist({
      id: 'w1',
      title: 'Leg day',
      description: 'Coach notes',
      blocks: [
        {
          type: 'main',
          name: 'Legs',
          exercises: [{ name: 'Squat' }],
          order: 0,
        },
      ],
    });
    expect(artist.id).toBe('w1');
    expect(artist.name).toBe('Leg day');
    expect(artist.description).toBe('Coach notes');
    expect(artist.workoutDetail?.main.exercises).toEqual(['Squat']);
  });
});
