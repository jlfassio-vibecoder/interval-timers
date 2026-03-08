/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Supabase admin challenge persistence: CRUD and image helpers.
 * Replaces Firestore usage in admin Challenge Factory APIs.
 */

import { getSupabaseServer } from '@/lib/supabase/server';
import { normalizeProgramSchedule } from '@/lib/program-schedule-utils';
import type {
  ChallengeTemplate,
  ChallengeConfig,
  ChallengeLibraryItem,
  ChallengeMilestone,
} from '@/types/ai-challenge';
import type { Goals, PromptChainMetadata } from '@/types/ai-program';
import type { UserDemographics } from '@/types/ai-program';
import type { ProgramSchedule } from '@/types/ai-program';

const DEFAULT_TARGET_AUDIENCE: UserDemographics = {
  ageRange: '26-35',
  sex: 'Male',
  weight: 180,
  experienceLevel: 'intermediate',
};

type ConfigRow = {
  difficulty?: string;
  durationWeeks?: number;
  theme?: string;
  tagline?: string;
  milestones?: ChallengeMilestone[];
  targetAudience?: UserDemographics;
  equipmentProfile?: { zoneId?: string; equipmentIds?: string[] };
  goals?: unknown;
};

function rowToLibraryItem(row: {
  id: string;
  title: string;
  description: string | null;
  author_id: string;
  status: string;
  config: ConfigRow | null;
  chain_metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  hero_image_url: string | null;
  section_images: Record<string, string> | null;
}): ChallengeLibraryItem {
  const config = row.config ?? {};
  return {
    id: row.id,
    title: row.title || 'Untitled Challenge',
    description: row.description ?? '',
    difficulty:
      config.difficulty === 'beginner' ||
      config.difficulty === 'intermediate' ||
      config.difficulty === 'advanced'
        ? config.difficulty
        : 'intermediate',
    durationWeeks: config.durationWeeks ?? 4,
    theme: config.theme,
    tagline: config.tagline,
    milestones: config.milestones ?? [],
    targetAudience: config.targetAudience ?? DEFAULT_TARGET_AUDIENCE,
    equipmentProfile: config.equipmentProfile,
    goals: config.goals as Goals | undefined,
    chain_metadata: row.chain_metadata
      ? ({
          ...row.chain_metadata,
          generated_at: row.chain_metadata.generated_at,
        } as PromptChainMetadata)
      : undefined,
    heroImageUrl: row.hero_image_url ?? undefined,
    sectionImages: row.section_images ?? undefined,
    status: row.status === 'published' ? 'published' : 'draft',
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    authorId: row.author_id,
    type: 'challenge',
  };
}

/**
 * Fetch all challenges for admin list. Returns [] on any error (dev/MVP friendly when no challenges yet).
 */
export async function fetchChallengeLibrary(): Promise<ChallengeLibraryItem[]> {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('challenges')
      .select(
        'id, title, description, author_id, status, config, chain_metadata, created_at, updated_at, hero_image_url, section_images'
      )
      .order('created_at', { ascending: false });

    if (error) {
      if (import.meta.env.DEV) console.warn('[challenges] fetchChallengeLibrary error:', error);
      return [];
    }
    return (data ?? []).map(rowToLibraryItem);
  } catch (err) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[challenges] fetchChallengeLibrary error:', err);
    }
    return [];
  }
}

export async function createChallenge(
  authorId: string,
  challengeData: ChallengeTemplate,
  challengeConfig: ChallengeConfig,
  chainMetadata?: PromptChainMetadata
): Promise<string> {
  const normalized = normalizeProgramSchedule(challengeData);
  const supabase = getSupabaseServer();

  const config: ConfigRow = {
    difficulty: normalized.difficulty,
    durationWeeks: normalized.durationWeeks,
    theme: normalized.theme,
    tagline: normalized.tagline,
    milestones: normalized.milestones ?? [],
    targetAudience: challengeConfig.targetAudience,
    goals: challengeConfig.goals,
  };
  if (challengeConfig.zoneId !== undefined) {
    config.equipmentProfile = {
      zoneId: challengeConfig.zoneId,
      equipmentIds: challengeConfig.selectedEquipmentIds ?? [],
    };
  }

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

  const { data: inserted, error: insertError } = await supabase
    .from('challenges')
    .insert({
      title: normalized.title,
      description: normalized.description ?? '',
      author_id: authorId,
      status: 'draft',
      config,
      chain_metadata: chainData,
    })
    .select('id')
    .single();

  if (insertError) throw insertError;
  if (!inserted?.id) throw new Error('Failed to create challenge');

  const challengeId = inserted.id;

  if (normalized.schedule?.length) {
    const weeks = normalized.schedule.map((week) => ({
      challenge_id: challengeId,
      week_number: week.weekNumber,
      content: { workouts: week.workouts ?? [] },
    }));
    const { error: weeksError } = await supabase.from('challenge_weeks').insert(weeks);
    if (weeksError) throw weeksError;
  }

  return challengeId;
}

