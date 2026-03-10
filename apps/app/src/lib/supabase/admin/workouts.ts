import { supabase } from '../client';
import type { WorkoutBlock } from './workout-details';

export interface Workout {
  id: string;
  program_id: string;
  trainer_id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  difficulty_level: string;
  blocks: WorkoutBlock[];
  created_at: string;
  scheduled_week: number | null; // Virtual column for UI sorting (if we add it to schema later)
  scheduled_day: number | null; // Virtual column
}

export const fetchWorkoutsForProgram = async (programId: string) => {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('program_id', programId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as Workout[];
};

export const createWorkout = async (workout: {
  program_id: string;
  trainer_id: string;
  title: string;
  scheduled_week?: number;
  scheduled_day?: number;
}) => {
  const { data, error } = await supabase
    .from('workouts')
    .insert([
      {
        program_id: workout.program_id,
        trainer_id: workout.trainer_id,
        title: workout.title,
        status: 'active',
        blocks: [],
        scheduled_week: workout.scheduled_week ?? null,
        scheduled_day: workout.scheduled_day ?? null,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data as Workout;
};

export const deleteWorkout = async (id: string) => {
  const { error } = await supabase.from('workouts').delete().eq('id', id);

  if (error) throw error;
};

export const updateWorkout = async (id: string, updates: Partial<Workout>) => {
  // Filter out any UI-only fields if necessary
  const { error } = await supabase.from('workouts').update(updates).eq('id', id);

  if (error) throw error;
};
