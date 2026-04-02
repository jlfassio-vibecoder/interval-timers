/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Mission Control Performance Lab: client enrollments on the trainer's programs,
 * end enrollment, and trainer-recommended active program (client_training_preferences).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { getSupabaseServer } from '@/lib/supabase/server';
import { isUserInViewerRoster } from '@/lib/supabase/admin/trainer-roster';
import { pickActiveEnrollment, type ActiveEnrollmentRow } from '@/lib/enrollment-pick';

export interface ClientEnrollmentForTrainer {
  programId: string;
  title: string;
  status: string;
  startDate: string | null;
  source: string | null;
  isRecommended: boolean;
}

export interface ClientEnrollmentsPayload {
  recommendedProgramId: string | null;
  enrollments: ClientEnrollmentForTrainer[];
}

function normalizeProgramsJoin(
  raw: unknown
): { trainer_id?: string; title?: string | null } | null {
  if (raw == null) return null;
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (row == null || typeof row !== 'object') return null;
  return row as { trainer_id?: string; title?: string | null };
}

async function assertTrainerOwnsProgram(
  supabase: ReturnType<typeof getSupabaseServer>,
  trainerId: string,
  programId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('programs')
    .select('id')
    .eq('id', programId)
    .eq('trainer_id', trainerId)
    .maybeSingle();
  if (error) {
    if (import.meta.env.DEV) console.warn('[trainer-client-enrollments] ownsProgram', error);
    return false;
  }
  return !!data;
}

/**
 * Active enrollments for the client on programs authored by the viewer (trainer).
 */
export async function fetchClientEnrollmentsForTrainer(
  viewerId: string,
  clientUserId: string,
  viewerRole: string
): Promise<ClientEnrollmentsPayload | null> {
  const allowed = await isUserInViewerRoster(viewerId, viewerRole, clientUserId);
  if (!allowed) return null;

  const supabase = getSupabaseServer();

  const { data: prefRow } = await supabase
    .from('client_training_preferences')
    .select('recommended_active_program_id')
    .eq('client_user_id', clientUserId)
    .eq('trainer_user_id', viewerId)
    .maybeSingle();

  const recommendedProgramId =
    typeof prefRow?.recommended_active_program_id === 'string'
      ? prefRow.recommended_active_program_id
      : null;

  const { data: trainerPrograms, error: progErr } = await supabase
    .from('programs')
    .select('id')
    .eq('trainer_id', viewerId);

  if (progErr || !trainerPrograms?.length) {
    if (import.meta.env.DEV && progErr)
      console.warn('[trainer-client-enrollments] trainer programs', progErr);
    return { recommendedProgramId, enrollments: [] };
  }

  const programIds = trainerPrograms.map((p) => p.id as string);

  const { data: rows, error } = await supabase
    .from('user_programs')
    .select('program_id, status, start_date, source, programs(title)')
    .eq('user_id', clientUserId)
    .in('program_id', programIds);

  if (error) {
    if (import.meta.env.DEV) console.warn('[trainer-client-enrollments] fetch', error);
    return { recommendedProgramId, enrollments: [] };
  }

  const enrollments: ClientEnrollmentForTrainer[] = (rows ?? []).map((row) => {
    const p = normalizeProgramsJoin(row.programs);
    const title = typeof p?.title === 'string' && p.title.trim() ? p.title : 'Untitled';
    return {
      programId: row.program_id as string,
      title,
      status: typeof row.status === 'string' ? row.status : 'active',
      startDate:
        row.start_date != null && typeof row.start_date === 'string' ? row.start_date : null,
      source: row.source != null && typeof row.source === 'string' ? row.source : null,
      isRecommended: recommendedProgramId === row.program_id,
    };
  });

  enrollments.sort((a, b) => a.title.localeCompare(b.title));

  return { recommendedProgramId, enrollments };
}

/**
 * Set enrollment to completed for a program owned by the viewer.
 */
