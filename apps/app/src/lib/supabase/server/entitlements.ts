/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Supabase entitlement helpers for challenges.
 * ensureChallengePublished, grantChallengeAccess, checkChallengeAccess, getSecureFullChallenge.
 */

import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchFullChallenge } from '@/lib/supabase/admin/challenges';
import type { ChallengeTemplate } from '@/types/ai-challenge';

/**
 * Check if the user has access to the challenge (owns it via user_challenges).
 */
export async function checkChallengeAccess(userId: string, challengeId: string): Promise<boolean> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('user_challenges')
    .select('id')
    .eq('user_id', userId)
    .eq('challenge_id', challengeId)
    .maybeSingle();
  if (error) return false;
  return data != null;
}

/**
 * Ensure challenge exists and is published. Throws NOT_FOUND if not found or not published.
 */
export async function ensureChallengePublished(challengeId: string): Promise<void> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('challenges')
    .select('id, status')
    .eq('id', challengeId)
    .single();
  if (error || !data) throw new Error('NOT_FOUND');
  if (data.status !== 'published') throw new Error('NOT_FOUND');
}

/**
 * Grant the user access to the challenge (insert user_challenges).
 */
export async function grantChallengeAccess(userId: string, challengeId: string): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('user_challenges')
    .upsert(
      { user_id: userId, challenge_id: challengeId },
      { onConflict: 'user_id,challenge_id', ignoreDuplicates: true }
    );
  if (error) throw error;
}

/**
 * Fetch full challenge (all weeks) only if the user has access.
 */
export async function getSecureFullChallenge(
  userId: string,
  challengeId: string
): Promise<ChallengeTemplate> {
  const hasAccess = await checkChallengeAccess(userId, challengeId);
  if (!hasAccess) throw new Error('FORBIDDEN');
  return fetchFullChallenge(challengeId);
}
