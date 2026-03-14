/**
 * Client-side exercise gallery (images). Replaces firebase/client/exercise-gallery.
 */

import { supabase } from '../client';
import { toTimestampLike } from '@/types/timestamp';
import { updateGeneratedExercise } from './generated-exercises';
import type {
  ExerciseImage,
  ExerciseImageRole,
  CreateExerciseImageInput,
} from '@/types/generated-exercise';

interface ExerciseImageRow {
  id: string;
  exercise_id: string;
  role: string;
  image_url: string;
  storage_path: string | null;
  image_prompt: string | null;
  visual_style: string | null;
  created_at?: string | null;
  created_by: string | null;
  position: number;
  anatomical_section: string | null;
  hidden?: boolean | null;
}

function mapRowToImage(row: ExerciseImageRow): ExerciseImage {
  const createdAt = row.created_at ? new Date(row.created_at) : new Date();
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    role: row.role as ExerciseImageRole,
    imageUrl: row.image_url,
    storagePath: row.storage_path ?? '',
    imagePrompt: row.image_prompt ?? undefined,
    visualStyle: row.visual_style ?? undefined,
    createdAt: toTimestampLike(createdAt),
    createdBy: row.created_by ?? '',
    position: row.position,
    anatomicalSection: (row.anatomical_section as ExerciseImage['anatomicalSection']) ?? undefined,
    hidden: row.hidden ?? false,
  };
}

export async function getExerciseImages(exerciseId: string): Promise<ExerciseImage[]> {
  const { data, error } = await supabase
    .from('exercise_images')
    .select('*')
    .eq('exercise_id', exerciseId)
    .order('position', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapRowToImage);
}

export async function getExerciseImageById(
  exerciseId: string,
  imageId: string
): Promise<ExerciseImage | null> {
  const { data, error } = await supabase
    .from('exercise_images')
    .select('*')
    .eq('exercise_id', exerciseId)
    .eq('id', imageId)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? mapRowToImage(data) : null;
}

export async function addExerciseImage(
  exerciseId: string,
  input: Omit<CreateExerciseImageInput, 'exerciseId' | 'createdAt'>
): Promise<string> {
  const images = await getExerciseImages(exerciseId);
  const maxPosition = images.reduce((max, img) => Math.max(max, img.position ?? 0), -1);
  const { data, error } = await supabase
    .from('exercise_images')
    .insert({
      exercise_id: exerciseId,
      role: input.role,
      image_url: input.imageUrl,
      storage_path: input.storagePath,
      image_prompt: input.imagePrompt,
      visual_style: input.visualStyle,
      created_by: input.createdBy,
      position: maxPosition + 1,
      anatomical_section: input.anatomicalSection,
      hidden: input.hidden ?? false,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateExerciseImageHidden(
  exerciseId: string,
  imageId: string,
  hidden: boolean
): Promise<void> {
  const { error } = await supabase
    .from('exercise_images')
    .update({ hidden })
    .eq('exercise_id', exerciseId)
    .eq('id', imageId);
  if (error) throw error;
}

export async function updateExerciseImageRole(
  exerciseId: string,
  imageId: string,
  role: ExerciseImageRole
): Promise<void> {
  const { error } = await supabase
    .from('exercise_images')
    .update({ role })
    .eq('exercise_id', exerciseId)
    .eq('id', imageId);
  if (error) throw error;
}

export async function deleteExerciseImage(exerciseId: string, imageId: string): Promise<void> {
  const { error } = await supabase
    .from('exercise_images')
    .delete()
    .eq('exercise_id', exerciseId)
    .eq('id', imageId);
  if (error) throw error;
}

export async function getExerciseImageCount(exerciseId: string): Promise<number> {
  const images = await getExerciseImages(exerciseId);
  return images.length;
}

export async function canAddMoreImages(exerciseId: string): Promise<boolean> {
  const count = await getExerciseImageCount(exerciseId);
  return count < 5;
}

export async function getExerciseImagesByRole(
  exerciseId: string,
  role: ExerciseImageRole
): Promise<ExerciseImage[]> {
  const images = await getExerciseImages(exerciseId);
  return images.filter((img) => img.role === role);
}

const GALLERY_ROLE_ORDER: ExerciseImageRole[] = [
  'secondary',
  'tertiary',
  'ghosted',
  'illustration',
  'multiplicity',
  'sequenceStart',
  'sequenceMid',
  'sequenceEnd',
];

export async function addExerciseImageWithShift(
  exerciseId: string,
  input: Omit<CreateExerciseImageInput, 'exerciseId' | 'createdAt'>
): Promise<string> {
  const targetRole = input.role as Exclude<ExerciseImageRole, 'primary'>;
  const k = GALLERY_ROLE_ORDER.indexOf(targetRole);
  if (k < 0) return addExerciseImage(exerciseId, input);

  const images = await getExerciseImages(exerciseId);
  const roleToImage = new Map<ExerciseImageRole, ExerciseImage>();
  for (const img of images) {
    if (GALLERY_ROLE_ORDER.includes(img.role as Exclude<ExerciseImageRole, 'primary'>)) {
      if (!roleToImage.has(img.role)) roleToImage.set(img.role, img);
    }
  }
  const lastRole = GALLERY_ROLE_ORDER[GALLERY_ROLE_ORDER.length - 1];
  const lastRoleImg = roleToImage.get(lastRole);
  if (lastRoleImg) await deleteExerciseImage(exerciseId, lastRoleImg.id);
  for (let i = GALLERY_ROLE_ORDER.length - 2; i >= k; i--) {
    const fromRole = GALLERY_ROLE_ORDER[i];
    const toRole = GALLERY_ROLE_ORDER[i + 1];
    const img = roleToImage.get(fromRole);
    if (img) await updateExerciseImageRole(exerciseId, img.id, toRole);
  }
  return addExerciseImage(exerciseId, input);
}

export async function reorderGalleryImages(
  exerciseId: string,
  orderedImageIds: string[]
): Promise<void> {
  for (let i = 0; i < orderedImageIds.length; i++) {
    const { error } = await supabase
      .from('exercise_images')
      .update({ position: i })
      .eq('exercise_id', exerciseId)
      .eq('id', orderedImageIds[i]);
    if (error) throw error;
  }
}

export async function promoteToPrimary(
  exerciseId: string,
  galleryImageId: string,
  currentPrimaryImageUrl: string,
  currentPrimaryStoragePath: string,
  performedBy?: string
): Promise<void> {
  const galleryImage = await getExerciseImageById(exerciseId, galleryImageId);
  if (!galleryImage) throw new Error(`Gallery image with ID ${galleryImageId} not found`);

  // Demote current primary to secondary in gallery; fail fast so we don't delete/update on insert failure.
  const { error: insertError } = await supabase.from('exercise_images').insert({
    exercise_id: exerciseId,
    role: 'secondary',
    image_url: currentPrimaryImageUrl,
    storage_path: currentPrimaryStoragePath,
    created_by: performedBy ?? 'system',
    position: 0,
  });
  if (insertError) throw insertError;

  await deleteExerciseImage(exerciseId, galleryImageId);

  await updateGeneratedExercise(exerciseId, {
    imageUrl: galleryImage.imageUrl,
    storagePath: galleryImage.storagePath,
    imagePrompt: galleryImage.imagePrompt,
    visualStyle: galleryImage.visualStyle,
  });
}
