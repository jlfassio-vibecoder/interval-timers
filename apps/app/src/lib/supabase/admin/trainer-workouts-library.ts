/**
 * Trainer-owned public.workouts: read, update, fork (new lineage vs new version).
 */

import { randomUUID } from 'node:crypto';
import { getSupabaseServer } from '@/lib/supabase/server';

/** Pure helper for unit tests: next version index after the max in a lineage. */
export function nextVersionAfterMax(
  maxVersionIndex: number | null | undefined,
  fallbackCurrent: number
): number {
  if (typeof maxVersionIndex === 'number' && Number.isFinite(maxVersionIndex)) {
    return maxVersionIndex + 1;
  }
  return fallbackCurrent + 1;
}

export interface TrainerLibraryWorkoutRow {
  id: string;
  trainerId: string;
  title: string;
  description: string | null;
  durationMinutes: number | null;
  difficultyLevel: string | null;
  blocks: unknown;
  source: string;
  visibility: string;
  aiChainMetadata: unknown | null;
  lineageId: string;
  versionIndex: number;
  supersedesWorkoutId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function mapRow(r: Record<string, unknown>): TrainerLibraryWorkoutRow {
  return {
    id: String(r.id),
    trainerId: String(r.trainer_id),
    title: typeof r.title === 'string' && r.title.trim() ? r.title.trim() : 'Workout',
    description: typeof r.description === 'string' ? r.description : null,
    durationMinutes:
      typeof r.duration_minutes === 'number' && Number.isFinite(r.duration_minutes)
        ? r.duration_minutes
        : null,
    difficultyLevel: typeof r.difficulty_level === 'string' ? r.difficulty_level : null,
    blocks: r.blocks ?? [],
    source: typeof r.source === 'string' ? r.source : 'manual',
    visibility: typeof r.visibility === 'string' ? r.visibility : 'draft',
    aiChainMetadata: r.ai_chain_metadata ?? null,
    lineageId: String(r.lineage_id),
    versionIndex: typeof r.version_index === 'number' ? r.version_index : 1,
    supersedesWorkoutId:
      typeof r.supersedes_workout_id === 'string' ? r.supersedes_workout_id : null,
    createdAt: r.created_at != null ? String(r.created_at) : null,
    updatedAt: r.updated_at != null ? String(r.updated_at) : null,
  };
}

/** Load a trainer library row; returns null if not found or not owned by trainer. */
export async function fetchTrainerLibraryWorkoutOwned(
  trainerUserId: string,
  workoutId: string
): Promise<TrainerLibraryWorkoutRow | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('workouts')
    .select(
      'id, trainer_id, title, description, duration_minutes, difficulty_level, blocks, source, visibility, ai_chain_metadata, lineage_id, version_index, supersedes_workout_id, created_at, updated_at'
    )
    .eq('id', workoutId)
    .eq('trainer_id', trainerUserId)
    .maybeSingle();

  if (error || !data) {
    if (import.meta.env.DEV) console.warn('[trainer-workouts-library] fetch', error);
    return null;
  }
  return mapRow(data as Record<string, unknown>);
}

