/**
 * Client-side generated exercises. Replaces firebase/client/generated-exercises.
 */

import { supabase } from '../supabase-instance';
import { toTimestampLike } from '@/types/timestamp';
import type {
  GeneratedExercise,
  CreateGeneratedExerciseInput,
  GeneratedExerciseStatus,
  ExerciseVideo,
  ParsedBiomechanics,
} from '@/types/generated-exercise';
import { normalizeExerciseName } from '@/lib/approved-exercise-maps';

function toDate(v: string | null | undefined): Date {
  if (!v) return new Date();
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date() : d;
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

function mapRowToExercise(row: GeneratedExerciseRow): GeneratedExercise {
  const createdAt = toDate(row.created_at);
  const updatedAt = toDate(row.updated_at);
  const generatedAt = toDate(row.generated_at);
  const rejectedAt = row.rejected_at ? toDate(row.rejected_at) : undefined;
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
    sources: (row.sources ?? []) as GeneratedExercise['sources'],
    status: row.status as GeneratedExercise['status'],
    generatedBy: row.generated_by,
    generatedAt: toTimestamp(generatedAt),
    createdAt: toTimestamp(createdAt),
    updatedAt: toTimestamp(updatedAt),
    rejectedAt: rejectedAt ? toTimestamp(rejectedAt) : undefined,
    rejectedBy: row.rejected_by ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    deepDiveHtmlContent: row.deep_dive_html_content ?? undefined,
    userFriendlyInstructions: row.user_friendly_instructions ?? undefined,
    suitableBlocks: (row.suitable_blocks ?? []) as GeneratedExercise['suitableBlocks'],
    mainWorkoutType: (row.main_workout_type ?? undefined) as GeneratedExercise['mainWorkoutType'],
    videoUrl: row.video_url ?? undefined,
    videoStoragePath: row.video_storage_path ?? undefined,
    videos: (row.videos ?? []) as GeneratedExercise['videos'],
  };
}

export async function getGeneratedExercises(
  statusFilter?: GeneratedExerciseStatus
): Promise<GeneratedExercise[]> {
  let q = supabase
    .from('generated_exercises')
    .select('*')
    .order('created_at', { ascending: false });
  if (statusFilter) q = q.eq('status', statusFilter);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapRowToExercise);
}

export async function getGeneratedExerciseById(id: string): Promise<GeneratedExercise | null> {
  const { data, error } = await supabase
    .from('generated_exercises')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? mapRowToExercise(data) : null;
}

export async function getGeneratedExerciseBySlug(
  slug: string,
  statusFilter?: GeneratedExerciseStatus
): Promise<GeneratedExercise | null> {
  let q = supabase.from('generated_exercises').select('*').eq('slug', slug).limit(1);
  if (statusFilter) q = q.eq('status', statusFilter);
  const { data, error } = await q;
  if (error) throw error;
  if (!data?.length) return null;
  return mapRowToExercise(data[0]);
}

function toPayload(input: Partial<CreateGeneratedExerciseInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.slug != null) row.slug = input.slug;
  if (input.exerciseName != null) row.exercise_name = input.exerciseName;
  if (input.imageUrl != null) row.image_url = input.imageUrl;
  if (input.storagePath != null) row.storage_path = input.storagePath;
  if (input.kineticChainType != null) row.kinetic_chain_type = input.kineticChainType;
  if (input.biomechanics != null) row.biomechanics = input.biomechanics;
  if (input.imagePrompt != null) row.image_prompt = input.imagePrompt;
  if (input.complexityLevel != null) row.complexity_level = input.complexityLevel;
  if (input.visualStyle != null) row.visual_style = input.visualStyle;
  if (input.sources != null) row.sources = input.sources;
  if (input.status != null) row.status = input.status;
  if (input.generatedBy != null) row.generated_by = input.generatedBy;
  if (input.suitableBlocks != null) row.suitable_blocks = input.suitableBlocks;
  if (input.mainWorkoutType != null) row.main_workout_type = input.mainWorkoutType;
  if (input.videoUrl != null) row.video_url = input.videoUrl;
  if (input.videoStoragePath != null) row.video_storage_path = input.videoStoragePath;
  if (input.videos != null) row.videos = input.videos;
  if (input.deepDiveHtmlContent != null) row.deep_dive_html_content = input.deepDiveHtmlContent;
  return row;
}

