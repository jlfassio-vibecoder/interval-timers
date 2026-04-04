/**
 * Trainer-owned workout series (unparsed WorkoutSetTemplate snapshot + session rows).
 */

import { getSupabaseServer } from '@/lib/supabase/server';

export interface TrainerWorkoutSeriesSessionRow {
  id: string;
  title: string;
  sessionIndex: number | null;
}

export interface TrainerWorkoutSeriesDetail {
  id: string;
  title: string;
  description: string | null;
  rawWorkoutSet: unknown;
  aiChainMetadata: unknown | null;
  createdAt: string | null;
  sessions: TrainerWorkoutSeriesSessionRow[];
}

export async function fetchTrainerWorkoutSeriesOwned(
  trainerUserId: string,
  seriesId: string
): Promise<TrainerWorkoutSeriesDetail | null> {
  const supabase = getSupabaseServer();
  const { data: series, error: sErr } = await supabase
    .from('trainer_workout_series')
    .select('id, trainer_id, title, description, raw_workout_set, ai_chain_metadata, created_at')
    .eq('id', seriesId)
    .maybeSingle();

  if (sErr || !series) {
    if (import.meta.env.DEV) console.warn('[trainer-workout-series] fetch series', sErr);
    return null;
  }
  const sr = series as {
    trainer_id?: string;
    title?: string;
    description?: string | null;
    raw_workout_set?: unknown;
    ai_chain_metadata?: unknown | null;
    created_at?: string | null;
  };
  if (sr.trainer_id !== trainerUserId) return null;

  const { data: sessionRows, error: wErr } = await supabase
    .from('workouts')
    .select('id, title, session_index')
    .eq('workout_series_id', seriesId)
    .eq('trainer_id', trainerUserId)
    .order('session_index', { ascending: true });

  if (wErr) {
    if (import.meta.env.DEV) console.warn('[trainer-workout-series] fetch sessions', wErr);
  }

  const sessions: TrainerWorkoutSeriesSessionRow[] = (sessionRows ?? []).map((row) => {
    const r = row as { id?: string; title?: string | null; session_index?: number | null };
    return {
      id: String(r.id ?? ''),
      title: typeof r.title === 'string' && r.title.trim() ? r.title.trim() : 'Session',
      sessionIndex: typeof r.session_index === 'number' ? r.session_index : null,
    };
  });

  return {
    id: seriesId,
    title: typeof sr.title === 'string' && sr.title.trim() ? sr.title.trim() : 'Workout series',
    description: typeof sr.description === 'string' ? sr.description : null,
    rawWorkoutSet: sr.raw_workout_set ?? null,
    aiChainMetadata: sr.ai_chain_metadata ?? null,
    createdAt: sr.created_at != null ? String(sr.created_at) : null,
    sessions,
  };
}
