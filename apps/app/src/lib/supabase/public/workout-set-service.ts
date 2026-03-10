/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Public workout set service (Supabase).
 * Fetches published Workout Factory sets for public API and SSR.
 */

import { getSupabaseServer } from '@/lib/supabase/server';
import type { WorkoutInSet } from '@/types/ai-workout';
import type { UserDemographics, Goals } from '@/types/ai-program';

const DEFAULT_TARGET_AUDIENCE: UserDemographics = {
  ageRange: '26-35',
  sex: 'Male',
  weight: 180,
  experienceLevel: 'intermediate',
};

/** Server-side serialized workout set (timestamps as ISO strings for JSON). */
export interface SerializedWorkoutSet {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  workoutCount: number;
  targetAudience: UserDemographics;
  goals?: Goals;
  createdAt: string;
  updatedAt: string;
  workouts: WorkoutInSet[];
}

type ConfigRow = {
  difficulty?: string;
  targetAudience?: UserDemographics;
  goals?: Goals;
};

type Row = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  config: ConfigRow | null;
  workouts: WorkoutInSet[];
  workout_count: number;
  created_at: string;
  updated_at: string;
};

function rowToSerialized(row: Row): SerializedWorkoutSet {
  const config = row.config ?? {};
  const workouts = Array.isArray(row.workouts) ? row.workouts : [];
  const workoutCount = row.workout_count ?? workouts.length;
  return {
    id: row.id,
    title: row.title || 'Untitled Workout Set',
    description: row.description ?? '',
    difficulty:
      config.difficulty === 'beginner' ||
      config.difficulty === 'intermediate' ||
      config.difficulty === 'advanced'
        ? config.difficulty
        : 'intermediate',
    workoutCount,
    targetAudience: config.targetAudience ?? DEFAULT_TARGET_AUDIENCE,
    goals: config.goals,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    workouts,
  };
}

/**
 * Fetch published workout sets for the public list and detail views.
 * Returns [] on any error (dev/MVP friendly when no workouts yet).
 */
export async function getPublishedWorkoutSets(): Promise<SerializedWorkoutSet[]> {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('workout_sets')
      .select(
        'id, title, description, status, config, workouts, workout_count, created_at, updated_at'
      )
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (error) {
      if (import.meta.env.DEV)
        console.warn('[workout-set-service] getPublishedWorkoutSets error:', error);
      return [];
    }
    return (data ?? []).map((r) => rowToSerialized(r as Row));
  } catch (err) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[workout-set-service] getPublishedWorkoutSets error:', err);
    }
    return [];
  }
}
