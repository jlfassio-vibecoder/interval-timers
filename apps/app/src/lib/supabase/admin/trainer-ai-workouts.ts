/**
 * Persist AI-generated workout factory output to public.workouts (trainer library).
 * Does not write to workout_sets (admin SEO catalog).
 */

import type { WorkoutChainMetadata, WorkoutConfig, WorkoutSetTemplate } from '@/types/ai-workout';
import { workoutInSetToBlocks } from '@/lib/admin/workout-editor-map';
import { normalizeWorkoutSet } from '@/lib/program-schedule-utils';
import { getSupabaseServer } from '@/lib/supabase/server';

export type TrainerWorkoutVisibility = 'draft' | 'ready' | 'assigned';

function chainMetadataToStorage(
  chainMetadata: WorkoutChainMetadata | undefined,
  workoutConfig: WorkoutConfig
): Record<string, unknown> {
  const base: Record<string, unknown> = { workoutConfig };
  if (!chainMetadata) return base;

  const genAt = chainMetadata.generated_at;
  return {
    ...base,
    step1_workout_architect: chainMetadata.step1_workout_architect,
    step2_biomechanist: chainMetadata.step2_biomechanist,
    step3_coach: chainMetadata.step3_coach,
    step4_workout_mathematician: chainMetadata.step4_workout_mathematician,
    generated_at: genAt instanceof Date ? genAt.toISOString() : genAt,
    model_used: chainMetadata.model_used,
    ...(chainMetadata.total_tokens !== undefined && { total_tokens: chainMetadata.total_tokens }),
  };
}

/**
 * One public.workouts row per session in the generated set.
 */
export async function createTrainerAiWorkoutsFromFactory(
  trainerId: string,
  workoutSet: WorkoutSetTemplate,
  workoutConfig: WorkoutConfig,
  chainMetadata: WorkoutChainMetadata | undefined,
  visibility: TrainerWorkoutVisibility
): Promise<string[]> {
  const normalized = normalizeWorkoutSet(workoutSet);
  const sessions = normalized.workouts ?? [];
  if (sessions.length === 0) {
    throw new Error('No sessions in workout set');
  }

  const metaJson = chainMetadataToStorage(chainMetadata, workoutConfig);
  const durationMinutes = workoutConfig.requirements?.sessionDurationMinutes ?? null;
  const supabase = getSupabaseServer();
  const setTitle = (normalized.title ?? '').trim() || 'Workout';
  const setDescription = (normalized.description ?? '').trim();

  const ids: string[] = [];

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];
    const blocks = workoutInSetToBlocks(session);
    const sessionTitle = (session.title ?? '').trim();
    const title =
      sessions.length === 1 ? setTitle : `${setTitle} – ${sessionTitle || `Session ${i + 1}`}`;

    const sessionDesc = (session.description ?? '').trim();
    const description = sessionDesc || setDescription || null;

    const { data, error } = await supabase
      .from('workouts')
      .insert({
        program_id: null,
        trainer_id: trainerId,
        title,
        description,
        duration_minutes: durationMinutes,
        difficulty_level: normalized.difficulty,
        blocks: blocks as unknown,
        status: 'active',
        source: 'ai_factory',
        ai_chain_metadata: metaJson,
        visibility,
      })
      .select('id')
      .single();

    if (error) throw error;
    if (!data?.id) throw new Error('Failed to insert workout');
    ids.push(data.id as string);
  }

  return ids;
}
