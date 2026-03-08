/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Supabase program entitlement helpers.
 * ensureProgramPublished, grantProgramAccess, checkProgramAccess, getSecureFullProgram.
 */

import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchFullProgram } from '@/lib/supabase/admin/program-server';
import type { ProgramTemplate } from '@/types/ai-program';

/**
 * Ensure program exists and is published. Throws NOT_FOUND if not found or not public.
 */
export async function ensureProgramPublished(programId: string): Promise<void> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('programs')
    .select('id, is_public')
    .eq('id', programId)
    .single();
  if (error || !data) throw new Error('NOT_FOUND');
  if (!data.is_public) throw new Error('NOT_FOUND');
}

/**
 * Grant the user access to the program (insert user_programs). On conflict do nothing.
 */
export async function grantProgramAccess(userId: string, programId: string): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('user_programs')
    .upsert(
      { user_id: userId, program_id: programId },
      { onConflict: 'user_id,program_id', ignoreDuplicates: true }
    );
  if (error) throw error;
}

/**
 * Check if the user has access to the program (owns it via user_programs).
 */
export async function checkProgramAccess(userId: string, programId: string): Promise<boolean> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('user_programs')
    .select('id')
    .eq('user_id', userId)
    .eq('program_id', programId)
    .maybeSingle();
  if (error) return false;
  return data != null;
}

/**
 * Fetch full program (all weeks) only if the user has access. Throws FORBIDDEN if no access.
 */
export async function getSecureFullProgram(
  userId: string,
  programId: string
): Promise<ProgramTemplate> {
  const hasAccess = await checkProgramAccess(userId, programId);
  if (!hasAccess) throw new Error('FORBIDDEN');
  return fetchFullProgram(programId);
}
