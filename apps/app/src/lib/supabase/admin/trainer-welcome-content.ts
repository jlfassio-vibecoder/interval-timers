/**
 * Coach-scoped welcome / invite copy (public.trainers.welcome_content). Service-role reads/writes.
 */

import {
  mergeStudioWelcomeContentPatch,
  parseStudioWelcomeContent,
} from '@/lib/studio-welcome-content-schema';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { StudioWelcomeContentStored } from '@/types/studio-welcome-content';

export {
  getStudioWelcomeContentLimits,
  mergeStudioWelcomeContentPatch,
  parseStudioWelcomeContent,
} from '@/lib/studio-welcome-content-schema';

function resolveDisplayNameFromProfile(row: {
  full_name: string | null;
  username: string | null;
}): string {
  const n = row.full_name?.trim();
  if (n) return n;
  const u = row.username?.trim();
  if (u) return u;
  return 'Coach';
}

/**
 * Ensures a trainers row exists (migration backfill covers legacy coaches; this handles edge cases).
 */
export async function ensureTrainerRow(trainerId: string): Promise<boolean> {
  const supabase = getSupabaseServer();
  const { data: row } = await supabase
    .from('trainers')
    .select('user_id')
    .eq('user_id', trainerId)
    .maybeSingle();
  if (row) return true;

  const { data: prof, error: pErr } = await supabase
    .from('profiles')
    .select('full_name, username')
    .eq('id', trainerId)
    .maybeSingle();

  if (pErr || !prof) return false;

  const displayName = resolveDisplayNameFromProfile({
    full_name: prof.full_name ?? null,
    username: prof.username ?? null,
  });
  const slug = `c-${trainerId.replace(/-/g, '')}`;

  const { error: iErr } = await supabase.from('trainers').insert({
    user_id: trainerId,
    display_name: displayName,
    slug,
    welcome_content: {},
  });

  return !iErr;
}

export type TrainerWelcomeEditorPayload =
  | { ok: true; slug: string | null; displayName: string; stored: StudioWelcomeContentStored }
  | { ok: false; code: 'DB' | 'NO_PROFILE'; message: string };

export async function getTrainerWelcomeContentForEditor(
  trainerId: string
): Promise<TrainerWelcomeEditorPayload> {
  const ensured = await ensureTrainerRow(trainerId);
  if (!ensured) {
    return { ok: false, code: 'NO_PROFILE', message: 'Could not load or create coach record' };
  }

  const supabase = getSupabaseServer();
  const { data: tr, error } = await supabase
    .from('trainers')
    .select('slug, display_name, welcome_content')
    .eq('user_id', trainerId)
    .maybeSingle();

  if (error || !tr) {
    return { ok: false, code: 'DB', message: 'Failed to load coach welcome copy' };
  }

  return {
    ok: true,
    slug: typeof tr.slug === 'string' ? tr.slug : null,
    displayName: String(tr.display_name ?? 'Coach'),
    stored: parseStudioWelcomeContent(tr.welcome_content),
  };
}

export type UpdateTrainerWelcomeContentResult =
  | { ok: true; stored: StudioWelcomeContentStored }
  | { ok: false; code: 'DB'; message: string };

export async function updateTrainerWelcomeContent(
  trainerId: string,
  patch: unknown
): Promise<UpdateTrainerWelcomeContentResult> {
  const ensured = await ensureTrainerRow(trainerId);
  if (!ensured) {
    return { ok: false, code: 'DB', message: 'Could not load or create coach record' };
  }

  const current = await getTrainerWelcomeContentForEditor(trainerId);
  if (!current.ok) {
    return { ok: false, code: 'DB', message: current.message };
  }

  const merged = mergeStudioWelcomeContentPatch(current.stored, patch);
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('trainers')
    .update({
      welcome_content: JSON.parse(JSON.stringify(merged)) as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', trainerId);

  if (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[trainer-welcome-content] update', error);
    }
    return { ok: false, code: 'DB', message: 'Failed to save coach welcome copy' };
  }

  return { ok: true, stored: merged };
}
