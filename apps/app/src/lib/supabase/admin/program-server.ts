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
  ProgramTemplateScaffold,
  ProgramSchedule,
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
  featured_on_landing?: boolean;
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

/** Thrown when the authenticated user may not access this program. */
export const PROGRAM_ACCESS_FORBIDDEN = 'PROGRAM_ACCESS_FORBIDDEN';

/**
 * Ensure the user owns the program or is admin/super_admin (service role read).
 * Throws "Program with ID … not found" if missing; {@link PROGRAM_ACCESS_FORBIDDEN} if not allowed.
 */
export async function assertUserCanAccessProgram(programId: string, userId: string): Promise<void> {
  const supabase = getSupabaseServer();
  const { data: row, error } = await supabase
    .from('programs')
    .select('trainer_id')
    .eq('id', programId)
    .maybeSingle();

  if (error) {
    throw new Error(`Program with ID ${programId} not found`);
  }
  if (!row) {
    throw new Error(`Program with ID ${programId} not found`);
  }
  const trainerId = (row as { trainer_id: string }).trainer_id;
  if (trainerId === userId) return;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (profileError || !profile) {
    throw new Error(PROGRAM_ACCESS_FORBIDDEN);
  }
  const role = (profile as { role: string }).role;
  if (role === 'admin' || role === 'super_admin') return;

  throw new Error(PROGRAM_ACCESS_FORBIDDEN);
}

function rowToLibraryItem(row: ProgramRow): ProgramLibraryItemRow {
  // Use stored status column; fallback for legacy rows (aligns with client admin/programs.ts)
  const status = row.status ?? 'draft';
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
 * Create program with scaffold only (no program_weeks). Used by scaffold-first flow.
 * Returns new program id.
 */
export async function createProgramWithScaffold(
  authorId: string,
  scaffold: ProgramTemplateScaffold,
  programConfig: ProgramConfig
): Promise<string> {
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

  const { data: program, error: programError } = await supabase
    .from('programs')
    .insert({
      trainer_id: authorId,
      title: programConfig.programInfo?.title?.trim() || 'Untitled Program',
      description: programConfig.programInfo?.description?.trim() ?? '',
      difficulty: 'intermediate',
      duration_weeks: scaffold.totalWeeks,
      status: 'draft',
      is_public: false,
      config,
      program_template: scaffold as unknown as Record<string, unknown>,
    })
    .select('id')
    .single();

  if (programError || !program) {
    throw new Error(programError?.message ?? 'Failed to create program');
  }
  return program.id;
}

/**
 * Fetch program scaffold (program_template). Throws if not found or no scaffold.
 */
export async function getProgramScaffold(
  programId: string
): Promise<ProgramTemplateScaffold> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('programs')
    .select('program_template')
    .eq('id', programId)
    .single();

  if (error || !data) {
    throw new Error(`Program with ID ${programId} not found`);
  }
  const scaffold = (data as { program_template: ProgramTemplateScaffold | null }).program_template;
  if (!scaffold || !Array.isArray(scaffold.phases)) {
    throw new Error(`Program ${programId} has no scaffold (program_template)`);
  }
  return scaffold as ProgramTemplateScaffold;
}

/**
 * Replace program_weeks for a single phase.
 * Upserts rows first (UNIQUE program_id, week_number) so a failed step does not wipe the phase;
 * then deletes week_numbers in [min,max] that are no longer in this schedule (same range semantics as before).
 */
export async function upsertPhaseWeeks(
  programId: string,
  phaseIndex: number,
  schedule: ProgramSchedule[]
): Promise<void> {
  const supabase = getSupabaseServer();

  if (schedule.length === 0) return;

  const weekRows = schedule.map((week) => ({
    program_id: programId,
    week_number: week.weekNumber,
    phase_number: phaseIndex,
    content: { weekNumber: week.weekNumber, workouts: week.workouts },
  }));

  const weekNumbers = schedule.map((w) => w.weekNumber);
  const minWeek = Math.min(...weekNumbers);
  const maxWeek = Math.max(...weekNumbers);
  const newWeekSet = new Set(weekNumbers);

  const { error: upsertError } = await supabase
    .from('program_weeks')
    .upsert(weekRows, { onConflict: 'program_id,week_number' });
  if (upsertError) throw new Error(upsertError.message);

  const { data: inRangeRows, error: selectError } = await supabase
    .from('program_weeks')
    .select('week_number')
    .eq('program_id', programId)
    .gte('week_number', minWeek)
    .lte('week_number', maxWeek);

  if (selectError) throw new Error(selectError.message);

  const toDelete = (inRangeRows ?? [])
    .map((r) => r.week_number as number)
    .filter((wn) => !newWeekSet.has(wn));

  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('program_weeks')
      .delete()
      .eq('program_id', programId)
      .in('week_number', toDelete);
    if (deleteError) throw new Error(deleteError.message);
  }
}

/**
 * Update program_template (scaffold) for a program. Throws if not found.
 */
export async function updateProgramScaffold(
  programId: string,
  scaffold: ProgramTemplateScaffold
): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('programs')
    .update({
      program_template: scaffold as unknown as Record<string, unknown>,
      duration_weeks: scaffold.totalWeeks,
      updated_at: new Date().toISOString(),
    })
    .eq('id', programId);
  if (error) throw new Error(error.message);
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
      'id, trainer_id, title, description, difficulty, duration_weeks, status, is_public, featured_on_landing, config, chain_metadata, created_at, updated_at'
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
    featuredOnLanding: r.featured_on_landing ?? false,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
    authorId: r.trainer_id,
  };
}

/**
 * Update program featured_on_landing flag.
 */
export async function updateProgramFeatured(
  programId: string,
  featuredOnLanding: boolean
): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('programs')
    .update({ featured_on_landing: featuredOnLanding, updated_at: new Date().toISOString() })
    .eq('id', programId);
  if (error) throw new Error(error.message);
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
