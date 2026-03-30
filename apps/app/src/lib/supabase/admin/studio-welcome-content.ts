/**
 * Trainer-editable studio welcome / invite landing copy (studios.welcome_content).
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

export type StudioWelcomeEditorPayload =
  | {
      ok: true;
      studioLinked: true;
      studioId: string;
      slug: string;
      displayName: string;
      stored: StudioWelcomeContentStored;
    }
  | {
      ok: true;
      studioLinked: false;
      stored: StudioWelcomeContentStored;
    }
  | { ok: false; code: 'DB'; message: string };

export async function getStudioWelcomeContentForEditor(
  trainerId: string
): Promise<StudioWelcomeEditorPayload> {
  const supabase = getSupabaseServer();
  const { data: tr, error: tErr } = await supabase
    .from('trainers')
    .select('studio_id')
    .eq('user_id', trainerId)
    .maybeSingle();

  if (tErr) {
    return { ok: false, code: 'DB', message: 'Failed to load trainer record' };
  }

  const { data: prof, error: pErr } = await supabase
    .from('profiles')
    .select('studio_id')
    .eq('id', trainerId)
    .maybeSingle();

  if (pErr || !prof) {
    return { ok: false, code: 'DB', message: 'Failed to load profile' };
  }

  const sid =
    (tr?.studio_id as string | null | undefined) ?? (prof.studio_id as string | null | undefined);
  if (!sid) {
    return { ok: true, studioLinked: false, stored: {} };
  }

  const { data: st, error: sErr } = await supabase
    .from('studios')
    .select('id, slug, display_name, welcome_content')
    .eq('id', sid)
    .maybeSingle();

  if (sErr || !st) {
    return { ok: false, code: 'DB', message: 'Failed to load studio' };
  }

  return {
    ok: true,
    studioLinked: true,
    studioId: String(st.id),
    slug: String(st.slug),
    displayName: String(st.display_name),
    stored: parseStudioWelcomeContent(st.welcome_content),
  };
}

export type UpdateStudioWelcomeContentResult =
  | { ok: true; stored: StudioWelcomeContentStored }
  | { ok: false; code: 'NO_STUDIO' | 'FORBIDDEN' | 'DB'; message: string };

export async function updateStudioWelcomeContent(
  trainerId: string,
  patch: unknown
): Promise<UpdateStudioWelcomeContentResult> {
  const current = await getStudioWelcomeContentForEditor(trainerId);
  if (!current.ok) {
    return { ok: false, code: 'DB', message: current.message };
  }
  if (!current.studioLinked) {
    return {
      ok: false,
      code: 'NO_STUDIO',
      message: 'Link a studio to your profile before saving welcome copy.',
    };
  }

  const merged = mergeStudioWelcomeContentPatch(current.stored, patch);
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('studios')
    .update({
      welcome_content: JSON.parse(JSON.stringify(merged)) as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    })
    .eq('id', current.studioId);

  if (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[studio-welcome-content] update', error);
    }
    return { ok: false, code: 'DB', message: 'Failed to save welcome copy' };
  }

  return { ok: true, stored: merged };
}
