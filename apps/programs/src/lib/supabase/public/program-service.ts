/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Public program service (Supabase). Server-only.
 * Fetches published programs and Week 1 preview; Weeks 2+ only via entitlements.
 */

import { getSupabaseServer } from '@/lib/supabase/server';
import type {
  ProgramMetadata,
  ProgramFilters,
  ProgramPreviewData,
  UserDemographics,
  WeekDocument,
} from '@/types/ai-program';

const DEFAULT_TARGET_AUDIENCE: UserDemographics = {
  ageRange: '26-35',
  sex: 'Male',
  weight: 180,
  experienceLevel: 'intermediate',
};

type ProgramRow = {
  id: string;
  trainer_id: string;
  title: string;
  description: string | null;
  difficulty?: string | null;
  duration_weeks: number | null;
  config: {
    targetAudience?: UserDemographics;
    equipmentProfile?: { zoneId?: string; equipmentIds?: string[] };
    goals?: unknown;
  } | null;
  created_at: string;
  updated_at: string;
};

function parseDifficulty(
  val: string | null | undefined,
  fallback: UserDemographics['experienceLevel']
): 'beginner' | 'intermediate' | 'advanced' {
  if (
    val === 'beginner' ||
    val === 'intermediate' ||
    val === 'advanced'
  )
    return val;
  return fallback;
}

function rowToMetadata(row: ProgramRow): ProgramMetadata & { id: string } {
  const config = row.config ?? {};
  const fallback = config.targetAudience?.experienceLevel ?? 'intermediate';
  return {
    id: row.id,
    title: row.title || 'Untitled Program',
    description: row.description ?? '',
    difficulty: parseDifficulty(row.difficulty, fallback),
    durationWeeks: row.duration_weeks ?? 12,
    targetAudience: config.targetAudience ?? DEFAULT_TARGET_AUDIENCE,
    equipmentProfile: config.equipmentProfile,
    goals: config.goals as ProgramMetadata['goals'],
    status: 'published',
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    authorId: row.trainer_id,
  };
}

/**
 * Fetch published programs (metadata only). Optional filters applied in-memory.
 * Returns [] on error.
 */
export async function getPublishedPrograms(
  filters?: ProgramFilters
): Promise<(ProgramMetadata & { id: string })[]> {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('programs')
      .select(
        'id, trainer_id, title, description, difficulty, duration_weeks, config, created_at, updated_at'
      )
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (error) {
      if (import.meta.env.DEV) console.warn('[program-service] getPublishedPrograms error:', error);
      return [];
    }

    let items = (data ?? []).map((r) => rowToMetadata(r as ProgramRow));

    if (filters?.zoneId) {
      items = items.filter((p) => p.equipmentProfile?.zoneId === filters.zoneId);
    }
    if (filters?.experienceLevel) {
      items = items.filter((p) => p.targetAudience?.experienceLevel === filters.experienceLevel);
    }

    return items;
  } catch (err) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[program-service] getPublishedPrograms error:', err);
    }
    return [];
  }
}

/**
 * Fetch program preview: program + Week 1 only. Returns null if not found or not public.
 */
export async function getProgramPreview(programId: string): Promise<ProgramPreviewData | null> {
  try {
    const supabase = getSupabaseServer();

    const { data: program, error: programError } = await supabase
      .from('programs')
      .select(
        'id, trainer_id, title, description, difficulty, duration_weeks, config, created_at, updated_at'
      )
      .eq('id', programId)
      .eq('is_public', true)
      .single();

    if (programError || !program) return null;

    const metadata = rowToMetadata(program as ProgramRow);
    const totalWeeks = metadata.durationWeeks;

    const { data: weekRows, error: weeksError } = await supabase
      .from('program_weeks')
      .select('week_number, content')
      .eq('program_id', programId)
      .eq('week_number', 1)
      .maybeSingle();

    if (weeksError) {
      return {
        metadata,
        previewWeek: { weekNumber: 1, workouts: [] },
        totalWeeks,
      };
    }

    const w = weekRows as {
      week_number: number;
      content: { weekNumber?: number; workouts?: WeekDocument['workouts'] } | null;
    } | null;
    const previewWeek: WeekDocument = {
      weekNumber: w?.content?.weekNumber ?? 1,
      workouts: w?.content?.workouts ?? [],
    };

    return {
      metadata,
      previewWeek,
      totalWeeks,
    };
  } catch (err) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[program-service] getProgramPreview error:', err);
    }
    return null;
  }
}
