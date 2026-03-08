/**
 * Client-side admin exercises list. Replaces firebase/admin/exercises.
 */

import { supabase } from '../client';

export interface Exercise {
  id: string;
  name: string;
  category: 'strength' | 'cardio' | 'mobility';
  muscleGroups: string[];
  videoUrl?: string;
  defaultEquipment: string[];
}

interface ExerciseRow {
  id: string;
  name: string;
  category: string;
  muscle_groups?: string[] | null;
  video_url?: string | null;
  default_equipment?: string[] | null;
}

function mapExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    category: row.category as Exercise['category'],
    muscleGroups: row.muscle_groups ?? [],
    videoUrl: row.video_url ?? undefined,
    defaultEquipment: row.default_equipment ?? [],
  };
}

export async function getAllExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase.from('exercises').select('*');
  if (error) throw error;
  return (data ?? []).map(mapExercise);
}

export async function createExercise(data: Omit<Exercise, 'id'>): Promise<string> {
  const { data: row, error } = await supabase
    .from('exercises')
    .insert({
      name: data.name,
      category: data.category,
      muscle_groups: data.muscleGroups ?? [],
      video_url: data.videoUrl,
      default_equipment: data.defaultEquipment ?? [],
    })
    .select('id')
    .single();
  if (error) throw error;
  return row.id;
}

export async function deleteExercise(id: string): Promise<void> {
  const { error } = await supabase.from('exercises').delete().eq('id', id);
  if (error) throw error;
}
