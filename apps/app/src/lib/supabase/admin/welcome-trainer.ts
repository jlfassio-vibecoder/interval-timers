/**
 * Server-only: resolve the logged-in client’s trainer display name for /welcome (bypasses RLS).
 * Client-side profile reads cannot see the program trainer’s row under default policies.
 */

import { getSupabaseServer } from '@/lib/supabase/server';

function resolveTrainerDisplayName(row: {
  full_name: string | null;
  username: string | null;
  email: string | null;
}): string | null {
  const n = row.full_name?.trim();
  if (n) return n;
  const u = row.username?.trim();
  if (u) return u;
  const e = row.email?.trim();
  if (e) {
    const local = e.split('@')[0]?.trim() ?? '';
    if (local) {
      const t = local.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (t) return t;
    }
  }
  return null;
}

/**
 * Returns a display string for the trainer tied to the user’s active program enrollment
 * (prefers `trainer_assigned` when multiple actives exist).
 */
export async function getTrainerDisplayForWelcomeClient(userId: string): Promise<string | null> {
  const supabase = getSupabaseServer();
  const { data: rows, error: enrollErr } = await supabase
    .from('user_programs')
    .select('program_id, source')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (enrollErr || !rows?.length) return null;

  const assigned = rows.find((r) => r.source === 'trainer_assigned');
  const pick = assigned ?? rows[0];
  const programId = pick?.program_id as string | undefined;
  if (!programId) return null;

  const { data: program, error: progErr } = await supabase
    .from('programs')
    .select('trainer_id')
    .eq('id', programId)
    .maybeSingle();

  if (progErr || !program?.trainer_id) return null;

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('full_name, username, email')
    .eq('id', program.trainer_id)
    .maybeSingle();

  if (profErr || !profile) return null;

  return resolveTrainerDisplayName({
    full_name: profile.full_name ?? null,
    username: profile.username ?? null,
    email: profile.email ?? null,
  });
}
