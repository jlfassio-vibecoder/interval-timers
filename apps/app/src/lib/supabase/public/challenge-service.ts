/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Public challenge service (Supabase).
 * Fetches published challenges and Week 1 preview.
 */

import { getSupabaseServer } from '@/lib/supabase/server';
import type {
  ChallengeLibraryItem,
  ChallengePreviewData,
  ChallengeMilestone,
} from '@/types/ai-challenge';
import type { Goals, PromptChainMetadata, UserDemographics } from '@/types/ai-program';

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
 * Fetch published challenges (metadata only).
 */
export async function getPublishedChallenges(): Promise<ChallengeLibraryItem[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('challenges')
    .select(
      'id, title, description, author_id, status, config, chain_metadata, created_at, updated_at, hero_image_url, section_images'
    )
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (error) {
    if (import.meta.env.DEV)
      console.warn('[challenge-service] getPublishedChallenges error:', error);
    return [];
  }
  return (data ?? []).map(rowToLibraryItem);
}

/**
 * Fetch challenge preview: metadata + Week 1 only. Weeks 2+ require access.
 */
export async function getChallengePreview(
  challengeId: string
): Promise<ChallengePreviewData | null> {
  const supabase = getSupabaseServer();
  const { data: row, error } = await supabase
    .from('challenges')
    .select(
      'id, title, description, author_id, status, config, chain_metadata, created_at, updated_at, hero_image_url, section_images'
    )
    .eq('id', challengeId)
    .eq('status', 'published')
    .single();

  if (error || !row) return null;

  const metadata = rowToLibraryItem(row);
  const totalWeeks = metadata.durationWeeks;

  const { data: weekRow, error: weekError } = await supabase
    .from('challenge_weeks')
    .select('week_number, content')
    .eq('challenge_id', challengeId)
    .eq('week_number', 1)
    .maybeSingle();

  if (weekError) return { metadata, previewWeek: { weekNumber: 1, workouts: [] }, totalWeeks };
  const workouts = (weekRow?.content as { workouts?: unknown[] })?.workouts ?? [];
  const previewWeek = {
    weekNumber: (weekRow?.week_number as number) ?? 1,
    workouts: workouts as ChallengePreviewData['previewWeek']['workouts'],
  };

  return {
    metadata,
    previewWeek,
    totalWeeks,
  };
}