export async function fetchFullChallenge(challengeId: string): Promise<ChallengeTemplate> {
  const supabase = getSupabaseServer();
  const { data: row, error } = await supabase
    .from('challenges')
    .select('id, title, description, config')
    .eq('id', challengeId)
    .single();

  if (error || !row) throw new Error(`Challenge with ID ${challengeId} not found`);

  const config = (row.config as ConfigRow) ?? {};
  const { data: weeksRows, error: weeksError } = await supabase
    .from('challenge_weeks')
    .select('week_number, content')
    .eq('challenge_id', challengeId)
    .order('week_number', { ascending: true });

  if (weeksError) throw weeksError;
  const schedule: ProgramSchedule[] = (weeksRows ?? [])
    .map((w) => ({
      weekNumber: w.week_number as number,
      workouts: ((w.content as { workouts?: ProgramSchedule['workouts'] })?.workouts ??
        []) as ProgramSchedule['workouts'],
    }))
    .sort((a, b) => a.weekNumber - b.weekNumber);

  return {
    title: row.title,
    description: row.description ?? '',
    difficulty:
      config.difficulty === 'beginner' ||
      config.difficulty === 'intermediate' ||
      config.difficulty === 'advanced'
        ? config.difficulty
        : 'intermediate',
    durationWeeks: config.durationWeeks ?? 4,
    theme: config.theme,
    tagline: config.tagline,
    milestones: config.milestones ?? [],
    schedule,
  };
}

export async function fetchChallengeMetadata(challengeId: string): Promise<ChallengeLibraryItem> {
  const supabase = getSupabaseServer();
  const { data: row, error } = await supabase
    .from('challenges')
    .select(
      'id, title, description, author_id, status, config, chain_metadata, created_at, updated_at, hero_image_url, section_images'
    )
    .eq('id', challengeId)
    .single();

  if (error || !row) throw new Error(`Challenge with ID ${challengeId} not found`);
  return rowToLibraryItem(row);
}

export async function updateChallenge(
  challengeId: string,
  challengeData: ChallengeTemplate,
  challengeConfig: ChallengeConfig
): Promise<void> {
  const normalized = normalizeProgramSchedule(challengeData);
  const supabase = getSupabaseServer();

  const config: ConfigRow = {
    difficulty: normalized.difficulty,
    durationWeeks: normalized.durationWeeks,
    theme: normalized.theme,
    tagline: normalized.tagline,
    milestones: normalized.milestones ?? [],
    targetAudience: challengeConfig.targetAudience,
    goals: challengeConfig.goals,
  };
  if (challengeConfig.zoneId !== undefined) {
    config.equipmentProfile = {
      zoneId: challengeConfig.zoneId,
      equipmentIds: challengeConfig.selectedEquipmentIds ?? [],
    };
  }

  const { error: updateError } = await supabase
    .from('challenges')
    .update({
      title: normalized.title,
      description: normalized.description ?? '',
      config,
      updated_at: new Date().toISOString(),
    })
    .eq('id', challengeId);

  if (updateError) throw updateError;

  const { error: deleteWeeksError } = await supabase
    .from('challenge_weeks')
    .delete()
    .eq('challenge_id', challengeId);
  if (deleteWeeksError) throw deleteWeeksError;

  if (normalized.schedule?.length) {
    const weeks = normalized.schedule.map((week) => ({
      challenge_id: challengeId,
      week_number: week.weekNumber,
      content: { workouts: week.workouts ?? [] },
    }));
    const { error: insertWeeksError } = await supabase.from('challenge_weeks').insert(weeks);
    if (insertWeeksError) throw insertWeeksError;
  }
}

export async function deleteChallenge(challengeId: string): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase.from('challenges').delete().eq('id', challengeId);
  if (error) throw error;
}

export async function updateChallengeStatus(
  challengeId: string,
  status: 'draft' | 'published'
): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('challenges')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', challengeId);
  if (error) throw error;
}

export async function updateChallengeHeroImage(
  challengeId: string,
  url: string | null
): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('challenges')
    .update({ hero_image_url: url, updated_at: new Date().toISOString() })
    .eq('id', challengeId);
  if (error) throw error;
}

export async function updateChallengeSectionImages(
  challengeId: string,
  sectionImages: Record<string, string>
): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('challenges')
    .update({ section_images: sectionImages, updated_at: new Date().toISOString() })
    .eq('id', challengeId);
  if (error) throw error;
}

/** Fetch only hero_image_url and section_images for merge updates (images API). */
export async function fetchChallengeImages(challengeId: string): Promise<{
  hero_image_url: string | null;
  section_images: Record<string, string> | null;
} | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('challenges')
    .select('hero_image_url, section_images')
    .eq('id', challengeId)
    .single();
  if (error || !data) return null;
  return {
    hero_image_url: data.hero_image_url ?? null,
    section_images: (data.section_images as Record<string, string>) ?? null,
  };
}
