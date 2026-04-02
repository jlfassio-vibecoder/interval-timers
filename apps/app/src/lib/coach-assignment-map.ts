/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Map Supabase workout blocks / rows to Artist + WorkoutDetail for assigned workout flows.
 */

import type { WorkoutBlock } from '@/lib/supabase/admin/workout-details';
import type { Artist, WorkoutComponent, WorkoutDetail } from '@/types';

export function workoutBlocksToWorkoutDetail(blocks: unknown, fallbackTitle: string): WorkoutDetail {
  const arr = Array.isArray(blocks) ? (blocks as WorkoutBlock[]) : [];
  const find = (t: WorkoutBlock['type']) => arr.find((b) => b.type === t);
  const toComp = (b: WorkoutBlock | undefined, def: string): WorkoutComponent => ({
    title: b?.name?.trim() || def,
    duration: '—',
    exercises: (b?.exercises ?? []).map((e) => e.name).filter(Boolean),
  });
  return {
    warmup: toComp(find('warmup'), 'Warm-up'),
    main: toComp(find('main'), fallbackTitle),
    finisher: toComp(find('finisher'), 'Finisher'),
    cooldown: toComp(find('cooldown'), 'Cool down'),
  };
}

const DEFAULT_ASSIGNED_IMAGE = '/images/outdoor-calisthenics-workout-001.jpg';

export function supabaseWorkoutRowToArtist(row: {
  id: string;
  title: string;
  description: string | null;
  blocks: unknown;
}): Artist {
  const detail = workoutBlocksToWorkoutDetail(row.blocks, row.title);
  return {
    id: row.id,
    name: row.title,
    genre: 'Coach workout',
    image: DEFAULT_ASSIGNED_IMAGE,
    day: 'Assigned',
    description: row.description?.trim() || 'Assigned by your coach.',
    intensity: 3,
    workoutDetail: detail,
  };
}
