/**
 * Server-only: detect coach rows (public.trainers) for APIs that no longer use profiles.role = 'trainer'.
 */

import { getSupabaseServer } from '@/lib/supabase/server';

export async function userHasTrainerRecord(userId: string): Promise<boolean> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('trainers')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}
