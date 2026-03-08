/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Supabase server-side program CRUD (admin). Used by API routes.
 * Programs + program_weeks; config and chain_metadata stored on programs.
 */

import { getSupabaseServer } from '@/lib/supabase/server';
import { normalizeProgramSchedule } from '@/lib/program-schedule-utils';
import type {
  ProgramTemplate,
  ProgramConfig,
  ProgramMetadata,
  WeekDocument,
  PromptChainMetadata,
} from '@/types/ai-program';
import type { UserDemographics } from '@/types/ai-program';

/** Library list item shape (matches client admin/programs.ts ProgramLibraryItem). */
export interface ProgramLibraryItemRow {
  id: string;
  title: string;
  description: string | null;
  difficulty: string;
  durationWeeks: number;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  status: string;
  isPublic: boolean;
  trainerId: string;
}

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
  difficulty: string | null;
  duration_weeks: number | null;
  status: string;
  is_public: boolean;
  tags: string[] | null;
  config: {
    targetAudience?: UserDemographics;
    equipmentProfile?: { zoneId?: string; equipmentIds?: string[] };
    goals?: unknown;
  } | null;
  chain_metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type WeekRow = {
  week_number: number;
  content: { weekNumber?: number; workouts?: WeekDocument['workouts'] } | null;
};

function rowToLibraryItem(row: ProgramRow): ProgramLibraryItemRow {
  const status = row.is_public ? 'published' : 'draft';
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    difficulty: row.difficulty || 'intermediate',
    durationWeeks: row.duration_weeks ?? 4,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: row.tags ?? [],
    status,
    isPublic: row.is_public,
    trainerId: row.trainer_id,
  };
}

/**
 * Fetch program library for an author. Returns [] on error.
 */
export async function fetchProgramLibrary(authorId: string): Promise<ProgramLibraryItemRow[]> {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('programs')
      .select(
        'id, trainer_id, title, description, difficulty, duration_weeks, status, is_public, tags, config, chain_metadata, created_at, updated_at'
      )
      .eq('trainer_id', authorId)
      .order('created_at', { ascending: false });

    if (error) {
      if (import.meta.env.DEV) console.warn('[program-server] fetchProgramLibrary error:', error);
      return [];
    }
    return (data ?? []).map((r) => rowToLibraryItem(r as ProgramRow));
  } catch (err) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[program-server] fetchProgramLibrary error:', err);
    }
    return [];
  }
}

/**
 * Create program and program_weeks. Returns new program id.
 */
export async function createProgram(
  authorId: string,
  programData: ProgramTemplate,
  programConfig: ProgramConfig,
  chainMetadata?: PromptChainMetadata
): Promise<string> {
  const normalized = normalizeProgramSchedule(programData);
  const supabase = getSupabaseServer();

  const config = {
    targetAudience: programConfig.targetAudience,
    equipmentProfile: programConfig.zoneId
      ? {
          zoneId: programConfig.zoneId,
          equipmentIds: programConfig.selectedEquipmentIds ?? [],
        }
      : undefined,
    goals: programConfig.goals,
  };

  const chainData: Record<string, unknown> | null = chainMetadata
    ? {
        step1_architect: chainMetadata.step1_architect,
        step2_biomechanist: chainMetadata.step2_biomechanist,
        step3_coach: chainMetadata.step3_coach,
        generated_at: chainMetadata.generated_at,
        model_used: chainMetadata.model_used,
        ...(chainMetadata.total_tokens !== undefined && {
          total_tokens: chainMetadata.total_tokens,
        }),
      }
    : null;

  const { data: program, error: programError } = await supabase
    .from('programs')
    .insert({
      trainer_id: authorId,
      title: normalized.title,
      description: normalized.description ?? '',
      difficulty: normalized.difficulty,
      duration_weeks: normalized.durationWeeks,
      status: 'draft',
      is_public: false,
      config,
      chain_metadata: chainData,
    })
    .select('id')
    .single();

  if (programError || !program) {
    throw new Error(programError?.message ?? 'Failed to create program');
  }

  const programId = program.id;

  if (normalized.schedule?.length) {
    const weekRows = normalized.schedule.map((week) => ({
      program_id: programId,
      week_number: week.weekNumber,
      content: { weekNumber: week.weekNumber, workouts: week.workouts },
    }));
    const { error: weeksError } = await supabase.from('program_weeks').insert(weekRows);
    if (weeksError) {
      await supabase.from('programs').delete().eq('id', programId);
      throw new Error(weeksError.message);
    }
  }

  return programId;
}

/**
 * Fetch full program (metadata + all weeks). Throws if not found.
 */
