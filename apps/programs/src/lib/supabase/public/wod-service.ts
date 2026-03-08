/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Server-side service for generated_wods. Fetches published WODs for public API and SSR.
 * Replaces firebase/public/wod-service.
 */

import type { GeneratedWODDoc } from '@/types/generated-wod';
import type { WorkoutDetail, Exercise } from '@/types';
import { getSupabaseServer } from '../server';

/** Server-side serialized WOD (timestamps as ISO strings for JSON). */
export type SerializedGeneratedWOD = Omit<GeneratedWODDoc, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

function toIsoString(value: string | null | undefined): string {
  if (!value) return new Date().toISOString();
  if (value.includes('T') || value.length > 10) return value;
  return new Date(value + 'T00:00:00Z').toISOString();
}

function mapRowToSerializedWOD(row: {
  id: string;
  level: string | null;
  name: string | null;
  genre: string | null;
  image: string | null;
  day: string | null;
  description: string | null;
  intensity: number | null;
  workout_detail: unknown;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  author_id: string | null;
  exercise_overrides: unknown;
  target_volume_minutes: number | null;
  window_minutes: number | null;
  rest_load: string | null;
}): SerializedGeneratedWOD {
  const workoutDetail = row.workout_detail as WorkoutDetail | undefined;
  if (!workoutDetail || typeof workoutDetail !== 'object') {
    throw new Error(`Invalid workout_detail for WOD ${row.id}`);
  }

  return {
    id: row.id,
    level: (row.level as GeneratedWODDoc['level']) ?? 'intermediate',
    name: row.name ?? '',
    genre: row.genre ?? '',
    image: row.image ?? '',
    day: row.day ?? 'WOD',
    description: row.description ?? '',
    intensity: typeof row.intensity === 'number' ? row.intensity : 3,
    workoutDetail,
    status: (row.status as GeneratedWODDoc['status']) ?? 'pending',
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    generatedBy: row.author_id ?? undefined,
    exerciseOverrides: row.exercise_overrides as Record<string, Exercise> | undefined,
    targetVolumeMinutes:
      typeof row.target_volume_minutes === 'number' ? row.target_volume_minutes : undefined,
    windowMinutes: typeof row.window_minutes === 'number' ? row.window_minutes : undefined,
    restLoad: typeof row.rest_load === 'string' ? row.rest_load : undefined,
  };
}

/**
 * Fetch published (approved) WODs for the public list.
 */
export async function getPublishedWODs(): Promise<SerializedGeneratedWOD[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('generated_wods')
    .select(
      'id, level, name, genre, image, day, description, intensity, workout_detail, status, created_at, updated_at, author_id, exercise_overrides, target_volume_minutes, window_minutes, rest_load'
    )
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[getPublishedWODs] Error fetching generated_wods:', error);
    }
    throw error;
  }

  return (data ?? []).map(mapRowToSerializedWOD);
}