/** All versions in a lineage for this trainer, ascending by version_index. */
export async function listTrainerLibraryWorkoutsByLineage(
  trainerUserId: string,
  lineageId: string
): Promise<TrainerLibraryWorkoutRow[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('workouts')
    .select(
      'id, trainer_id, title, description, duration_minutes, difficulty_level, blocks, source, visibility, ai_chain_metadata, lineage_id, version_index, supersedes_workout_id, created_at, updated_at'
    )
    .eq('trainer_id', trainerUserId)
    .eq('lineage_id', lineageId)
    .order('version_index', { ascending: true });

  if (error) {
    if (import.meta.env.DEV) console.warn('[trainer-workouts-library] list lineage', error);
    return [];
  }
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function patchTrainerLibraryWorkout(
  trainerUserId: string,
  workoutId: string,
  patch: {
    title?: string;
    description?: string | null;
    durationMinutes?: number | null;
    blocks?: unknown;
    visibility?: 'draft' | 'ready' | 'assigned';
    difficultyLevel?: string | null;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await fetchTrainerLibraryWorkoutOwned(trainerUserId, workoutId);
  if (!existing) return { ok: false, error: 'Workout not found' };

  const supabase = getSupabaseServer();
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title.trim() || existing.title;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.durationMinutes !== undefined) update.duration_minutes = patch.durationMinutes;
  if (patch.blocks !== undefined) update.blocks = patch.blocks;
  if (patch.visibility !== undefined) update.visibility = patch.visibility;
  if (patch.difficultyLevel !== undefined) update.difficulty_level = patch.difficultyLevel;

  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await supabase.from('workouts').update(update).eq('id', workoutId).eq('trainer_id', trainerUserId);

  if (error) {
    if (import.meta.env.DEV) console.warn('[trainer-workouts-library] patch', error);
    return { ok: false, error: 'Failed to update workout' };
  }
  return { ok: true };
}

export type ForkMode = 'new_lineage' | 'new_version';

export async function forkTrainerLibraryWorkout(
  trainerUserId: string,
  sourceWorkoutId: string,
  mode: ForkMode,
  editorState: {
    title: string;
    description: string | null;
    durationMinutes: number | null;
    blocks: unknown;
    difficultyLevel?: string | null;
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const source = await fetchTrainerLibraryWorkoutOwned(trainerUserId, sourceWorkoutId);
  if (!source) return { ok: false, error: 'Workout not found' };

  const supabase = getSupabaseServer();

  if (mode === 'new_lineage') {
    const newTitle =
      editorState.title.trim() ||
      (source.title.startsWith('Copy of ') ? source.title : `Copy of ${source.title}`);
    const insert = {
      program_id: null as string | null,
      trainer_id: trainerUserId,
      title: newTitle,
      description: editorState.description ?? source.description,
      duration_minutes: editorState.durationMinutes ?? source.durationMinutes,
      difficulty_level: editorState.difficultyLevel ?? source.difficultyLevel ?? 'intermediate',
      blocks: editorState.blocks,
      status: 'active',
      source: source.source === 'ai_factory' || source.source === 'manual' ? source.source : 'manual',
      ai_chain_metadata: source.aiChainMetadata,
      visibility: source.visibility as 'draft' | 'ready' | 'assigned',
      lineage_id: randomUUID(),
      version_index: 1,
      supersedes_workout_id: null as string | null,
    };

    const { data, error } = await supabase.from('workouts').insert(insert).select('id').single();
    if (error || !data?.id) {
      if (import.meta.env.DEV) console.warn('[trainer-workouts-library] fork new_lineage', error);
      return { ok: false, error: 'Failed to create workout' };
    }
    return { ok: true, id: data.id as string };
  }

  // new_version: same lineage_id, next version_index
  const { data: maxRow, error: maxErr } = await supabase
    .from('workouts')
    .select('version_index')
    .eq('trainer_id', trainerUserId)
    .eq('lineage_id', source.lineageId)
    .order('version_index', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxErr) {
    if (import.meta.env.DEV) console.warn('[trainer-workouts-library] fork max version', maxErr);
    return { ok: false, error: 'Failed to resolve version' };
  }

  const nextVersion = nextVersionAfterMax(
    typeof (maxRow as { version_index?: number } | null)?.version_index === 'number'
      ? (maxRow as { version_index: number }).version_index
      : null,
    source.versionIndex
  );

  const insert = {
    program_id: null as string | null,
    trainer_id: trainerUserId,
    title: editorState.title.trim() || source.title,
    description: editorState.description ?? source.description,
    duration_minutes: editorState.durationMinutes ?? source.durationMinutes,
    difficulty_level: editorState.difficultyLevel ?? source.difficultyLevel ?? 'intermediate',
    blocks: editorState.blocks,
    status: 'active',
    source: source.source === 'ai_factory' || source.source === 'manual' ? source.source : 'manual',
    ai_chain_metadata: source.aiChainMetadata,
    visibility: source.visibility as 'draft' | 'ready' | 'assigned',
    lineage_id: source.lineageId,
    version_index: nextVersion,
    supersedes_workout_id: sourceWorkoutId,
  };

  const { data, error } = await supabase.from('workouts').insert(insert).select('id').single();
  if (error || !data?.id) {
    if (import.meta.env.DEV) console.warn('[trainer-workouts-library] fork new_version', error);
    return { ok: false, error: 'Failed to save new version' };
  }
  return { ok: true, id: data.id as string };
}
