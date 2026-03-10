/**
 * Server-side warmup config. Replaces firebase/admin/warmup-config.
 */

import { getSupabaseServer } from '../server';

export interface WarmupConfigSlot {
  order: number;
  exerciseName: string;
  detail: string;
  generatedExerciseId?: string;
  fallbackImageUrl?: string;
  fallbackInstructions?: string[];
}

export interface WarmupConfigDoc {
  slots: WarmupConfigSlot[];
  durationPerExercise: number;
  updatedAt: Date;
}

const ROW_ID = 'default';

export async function getWarmupConfigServer(): Promise<WarmupConfigDoc | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('warmup_config')
    .select('*')
    .eq('id', ROW_ID)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  if (!data) return null;

  return {
    slots: (data.slots ?? []) as WarmupConfigSlot[],
    durationPerExercise:
      typeof data.duration_per_exercise === 'number' ? data.duration_per_exercise : 30,
    updatedAt: data.updated_at ? new Date(data.updated_at) : new Date(),
  };
}

export async function saveWarmupConfigServer(
  slots: WarmupConfigSlot[],
  durationPerExercise: number
): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase.from('warmup_config').upsert(
    {
      id: ROW_ID,
      slots,
      duration_per_exercise: durationPerExercise,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (error) throw error;
}
