/**
 * Server-side generated exercise fetch. Replaces firebase/public/generated-exercise-service.
 */

import { getSupabaseServer } from '../server';
import { toTimestampLike } from '@/types/timestamp';
import type {
  GeneratedExercise,
  GeneratedExerciseStatus,
  ParsedBiomechanics,
  ExerciseSource,
  SuitableBlock,
  MainWorkoutType,
} from '@/types/generated-exercise';

/** Server-side serialized exercise (timestamps as ISO strings for SSR) */
export type SerializedGeneratedExercise = Omit<
  GeneratedExercise,
  'generatedAt' | 'createdAt' | 'updatedAt' | 'rejectedAt'
> & {
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
  rejectedAt?: string;
  deepDiveHtmlContent?: string;
};

function toDate(v: string | null | undefined): Date {
  if (!v) return new Date();
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date() : d;
}

function toIso(v: string | null | undefined): string {
  if (!v) return new Date().toISOString();
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function asParsedBiomechanics(
  data: Record<string, unknown> | null | undefined
): ParsedBiomechanics {
  const d = data ?? {};
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  return {
    biomechanicalChain: str(d.biomechanicalChain),
    pivotPoints: str(d.pivotPoints),
    stabilizationNeeds: str(d.stabilizationNeeds),
    commonMistakes: arr(d.commonMistakes),
    performanceCues: arr(d.performanceCues),
  };
}

function toTimestamp(d: Date) {
  return toTimestampLike(d);
}

interface GeneratedExerciseRow {
  id: string;
  slug: string;
  exercise_name: string;
  image_url: string | null;
  storage_path: string | null;
  kinetic_chain_type: string | null;
  biomechanics: Record<string, unknown> | null;
  image_prompt: string | null;
  complexity_level: string | null;
  visual_style: string | null;
  sources: unknown[] | null;
  status: string;
  generated_by: string;
  created_at: string | null;
  updated_at: string | null;
  generated_at: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  deep_dive_html_content: string | null;
  user_friendly_instructions: string | null;
  suitable_blocks: unknown[] | null;
  main_workout_type: string | null;
  video_url: string | null;
  video_storage_path: string | null;
  videos: unknown[] | null;
}

function mapRow(row: GeneratedExerciseRow): GeneratedExercise {
  return {
    id: row.id,
    slug: row.slug,
    exerciseName: row.exercise_name,
    imageUrl: row.image_url ?? '',
    storagePath: row.storage_path ?? '',
    kineticChainType: row.kinetic_chain_type ?? '',
    biomechanics: (row.biomechanics ?? {}) as unknown as ParsedBiomechanics,
    imagePrompt: row.image_prompt ?? '',
    complexityLevel: row.complexity_level ?? '',
    visualStyle: row.visual_style ?? '',
    sources: (row.sources ?? []) as ExerciseSource[],
    status: row.status as GeneratedExerciseStatus,
    generatedBy: row.generated_by,
    generatedAt: toTimestamp(toDate(row.generated_at)),
    createdAt: toTimestamp(toDate(row.created_at)),
    updatedAt: toTimestamp(toDate(row.updated_at)),
    rejectedAt: row.rejected_at ? toTimestamp(toDate(row.rejected_at)) : undefined,
    rejectedBy: row.rejected_by ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    deepDiveHtmlContent: row.deep_dive_html_content ?? undefined,
    userFriendlyInstructions: row.user_friendly_instructions ?? undefined,
    suitableBlocks: (row.suitable_blocks ?? []) as SuitableBlock[],
    mainWorkoutType: (row.main_workout_type ?? undefined) as MainWorkoutType,
    videoUrl: row.video_url ?? undefined,
    videoStoragePath: row.video_storage_path ?? undefined,
    videos: (row.videos ?? []) as GeneratedExercise['videos'],
  };
}

function mapRowToSerialized(row: GeneratedExerciseRow): SerializedGeneratedExercise {
  const biomechanics = asParsedBiomechanics((row.biomechanics ?? {}) as Record<string, unknown>);
  return {
    id: row.id,
    slug: row.slug,
    exerciseName: row.exercise_name,
    imageUrl: row.image_url ?? '',
    storagePath: row.storage_path ?? '',
    kineticChainType: row.kinetic_chain_type ?? 'MOVEMENT PATTERN',
    biomechanics,
    imagePrompt: row.image_prompt ?? '',
    complexityLevel: row.complexity_level ?? 'intermediate',
    visualStyle: row.visual_style ?? 'photorealistic',
    sources: (row.sources ?? []) as ExerciseSource[],
    status: row.status as GeneratedExerciseStatus,
    generatedBy: row.generated_by,
    generatedAt: toIso(row.generated_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    rejectedAt: row.rejected_at ? toIso(row.rejected_at) : undefined,
    rejectedBy: row.rejected_by ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    deepDiveHtmlContent: row.deep_dive_html_content ?? undefined,
    userFriendlyInstructions: row.user_friendly_instructions ?? undefined,
    suitableBlocks: (row.suitable_blocks ?? []) as SuitableBlock[],
    mainWorkoutType: (row.main_workout_type ?? undefined) as MainWorkoutType,
    videoUrl: row.video_url ?? undefined,
    videoStoragePath: row.video_storage_path ?? undefined,
    videos: (row.videos ?? []) as GeneratedExercise['videos'],
  };
}

export async function getGeneratedExerciseByIdServer(
  id: string
): Promise<GeneratedExercise | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('generated_exercises')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? mapRow(data as GeneratedExerciseRow) : null;
}

export async function getGeneratedExerciseBySlug(
  slug: string,
  requireApproved: boolean = true
): Promise<SerializedGeneratedExercise | null> {
  const supabase = getSupabaseServer();
  let query = supabase.from('generated_exercises').select('*').eq('slug', slug).limit(1);
  if (requireApproved) {
    query = query.eq('status', 'approved');
  }
  const { data, error } = await query;
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return mapRowToSerialized(row as GeneratedExerciseRow);
}

export async function getGeneratedExercises(
  statusFilter?: GeneratedExerciseStatus
): Promise<SerializedGeneratedExercise[]> {
  const supabase = getSupabaseServer();
  let query = supabase
    .from('generated_exercises')
    .select('*')
    .order('created_at', { ascending: false });
  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => mapRowToSerialized(row as GeneratedExerciseRow));
}

export async function getPublishedExercises(): Promise<SerializedGeneratedExercise[]> {
  return getGeneratedExercises('approved');
}