export async function createGeneratedExercise(
  input: Omit<CreateGeneratedExerciseInput, 'createdAt' | 'updatedAt' | 'generatedAt'>
): Promise<string> {
  const row = toPayload(input);
  row.created_at = new Date().toISOString();
  row.updated_at = new Date().toISOString();
  row.generated_at = row.created_at;
  const { data, error } = await supabase
    .from('generated_exercises')
    .insert(row)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateGeneratedExercise(
  id: string,
  updates: Partial<Omit<GeneratedExercise, 'id' | 'createdAt'>>
): Promise<void> {
  const row: Record<string, unknown> = toPayload(updates);
  row.updated_at = new Date().toISOString();
  if (updates.exerciseName != null) row.exercise_name = updates.exerciseName;
  if (updates.imageUrl != null) row.image_url = updates.imageUrl;
  if (updates.storagePath != null) row.storage_path = updates.storagePath;
  if (updates.rejectedBy != null) row.rejected_by = updates.rejectedBy;
  if (updates.rejectionReason != null) row.rejection_reason = updates.rejectionReason;
  const { error } = await supabase.from('generated_exercises').update(row).eq('id', id);
  if (error) throw error;
}

export async function updateGeneratedExerciseStatus(
  id: string,
  status: GeneratedExerciseStatus,
  rejectionData?: { rejectedBy: string; rejectionReason: string }
): Promise<void> {
  const row: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'rejected' && rejectionData) {
    row.rejected_at = new Date().toISOString();
    row.rejected_by = rejectionData.rejectedBy;
    row.rejection_reason = rejectionData.rejectionReason;
  }
  const { error } = await supabase.from('generated_exercises').update(row).eq('id', id);
  if (error) throw error;
}

function normalizeVideos(ex: GeneratedExercise): ExerciseVideo[] {
  if (ex.videos?.length) return ex.videos;
  if (ex.videoUrl)
    return [
      {
        videoUrl: ex.videoUrl,
        videoStoragePath: ex.videoStoragePath ?? '',
        position: 0,
      },
    ];
  return [];
}

export async function addExerciseVideo(
  exerciseId: string,
  video: { videoUrl: string; videoStoragePath: string }
): Promise<void> {
  const ex = await getGeneratedExerciseById(exerciseId);
  if (!ex) throw new Error('Exercise not found');
  const videos = normalizeVideos(ex);
  videos.push({ ...video, position: videos.length, hidden: false });
  await updateGeneratedExercise(exerciseId, { videos });
}

export async function removeExerciseVideo(
  exerciseId: string,
  indexOrUrl: number | string
): Promise<void> {
  const ex = await getGeneratedExerciseById(exerciseId);
  if (!ex) throw new Error('Exercise not found');
  const videos = normalizeVideos(ex);
  let index: number;
  if (typeof indexOrUrl === 'string') {
    index = videos.findIndex((v) => v.videoUrl === indexOrUrl);
    if (index < 0) throw new Error('Video not found');
  } else {
    index = indexOrUrl;
    if (index < 0 || index >= videos.length) throw new Error('Invalid video index');
  }
  videos.splice(index, 1);
  await updateGeneratedExercise(exerciseId, { videos });
}

export async function updateExerciseVideo(
  exerciseId: string,
  indexOrUrl: number | string,
  updates: { label?: string; hidden?: boolean; position?: number }
): Promise<void> {
  const ex = await getGeneratedExerciseById(exerciseId);
  if (!ex) throw new Error('Exercise not found');
  const videos = normalizeVideos(ex);
  let index: number;
  if (typeof indexOrUrl === 'string') {
    index = videos.findIndex((v) => v.videoUrl === indexOrUrl);
    if (index < 0) throw new Error('Video not found');
  } else {
    index = indexOrUrl;
    if (index < 0 || index >= videos.length) throw new Error('Invalid video index');
  }
  const v = videos[index];
  if (updates.label !== undefined) v.label = updates.label;
  if (updates.hidden !== undefined) v.hidden = updates.hidden;
  if (updates.position !== undefined) v.position = updates.position;
  await updateGeneratedExercise(exerciseId, { videos });
}

export async function reorderExerciseVideos(
  exerciseId: string,
  orderedVideoUrls: string[]
): Promise<void> {
  const ex = await getGeneratedExerciseById(exerciseId);
  if (!ex) throw new Error('Exercise not found');
  const videos = normalizeVideos(ex);
  const byUrl = new Map(videos.map((v) => [v.videoUrl, v]));
  const reordered: ExerciseVideo[] = [];
  for (const url of orderedVideoUrls) {
    const v = byUrl.get(url);
    if (v) {
      reordered.push(v);
      byUrl.delete(url);
    }
  }
  if (reordered.length !== videos.length || byUrl.size > 0)
    throw new Error('Invalid reorder: must include exactly all videos');
  reordered.forEach((v, i) => {
    v.position = i;
  });
  await updateGeneratedExercise(exerciseId, { videos: reordered });
}

