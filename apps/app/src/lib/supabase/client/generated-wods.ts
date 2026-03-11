/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Client-side service for generated_wods. Replaces firebase/client/generated-wods.
 */

import { supabase } from '../supabase-instance';
import type {
  GeneratedWODDoc,
  CreateGeneratedWODInput,
  GeneratedWODStatus,
} from '@/types/generated-wod';
import type { Exercise } from '@/types';

/** Fake Timestamp-like for compatibility with GeneratedWODDoc (toDate()). */
function toTimestampLike(iso: string): { toDate: () => Date } {
  return {
    toDate: () => new Date(iso),
  };
}

function mapRowToDoc(row: Record<string, unknown>): GeneratedWODDoc {
  const toTs = (v: unknown) =>
    toTimestampLike(
      typeof v === 'string'
        ? v
        : v != null
          ? new Date(v as string | number).toISOString()
          : new Date().toISOString()
    );
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
    status: (row.status as GeneratedWODStatus) ?? 'pending',
    createdAt: toTs(row.created_at) as unknown as GeneratedWODDoc['createdAt'],
    updatedAt: toTs(row.updated_at) as unknown as GeneratedWODDoc['updatedAt'],
    generatedBy: row.author_id as string | undefined,
    exerciseOverrides: row.exercise_overrides as Record<string, Exercise> | undefined,
    iteration: row.iteration as GeneratedWODDoc['iteration'],
    parameters: row.parameters as GeneratedWODDoc['parameters'],
    resolvedFormat: row.resolved_format as GeneratedWODDoc['resolvedFormat'],
    targetVolumeMinutes: row.target_volume_minutes as number | undefined,
    windowMinutes: row.window_minutes as number | undefined,
    restLoad: row.rest_load as string | undefined,
  } as GeneratedWODDoc;
}

/**
 * Create a generated_wods row. Caller must be authenticated; author_id will be set from session.
 */
export async function createGeneratedWOD(
  input: Omit<CreateGeneratedWODInput, 'createdAt' | 'updatedAt'>
): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error('User must be authenticated to create a WOD');

  const payload = {
    title: input.name || 'Untitled WOD',
    level: input.level ?? 'intermediate',
    name: input.name ?? '',
    genre: input.genre ?? '',
    image: input.image ?? '',
    day: input.day ?? 'WOD',
    description: input.description ?? '',
    intensity: input.intensity ?? 3,
    workout_detail: input.workoutDetail,
    status: input.status ?? 'pending',
    author_id: session.user.id,
    exercise_overrides: input.exerciseOverrides ?? null,
    iteration: input.iteration ?? null,
    parameters: input.parameters ?? null,
    resolved_format: input.resolvedFormat ?? null,
    target_volume_minutes: input.targetVolumeMinutes ?? null,
    window_minutes: input.windowMinutes ?? null,
    rest_load: input.restLoad ?? null,
  };

  const { data, error } = await supabase
    .from('generated_wods')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

/**
 * Get all generated WODs for the current user, optionally filtered by status.
 */
export async function getGeneratedWODs(
  statusFilter?: GeneratedWODStatus
): Promise<GeneratedWODDoc[]> {
  let query = supabase.from('generated_wods').select('*').order('created_at', { ascending: false });
  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => mapRowToDoc(row as Record<string, unknown>));
}

/**
 * Update the status of a generated WOD (publish/unpublish).
 */
export async function updateGeneratedWODStatus(
  id: string,
  status: GeneratedWODStatus
): Promise<void> {
  const { error } = await supabase
    .from('generated_wods')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Update or add an exercise override for a specific exercise in a WOD.
 */
export async function updateExerciseOverride(
  wodId: string,
  exerciseName: string,
  exercise: Exercise
): Promise<void> {
  const { data: row } = await supabase
    .from('generated_wods')
    .select('exercise_overrides')
    .eq('id', wodId)
    .single();
  const current = (row?.exercise_overrides as Record<string, Exercise>) ?? {};
  const next = { ...current, [exerciseName]: exercise };
  const { error } = await supabase
    .from('generated_wods')
    .update({ exercise_overrides: next, updated_at: new Date().toISOString() })
    .eq('id', wodId);
  if (error) throw error;
}

/**
 * Update the display name of a generated WOD.
 */
export async function updateGeneratedWODName(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  const { error } = await supabase
    .from('generated_wods')
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Get a single generated WOD by id. Returns null if not found.
 */
export async function getGeneratedWODById(id: string): Promise<GeneratedWODDoc | null> {
  const { data, error } = await supabase.from('generated_wods').select('*').eq('id', id).single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? mapRowToDoc(data as Record<string, unknown>) : null;
}