export async function fetchFullProgram(programId: string): Promise<ProgramTemplate> {
  const supabase = getSupabaseServer();

  const { data: program, error: programError } = await supabase
    .from('programs')
    .select('id, title, description, difficulty, duration_weeks')
    .eq('id', programId)
    .single();

  if (programError || !program) {
    throw new Error(`Program with ID ${programId} not found`);
  }

  const { data: weeks, error: weeksError } = await supabase
    .from('program_weeks')
    .select('week_number, content')
    .eq('program_id', programId)
    .order('week_number', { ascending: true });

  if (weeksError) {
    throw new Error(weeksError.message);
  }

  const schedule: ProgramTemplate['schedule'] = (weeks ?? []).map((w: WeekRow) => ({
    weekNumber: w.content?.weekNumber ?? w.week_number,
    workouts: w.content?.workouts ?? [],
  }));

  return {
    title: program.title,
    description: program.description ?? '',
    difficulty: (program.difficulty as ProgramTemplate['difficulty']) ?? 'intermediate',
    durationWeeks: program.duration_weeks ?? 4,
    schedule,
  };
}

/**
 * Fetch program metadata only (for edit form). Throws if not found.
 */
export async function fetchProgramMetadata(
  programId: string
): Promise<ProgramMetadata & { id: string }> {
  const supabase = getSupabaseServer();

  const { data: row, error } = await supabase
    .from('programs')
    .select(
      'id, trainer_id, title, description, difficulty, duration_weeks, status, is_public, config, chain_metadata, created_at, updated_at'
    )
    .eq('id', programId)
    .single();

  if (error || !row) {
    throw new Error(`Program with ID ${programId} not found`);
  }

  const r = row as ProgramRow;
  const config = r.config ?? {};
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? '',
    difficulty:
      r.difficulty === 'beginner' || r.difficulty === 'intermediate' || r.difficulty === 'advanced'
        ? r.difficulty
        : 'intermediate',
    durationWeeks: r.duration_weeks ?? 4,
    targetAudience: config.targetAudience ?? DEFAULT_TARGET_AUDIENCE,
    equipmentProfile: config.equipmentProfile,
    goals: config.goals as ProgramMetadata['goals'],
    chain_metadata: r.chain_metadata as unknown as ProgramMetadata['chain_metadata'],
    status: r.is_public ? 'published' : 'draft',
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
    authorId: r.trainer_id,
  };
}

/**
 * Update program and replace program_weeks.
 */
export async function updateProgram(
  programId: string,
  programData: ProgramTemplate,
  programConfig: ProgramConfig
): Promise<void> {
  const normalized = normalizeProgramSchedule(programData);
  const supabase = getSupabaseServer();

  const { error: existsError } = await supabase
    .from('programs')
    .select('id')
    .eq('id', programId)
    .single();

  if (existsError) {
    throw new Error(`Program with ID ${programId} not found`);
  }

  const config = {
    targetAudience: programConfig.targetAudience,
    equipmentProfile: programConfig.zoneId
      ? {
          zoneId: programConfig.zoneId,
          equipmentIds: programConfig.selectedEquipmentIds ?? [],
        }
      : undefined,
    goals: programConfig.goals,
  };

  const { error: updateError } = await supabase
    .from('programs')
    .update({
      title: normalized.title,
      description: normalized.description ?? '',
      difficulty: normalized.difficulty,
      duration_weeks: normalized.durationWeeks,
      config,
      updated_at: new Date().toISOString(),
    })
    .eq('id', programId);

  if (updateError) throw new Error(updateError.message);

  await supabase.from('program_weeks').delete().eq('program_id', programId);

  if (normalized.schedule?.length) {
    const weekRows = normalized.schedule.map((week) => ({
      program_id: programId,
      week_number: week.weekNumber,
      content: { weekNumber: week.weekNumber, workouts: week.workouts },
    }));
    const { error: weeksError } = await supabase.from('program_weeks').insert(weekRows);
    if (weeksError) throw new Error(weeksError.message);
  }
}

/**
 * Delete program (cascade deletes program_weeks). Throws if program not found.
 */
export async function deleteProgram(programId: string): Promise<void> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.from('programs').delete().eq('id', programId).select('id');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error(`Program with ID ${programId} not found`);
}

/**
 * Update program status (draft | published). Sets is_public = (status === 'published').
 */
export async function updateProgramStatus(
  programId: string,
  status: 'draft' | 'published'
): Promise<void> {
  const supabase = getSupabaseServer();
  const isPublic = status === 'published';
  const dbStatus = isPublic ? 'active' : 'draft';
  const { error } = await supabase
    .from('programs')
    .update({ is_public: isPublic, status: dbStatus, updated_at: new Date().toISOString() })
    .eq('id', programId);
  if (error) throw new Error(error.message);
}