export async function slugExists(slug: string, excludeDocumentId?: string): Promise<boolean> {
  const { data } = await supabase
    .from('generated_exercises')
    .select('id')
    .eq('slug', slug)
    .limit(1);
  if (!data?.length) return false;
  if (excludeDocumentId && data[0].id === excludeDocumentId) return false;
  return true;
}

export async function generateUniqueSlug(
  baseSlug: string,
  excludeDocumentId?: string
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;
  while (await slugExists(slug, excludeDocumentId)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  return slug;
}

export type CommonMistakesCandidate = {
  id: string;
  exerciseName: string;
  slug: string;
  commonMistakes: string[];
};

export async function searchExercisesForCommonMistakes(
  exerciseName: string,
  excludeDocumentId: string
): Promise<CommonMistakesCandidate[]> {
  const queryNorm = normalizeExerciseName(exerciseName);
  const queryWords = queryNorm.split(/\s+/).filter(Boolean);
  const { data } = await supabase
    .from('generated_exercises')
    .select('id, exercise_name, slug, biomechanics')
    .not('biomechanics', 'is', null)
    .limit(500);
  const withMistakes = (data ?? [])
    .map((row) => ({
      id: row.id,
      exerciseName: row.exercise_name ?? '',
      slug: row.slug ?? '',
      commonMistakes:
        (row.biomechanics as { commonMistakes?: string[] } | null)?.commonMistakes ?? [],
      exNorm: normalizeExerciseName(row.exercise_name ?? ''),
    }))
    .filter(
      (ex) =>
        ex.id !== excludeDocumentId &&
        Array.isArray(ex.commonMistakes) &&
        ex.commonMistakes.length > 0
    );
  const resultMap = new Map<string, { candidate: CommonMistakesCandidate; rank: number }>();
  for (const c of withMistakes) {
    const exNorm = c.exNorm;
    let rank = 999;
    if (exNorm === queryNorm) rank = 0;
    else if (queryNorm.includes(exNorm) || exNorm.includes(queryNorm)) rank = 1;
    else if (queryWords.length > 0 && queryWords.every((w) => exNorm.includes(w))) rank = 2;
    if (rank < 999)
      resultMap.set(c.id, {
        candidate: {
          id: c.id,
          exerciseName: c.exerciseName,
          slug: c.slug,
          commonMistakes: c.commonMistakes,
        },
        rank,
      });
  }
  const { default: Fuse } = await import('fuse.js');
  const fuse = new Fuse(withMistakes, {
    keys: ['exNorm', 'exerciseName'],
    threshold: 0.4,
    includeScore: true,
  });
  const fuzzyResults = fuse.search(queryNorm);
  for (const r of fuzzyResults) {
    const c = r.item;
    if (resultMap.has(c.id)) continue;
    resultMap.set(c.id, {
      candidate: {
        id: c.id,
        exerciseName: c.exerciseName,
        slug: c.slug,
        commonMistakes: c.commonMistakes,
      },
      rank: 3,
    });
  }
  return Array.from(resultMap.values())
    .sort((a, b) => a.rank - b.rank)
    .map((x) => x.candidate);
}

export type BiomechanicalAnalysisCandidate = {
  id: string;
  exerciseName: string;
  slug: string;
  biomechanics: GeneratedExercise['biomechanics'];
  biomechanicalChain?: string;
  pivotPoints?: string;
  stabilizationNeeds?: string;
};
export async function searchExercisesForBiomechanicalAnalysis(
  exerciseName: string,
  excludeDocumentId: string
): Promise<BiomechanicalAnalysisCandidate[]> {
  const list = await getGeneratedExercises();
  const filtered = list.filter(
    (ex) => ex.id !== excludeDocumentId && ex.biomechanics && ex.exerciseName
  );
  const queryNorm = normalizeExerciseName(exerciseName);
  const { default: Fuse } = await import('fuse.js');
  const fuse = new Fuse(filtered, {
    keys: ['exerciseName', 'slug'],
    threshold: 0.4,
  });
  const results = fuse.search(queryNorm);
  return results.map((r) => ({
    id: r.item.id,
    exerciseName: r.item.exerciseName,
    slug: r.item.slug,
    biomechanics: r.item.biomechanics,
    biomechanicalChain: r.item.biomechanics?.biomechanicalChain,
    pivotPoints: r.item.biomechanics?.pivotPoints,
    stabilizationNeeds: r.item.biomechanics?.stabilizationNeeds,
  }));
}
