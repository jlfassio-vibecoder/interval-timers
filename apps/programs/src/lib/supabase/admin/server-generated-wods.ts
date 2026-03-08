/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Server-side operations for generated_wods. Replaces firebase/admin/server-generated-wods.
 */

import type { GeneratedWODDoc } from '@/types/generated-wod';
import { getSupabaseServer } from '../server';

/**
 * Get a single generated WOD by id (server-side).
 * Returns null if not found. Maps DB row to GeneratedWODDoc (createdAt/updatedAt as ISO strings; callers treat as serializable).
 */
export async function getGeneratedWODByIdServer(id: string): Promise<GeneratedWODDoc | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.from('generated_wods').select('*').eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[getGeneratedWODByIdServer] Error:', error);
    }
    throw error;
  }

  if (!data) return null;

  const row = data as Record<string, unknown>;
  const toIso = (v: unknown): string => {
    if (v == null) return new Date().toISOString();
    if (typeof v === 'string')
      return v.includes('T') ? v : new Date(v + 'T00:00:00Z').toISOString();
    if (typeof (v as { toISOString?: () => string }).toISOString === 'function')
      return (v as Date).toISOString();
    return String(v);
  };

  return {
    id: String(row.id),
    level: (row.level as GeneratedWODDoc['level']) ?? 'intermediate',
    name: (row.name as string) ?? '',
    genre: (row.genre as string) ?? '',
    image: (row.image as string) ?? '',
    day: (row.day as string) ?? 'WOD',
    description: (row.description as string) ?? '',
    intensity: typeof row.intensity === 'number' ? row.intensity : 3,
    workoutDetail: row.workout_detail as GeneratedWODDoc['workoutDetail'],
    status: (row.status as GeneratedWODDoc['status']) ?? 'pending',
    createdAt: toIso(row.created_at) as unknown as GeneratedWODDoc['createdAt'],
    updatedAt: toIso(row.updated_at) as unknown as GeneratedWODDoc['updatedAt'],
    generatedBy: row.author_id as string | undefined,
    exerciseOverrides: row.exercise_overrides as GeneratedWODDoc['exerciseOverrides'],
    iteration: row.iteration as GeneratedWODDoc['iteration'],
    parameters: row.parameters as GeneratedWODDoc['parameters'],
    resolvedFormat: row.resolved_format as GeneratedWODDoc['resolvedFormat'],
    targetVolumeMinutes: row.target_volume_minutes as number | undefined,
    windowMinutes: row.window_minutes as number | undefined,
    restLoad: row.rest_load as string | undefined,
  } as GeneratedWODDoc;
}
