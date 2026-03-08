/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Supabase admin persistence for Workout Factory sets.
 * Replaces Firestore usage in admin Workout Factory APIs.
 */

import { getSupabaseServer } from '@/lib/supabase/server';
import { normalizeWorkoutSet } from '@/lib/program-schedule-utils';
import type {
  WorkoutSetTemplate,
  WorkoutConfig,
  WorkoutLibraryItem,
  WorkoutInSet,
  WorkoutChainMetadata,
} from '@/types/ai-workout';
import type { Goals, UserDemographics } from '@/types/ai-program';

const DEFAULT_TARGET_AUDIENCE: UserDemographics = {
  ageRange: '26-35',
  sex: 'Male',
  weight: 180,
  experienceLevel: 'intermediate',
};

type ConfigRow = {
  difficulty?: string;
  targetAudience?: UserDemographics;
  equipmentProfile?: { zoneId?: string; equipmentIds?: string[] };
  goals?: unknown;
  workoutConfig?: WorkoutConfig;
};

type Row = {
  id: string;
  title: string;
  description: string | null;
  author_id: string;
  status: string;
  config: ConfigRow | null;
  chain_metadata: Record<string, unknown> | null;
  workouts: WorkoutInSet[];
  workout_count: number;
  created_at: string;
  updated_at: string;
};

function rowToLibraryItem(row: Row): WorkoutLibraryItem {
  const config = row.config ?? {};
  return {
    id: row.id,
    title: row.title || 'Untitled Workout Set',
    description: row.description ?? '',
    difficulty:
      config.difficulty === 'beginner' ||
      config.difficulty === 'intermediate' ||
      config.difficulty === 'advanced'
        ? config.difficulty
        : 'intermediate',
    targetAudience: config.targetAudience ?? DEFAULT_TARGET_AUDIENCE,
    equipmentProfile: config.equipmentProfile,
    goals: config.goals as Goals | undefined,
    workoutConfig: config.workoutConfig,
    chain_metadata: row.chain_metadata
      ? ({
          ...row.chain_metadata,
          generated_at: row.chain_metadata.generated_at,
        } as WorkoutChainMetadata)
      : undefined,
    status: row.status === 'published' ? 'published' : 'draft',
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    authorId: row.author_id,
    workoutCount: row.workout_count ?? (Array.isArray(row.workouts) ? row.workouts.length : 0),
  };
}

/**
 * Fetch all workout sets for admin list. Returns [] on any error (dev/MVP friendly when no workouts yet).
 */
export async function fetchWorkoutLibrary(): Promise<WorkoutLibraryItem[]> {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('workout_sets')
      .select(
        'id, title, description, author_id, status, config, chain_metadata, workouts, workout_count, created_at, updated_at'
      )
      .order('created_at', { ascending: false });

    if (error) {
      if (import.meta.env.DEV) console.warn('[workout-sets] fetchWorkoutLibrary error:', error);
      return [];
    }
    return (data ?? []).map((r) => rowToLibraryItem(r as Row));
  } catch (err) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[workout-sets] fetchWorkoutLibrary error:', err);
    }
    return [];
  }
}

export async function createWorkoutSet(
  authorId: string,
  workoutSet: WorkoutSetTemplate,
  workoutConfig: WorkoutConfig,
  chainMetadata?: WorkoutChainMetadata
): Promise<string> {
  const normalized = normalizeWorkoutSet(workoutSet);
  const supabase = getSupabaseServer();

  const config: ConfigRow = {
    difficulty: normalized.difficulty,
    targetAudience: workoutConfig.targetAudience,
    goals: workoutConfig.goals,
    workoutConfig,
  };
  if (workoutConfig.zoneId !== undefined) {
    config.equipmentProfile = {
      zoneId: workoutConfig.zoneId,
      equipmentIds: workoutConfig.selectedEquipmentIds ?? [],
    };
  }

  const chainData: Record<string, unknown> | null = chainMetadata
    ? {
        step1_workout_architect: chainMetadata.step1_workout_architect,
        step2_biomechanist: chainMetadata.step2_biomechanist,
        step3_coach: chainMetadata.step3_coach,
        step4_workout_mathematician: chainMetadata.step4_workout_mathematician,
        generated_at: chainMetadata.generated_at,
        model_used: chainMetadata.model_used,
        ...(chainMetadata.total_tokens !== undefined && {
          total_tokens: chainMetadata.total_tokens,
        }),
      }
    : null;

  const { data: inserted, error: insertError } = await supabase
    .from('workout_sets')
    .insert({
      title: normalized.title,
      description: normalized.description ?? '',
      author_id: authorId,
      status: 'draft',
      config,
      chain_metadata: chainData,
      workouts: normalized.workouts ?? [],
      workout_count: (normalized.workouts ?? []).length,
    })
    .select('id')
    .single();

  if (insertError) throw insertError;
  if (!inserted?.id) throw new Error('Failed to create workout set');
  return inserted.id;
}

