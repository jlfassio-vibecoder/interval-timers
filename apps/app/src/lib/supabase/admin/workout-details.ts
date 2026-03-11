import { supabase } from '../supabase-instance';

/** Minimal type for an exercise within a workout block (JSON structure). */
export interface BlockExercise {
  id?: string;
  name: string;
  sets?: number;
  reps?: string;
  weight?: string;
  notes?: string;
  restSeconds?: number;
}

export interface WorkoutBlock {
  type: 'warmup' | 'main' | 'finisher' | 'cooldown';
  name: string;
  exercises: BlockExercise[];
  order: number;
}

export interface SupabaseWorkout {
  id: string;
  program_id: string | null;
  trainer_id: string;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  difficulty_level: string;
  blocks: WorkoutBlock[]; // Stored as JSONB
  created_at: string;
}

export const fetchWorkout = async (id: string): Promise<SupabaseWorkout> => {
  const { data, error } = await supabase.from('workouts').select('*').eq('id', id).single();

  if (error) throw error;
  return data as SupabaseWorkout;
};

export const updateWorkoutDetails = async (id: string, updates: Partial<SupabaseWorkout>) => {
  const { error } = await supabase.from('workouts').update(updates).eq('id', id);

  if (error) throw error;
};
