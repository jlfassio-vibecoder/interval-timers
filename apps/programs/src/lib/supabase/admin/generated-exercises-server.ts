/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Server-side helpers for generated_exercises. Replaces Firestore access in exercise admin API routes.
 */

import type { GeneratedExercise } from '@/types/generated-exercise';
import { getSupabaseServer } from '../server';

function toIso(v: string | null | undefined): string {
  if (!v) return new Date().toISOString();
  if (typeof v === 'string' && v.includes('T')) return v;
  return new Date(v).toISOString();
}

function mapRowToExercise(row: Record<string, unknown>): GeneratedExercise {
  const ts = (s: string) =>
    ({
      toDate: () => new Date(s),
      toISOString: () => s,
    }) as unknown as GeneratedExercise['createdAt'];
  return {
    id: String(row.id),
    slug: String(row.slug ?? ''),
    exerciseName: String(row.exercise_name ?? ''),
    imageUrl: String(row.image_url ?? ''),
    storagePath: String(row.storage_path ?? ''),
    kineticChainType: String(row.kinetic_chain_type ?? ''),
    biomechanics: (row.biomechanics as GeneratedExercise['biomechanics']) ?? {},
    imagePrompt: String(row.image_prompt ?? ''),
    complexityLevel: String(row.complexity_level ?? ''),
    visualStyle: String(row.visual_style ?? ''),
    sources: (row.sources as GeneratedExercise['sources']) ?? [],
    status: (row.status as GeneratedExercise['status']) ?? 'pending',
    generatedBy: String(row.generated_by ?? ''),
    generatedAt: ts(toIso(row.generated_at as string)),
    createdAt: ts(toIso(row.created_at as string)),
    updatedAt: ts(toIso(row.updated_at as string)),
    rejectedAt: row.rejected_at ? ts(toIso(row.rejected_at as string)) : undefined,
    rejectedBy: row.rejected_by as string | undefined,
    rejectionReason: row.rejection_reason as string | undefined,
    deepDiveHtmlContent: row.deep_dive_html_content as string | undefined,
    suitableBlocks: row.suitable_blocks as GeneratedExercise['suitableBlocks'],
    mainWorkoutType: row.main_workout_type as GeneratedExercise['mainWorkoutType'],
    videoUrl: row.video_url as string | undefined,
    videoStoragePath: row.video_storage_path as string | undefined,
    videos: row.videos as GeneratedExercise['videos'],
  };
}

/**
 * Fetch a generated exercise by id. Returns null if not found.
 */
export async function getGeneratedExerciseById(id: string): Promise<GeneratedExercise | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('generated_exercises')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[getGeneratedExerciseById]', error);
    }
    throw error;
  }

  if (!data) return null;
  return mapRowToExercise(data as Record<string, unknown>);
}

/**
 * Update deep dive HTML for an exercise.
 */
export async function updateGeneratedExerciseDeepDive(
  id: string,
  deepDiveHtmlContent: string
): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('generated_exercises')
    .update({ deep_dive_html_content: deepDiveHtmlContent, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[updateGeneratedExerciseDeepDive]', error);
    }
    throw error;
  }
}

/**
 * Update videos array for an exercise (append or replace).
 */
export async function updateGeneratedExerciseVideos(
  id: string,
  videos: GeneratedExercise['videos']
): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('generated_exercises')
    .update({ videos: videos ?? [], updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[updateGeneratedExerciseVideos]', error);
    }
    throw error;
  }
}