export async function endClientEnrollment(
  viewerId: string,
  clientUserId: string,
  programId: string,
  viewerRole: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const allowed = await isUserInViewerRoster(viewerId, viewerRole, clientUserId);
  if (!allowed) return { ok: false, error: 'Client not found or not in your roster' };

  const supabase = getSupabaseServer();
  const owns = await assertTrainerOwnsProgram(supabase, viewerId, programId);
  if (!owns) return { ok: false, error: 'Program not found or not owned by you' };

  const { data: existing, error: fetchErr } = await supabase
    .from('user_programs')
    .select('status')
    .eq('user_id', clientUserId)
    .eq('program_id', programId)
    .maybeSingle();

  if (fetchErr || !existing) {
    return { ok: false, error: 'Enrollment not found' };
  }
  if (existing.status === 'completed') {
    return { ok: false, error: 'Enrollment already ended' };
  }

  const { error: updErr } = await supabase
    .from('user_programs')
    .update({ status: 'completed' })
    .eq('user_id', clientUserId)
    .eq('program_id', programId);

  if (updErr) {
    if (import.meta.env.DEV) console.warn('[trainer-client-enrollments] end', updErr);
    return { ok: false, error: 'Failed to end enrollment' };
  }

  if (await recommendedProgramIdMatches(supabase, clientUserId, viewerId, programId)) {
    await supabase
      .from('client_training_preferences')
      .update({
        recommended_active_program_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('client_user_id', clientUserId)
      .eq('trainer_user_id', viewerId);
  }

  return { ok: true };
}

async function recommendedProgramIdMatches(
  supabase: ReturnType<typeof getSupabaseServer>,
  clientUserId: string,
  trainerUserId: string,
  programId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('client_training_preferences')
    .select('recommended_active_program_id')
    .eq('client_user_id', clientUserId)
    .eq('trainer_user_id', trainerUserId)
    .maybeSingle();
  return data?.recommended_active_program_id === programId;
}

/**
 * Upsert trainer recommendation. programId null clears recommendation.
 */
export async function setTrainerRecommendedActiveProgram(
  viewerId: string,
  clientUserId: string,
  programId: string | null,
  viewerRole: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const allowed = await isUserInViewerRoster(viewerId, viewerRole, clientUserId);
  if (!allowed) return { ok: false, error: 'Client not found or not in your roster' };

  const supabase = getSupabaseServer();

  if (programId != null && programId.trim()) {
    const pid = programId.trim();
    const owns = await assertTrainerOwnsProgram(supabase, viewerId, pid);
    if (!owns) return { ok: false, error: 'Program not found or not owned by you' };

    const { data: enr, error: enrErr } = await supabase
      .from('user_programs')
      .select('status')
      .eq('user_id', clientUserId)
      .eq('program_id', pid)
      .maybeSingle();

    if (enrErr || !enr) {
      return { ok: false, error: 'Client is not enrolled in this program' };
    }
    if (enr.status !== 'active') {
      return { ok: false, error: 'Enrollment is not active; cannot set as recommended' };
    }
  }

  const payload = {
    client_user_id: clientUserId,
    trainer_user_id: viewerId,
    recommended_active_program_id: programId?.trim() ? programId.trim() : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('client_training_preferences').upsert(payload, {
    onConflict: 'client_user_id,trainer_user_id',
  });

  if (error) {
    if (import.meta.env.DEV) console.warn('[trainer-client-enrollments] upsert pref', error);
    return { ok: false, error: 'Failed to save recommendation' };
  }

  return { ok: true };
}

/**
 * Read stored recommendation for a client/trainer pair.
 */
export async function getTrainerRecommendedActiveProgramForClient(
  clientUserId: string,
  trainerUserId: string
): Promise<string | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('client_training_preferences')
    .select('recommended_active_program_id')
    .eq('client_user_id', clientUserId)
    .eq('trainer_user_id', trainerUserId)
    .maybeSingle();

  if (error || !data) return null;
  const id = data.recommended_active_program_id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

type EnrollmentWithTrainer = ActiveEnrollmentRow & { trainerId: string };

function mapEnrollmentRowsToPrimaryTrainerId(
  rows: Array<{
    program_id: string;
    source?: string | null;
    created_at?: string | null;
    programs?: { trainer_id?: string } | { trainer_id?: string }[] | null;
  }>
): string | null {
  const withTrainer: EnrollmentWithTrainer[] = rows
    .map((row) => {
      const rawP = row.programs;
      const p = Array.isArray(rawP) ? rawP[0] : rawP;
      const trainerId = typeof p?.trainer_id === 'string' ? p.trainer_id : '';
      if (!trainerId) return null;
      return {
        program_id: row.program_id as string,
        source: row.source != null && typeof row.source === 'string' ? row.source : 'self',
        created_at:
          row.created_at != null && typeof row.created_at === 'string' ? row.created_at : null,
        trainerId,
      };
    })
    .filter((x): x is EnrollmentWithTrainer => x != null);

  if (!withTrainer.length) return null;
  const picked = pickActiveEnrollment(withTrainer, null);
  if (!picked) return null;
  const match = withTrainer.find((w) => w.program_id === picked.program_id);
  return match?.trainerId ?? null;
}

/**
 * HUD: resolve recommendation using the caller's JWT (RLS), not service role — works when
 * SUPABASE_SERVICE_ROLE_KEY is unset (Copilot PR #127). Matches authenticateInvitationsApiRequest pattern.
 */
export async function fetchTrainerRecommendationForAuthenticatedSupabaseUser(
  supabase: SupabaseClient<Database>,
  authUserId: string
): Promise<{ programId: string | null; trainerId: string | null }> {
  const { data: rows, error } = await supabase
    .from('user_programs')
    .select('program_id, source, created_at, programs!inner(trainer_id)')
    .eq('user_id', authUserId)
    .eq('status', 'active');

  if (error || !rows?.length) {
    if (import.meta.env.DEV && error)
      console.warn('[trainer-client-enrollments] recommendation user_programs', error);
    return { programId: null, trainerId: null };
  }

  const trainerId = mapEnrollmentRowsToPrimaryTrainerId(rows);
  if (!trainerId) return { programId: null, trainerId: null };

  const { data: pref, error: prefErr } = await supabase
    .from('client_training_preferences')
    .select('recommended_active_program_id')
    .eq('client_user_id', authUserId)
    .eq('trainer_user_id', trainerId)
    .maybeSingle();

  if (prefErr) {
    if (import.meta.env.DEV)
      console.warn('[trainer-client-enrollments] recommendation preferences', prefErr);
    return { programId: null, trainerId };
  }

  const prefRow = pref as { recommended_active_program_id?: string | null } | null;
  const raw = prefRow?.recommended_active_program_id;
  const programId = typeof raw === 'string' && raw.trim() ? raw.trim() : null;
  return { programId, trainerId };
}
