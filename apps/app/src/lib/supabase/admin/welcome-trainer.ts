/**
 * Server-only: resolve the logged-in client’s trainer + studio for /welcome (bypasses RLS).
 * Client-side profile reads cannot see the program trainer’s row under default policies.
 */

import { getSupabaseServer } from '@/lib/supabase/server';
import { buildEffectiveInviteStudioPreviewFromRow } from '@/lib/supabase/admin/roster-invitations';
import type { RosterInviteStudioPreview } from '@/types/roster-invite-preview';

/** Tie-break when multiple active enrollments share the same `source`. */
const SOURCE_PRIORITY: Record<string, number> = {
  trainer_assigned: 0,
  cohort: 1,
  self: 2,
};

type ActiveEnrollmentRow = {
  program_id: string;
  source: string;
  created_at: string | null;
};

function pickActiveEnrollment(
  rows: ActiveEnrollmentRow[],
  preferredProgramId?: string | null
): ActiveEnrollmentRow | null {
  if (!rows.length) return null;
  const pref = preferredProgramId?.trim();
  if (pref) {
    const match = rows.find((r) => r.program_id === pref);
    if (match) return match;
  }
  const sorted = [...rows].sort((a, b) => {
    const pa = SOURCE_PRIORITY[a.source] ?? 99;
    const pb = SOURCE_PRIORITY[b.source] ?? 99;
    if (pa !== pb) return pa - pb;
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });
  return sorted[0] ?? null;
}

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
      const t = local
        .replace(/[._-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (t) return t;
    }
  }
  return null;
}

export type GetTrainerDisplayForWelcomeOptions = {
  /** Must match an active `user_programs.program_id` for this user or it is ignored. */
  preferredProgramId?: string | null;
};

export type WelcomeClientTrainerContext = {
  trainerDisplayName: string | null;
  /** Effective brand + merged welcome copy (studio wins visually when linked). */
  studio: RosterInviteStudioPreview | null;
  /** Count of active `user_programs` rows (for multi-enrollment hint). */
  activeProgramCount: number;
};

/**
 * Trainer display, studio branding, and active enrollment count for the resolved program.
 * Prefers `preferredProgramId` when it matches an active row; else `trainer_assigned` → `cohort` → `self`,
 * then newest `created_at`.
 */
export async function getWelcomeClientTrainerContext(
  userId: string,
  options?: GetTrainerDisplayForWelcomeOptions
): Promise<WelcomeClientTrainerContext> {
  const empty: WelcomeClientTrainerContext = {
    trainerDisplayName: null,
    studio: null,
    activeProgramCount: 0,
  };

  const supabase = getSupabaseServer();
  const { data: rows, error: enrollErr } = await supabase
    .from('user_programs')
    .select('program_id, source, created_at')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (enrollErr || !rows?.length) return empty;

  const normalized: ActiveEnrollmentRow[] = rows.map((r) => ({
    program_id: String(r.program_id),
    source: typeof r.source === 'string' ? r.source : 'self',
    created_at: r.created_at != null ? String(r.created_at) : null,
  }));

  const activeProgramCount = normalized.length;
  const pick = pickActiveEnrollment(normalized, options?.preferredProgramId ?? null);
  const programId = pick?.program_id;
  if (!programId) return { ...empty, activeProgramCount };

  const { data: program, error: progErr } = await supabase
    .from('programs')
    .select('trainer_id')
    .eq('id', programId)
    .maybeSingle();

  if (progErr || !program?.trainer_id) return { ...empty, activeProgramCount };

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('full_name, username, email, studio_id')
    .eq('id', program.trainer_id)
    .maybeSingle();

  if (profErr || !profile) return { ...empty, activeProgramCount };

  const trainerDisplayName = resolveTrainerDisplayName({
    full_name: profile.full_name ?? null,
    username: profile.username ?? null,
    email: profile.email ?? null,
  });

  const { data: tr } = await supabase
    .from('trainers')
    .select(
      'slug, display_name, logo_url, primary_color, welcome_tagline, welcome_content, studio_id'
    )
    .eq('user_id', program.trainer_id)
    .maybeSingle();

  const sid =
    (tr?.studio_id as string | null | undefined) ??
    (profile.studio_id as string | null | undefined);

  let st: {
    slug: unknown;
    display_name: unknown;
    logo_url?: string | null;
    primary_color?: string | null;
    welcome_tagline?: string | null;
    welcome_content?: unknown;
  } | null = null;
  if (sid) {
    const { data: studioRow } = await supabase
      .from('studios')
      .select('slug, display_name, logo_url, primary_color, welcome_tagline, welcome_content')
      .eq('id', sid)
      .maybeSingle();
    st = studioRow ?? null;
  }

  const previewRow: Record<string, unknown> = {
    studio_slug: st?.slug,
    studio_display_name: st?.display_name,
    studio_logo_url: st?.logo_url,
    studio_primary_color: st?.primary_color,
    studio_welcome_tagline: st?.welcome_tagline,
    studio_welcome_content: st?.welcome_content,
    trainer_slug: tr?.slug,
    trainer_display_name: tr?.display_name,
    trainer_logo_url: tr?.logo_url,
    trainer_primary_color: tr?.primary_color,
    trainer_welcome_tagline: tr?.welcome_tagline,
    trainer_welcome_content: tr?.welcome_content,
  };

  const studio = buildEffectiveInviteStudioPreviewFromRow(previewRow);

  return { trainerDisplayName, studio, activeProgramCount };
}

/**
 * Returns a display string for the trainer tied to the user’s active program enrollment.
 */
export async function getTrainerDisplayForWelcomeClient(
  userId: string,
  options?: GetTrainerDisplayForWelcomeOptions
): Promise<string | null> {
  const ctx = await getWelcomeClientTrainerContext(userId, options);
  return ctx.trainerDisplayName;
}