/** Full document shape for GET /api/admin/workouts/:id */
export interface WorkoutDocument {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  targetAudience: WorkoutLibraryItem['targetAudience'];
  equipmentProfile?: WorkoutLibraryItem['equipmentProfile'];
  goals?: WorkoutLibraryItem['goals'];
  workoutConfig?: WorkoutConfig;
  chain_metadata?: WorkoutLibraryItem['chain_metadata'];
  status: 'draft' | 'published';
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  workoutCount: number;
  workouts: WorkoutInSet[];
}

export async function fetchWorkoutDocument(workoutId: string): Promise<WorkoutDocument> {
  const supabase = getSupabaseServer();
  const { data: row, error } = await supabase
    .from('workout_sets')
    .select(
      'id, title, description, author_id, status, config, chain_metadata, workouts, workout_count, created_at, updated_at'
    )
    .eq('id', workoutId)
    .single();

  if (error || !row) throw new Error(`Workout with ID ${workoutId} not found`);
  const r = row as Row;
  const config = r.config ?? {};
  return {
    id: r.id,
    title: r.title || 'Untitled Workout Set',
    description: r.description ?? '',
    difficulty:
      config.difficulty === 'beginner' ||
      config.difficulty === 'intermediate' ||
      config.difficulty === 'advanced'
        ? config.difficulty
        : 'intermediate',
    targetAudience: config.targetAudience ?? DEFAULT_TARGET_AUDIENCE,
    equipmentProfile: config.equipmentProfile,
    goals: config.goals as Goals | undefined,
    workoutConfig: config.workoutConfig,
    chain_metadata: r.chain_metadata
      ? ({
          ...r.chain_metadata,
          generated_at: r.chain_metadata.generated_at,
        } as WorkoutChainMetadata)
      : undefined,
    status: r.status === 'published' ? 'published' : 'draft',
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
    authorId: r.author_id,
    workoutCount: r.workout_count ?? (Array.isArray(r.workouts) ? r.workouts.length : 0),
    workouts: Array.isArray(r.workouts) ? r.workouts : [],
  };
}

export async function updateWorkoutSet(
  workoutId: string,
  updates: {
    status?: 'draft' | 'published';
    workoutSet?: WorkoutSetTemplate;
    workoutConfig?: WorkoutConfig;
  }
): Promise<void> {
  const supabase = getSupabaseServer();
  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (updates.status !== undefined) {
    updatePayload.status = updates.status;
  }
  if (updates.workoutSet) {
    const normalized = normalizeWorkoutSet(updates.workoutSet);
    updatePayload.title = normalized.title;
    updatePayload.description = normalized.description ?? '';
    updatePayload.workouts = normalized.workouts ?? [];
    updatePayload.workout_count = (normalized.workouts ?? []).length;
    const config: ConfigRow = { difficulty: normalized.difficulty };
    if (updates.workoutConfig) {
      config.targetAudience = updates.workoutConfig.targetAudience;
      config.goals = updates.workoutConfig.goals;
      config.workoutConfig = updates.workoutConfig;
      if (updates.workoutConfig.zoneId !== undefined) {
        config.equipmentProfile = {
          zoneId: updates.workoutConfig.zoneId,
          equipmentIds: updates.workoutConfig.selectedEquipmentIds ?? [],
        };
      }
    }
    updatePayload.config = config;
  } else if (updates.workoutConfig) {
    const { data: existing } = await supabase
      .from('workout_sets')
      .select('config')
      .eq('id', workoutId)
      .single();
    const currentConfig = (existing?.config as ConfigRow) ?? {};
    const config: ConfigRow = {
      ...currentConfig,
      targetAudience: updates.workoutConfig.targetAudience,
      goals: updates.workoutConfig.goals,
      workoutConfig: updates.workoutConfig,
    };
    if (updates.workoutConfig.zoneId !== undefined) {
      config.equipmentProfile = {
        zoneId: updates.workoutConfig.zoneId,
        equipmentIds: updates.workoutConfig.selectedEquipmentIds ?? [],
      };
    }
    updatePayload.config = config;
  }

  const { error } = await supabase.from('workout_sets').update(updatePayload).eq('id', workoutId);
  if (error) throw error;
}

export async function updateWorkoutStatus(
  workoutId: string,
  status: 'draft' | 'published'
): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('workout_sets')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', workoutId);
  if (error) throw error;
}

export async function deleteWorkoutSet(workoutId: string): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase.from('workout_sets').delete().eq('id', workoutId);
  if (error) throw error;
}
