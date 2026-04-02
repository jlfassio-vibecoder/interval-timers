/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * P1: Coach assignments (programs, workouts, WODs) for Performance Lab + client HUD.
 */

import type { Artist, Exercise, WorkoutDetail } from '@/types';
import { getSupabaseServer } from '@/lib/supabase/server';
import { isUserInViewerRoster } from '@/lib/supabase/admin/trainer-roster';
import { supabaseWorkoutRowToArtist } from '@/lib/coach-assignment-map';

async function assertTrainerOwnsProgramDb(
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
    if (import.meta.env.DEV) console.warn('[trainer-client-assignments] ownsProgram', error);
    return false;
  }
  return !!data;
}

export type CoachAssignmentType = 'program' | 'workout' | 'wod';

export interface CoachAssignmentListItem {
  id: string;
  assignmentType: CoachAssignmentType;
  resourceId: string;
  titleSnapshot: string;
  assignedAt: string;
  startsOn: string | null;
  expiresOn: string | null;
}

export interface ClientCoachAssignmentApiRow extends CoachAssignmentListItem {
  action: 'set_program' | 'open_workout';
  programId?: string;
  href?: string;
}

const DEFAULT_WOD_IMAGE = '/images/outdoor-calisthenics-workout-001.jpg';

function normalizeType(raw: string): CoachAssignmentType | null {
  const t = raw.trim().toLowerCase();
  if (t === 'program' || t === 'workout' || t === 'wod') return t;
  return null;
}

function isExpired(expiresOn: string | null): boolean {
  if (!expiresOn) return false;
  const d = new Date(expiresOn + 'T23:59:59.999Z');
  return d.getTime() < Date.now();
}

export async function fetchClientCoachAssignmentsForTrainer(
  viewerId: string,
  clientUserId: string,
  viewerRole: string
): Promise<CoachAssignmentListItem[] | null> {
  const allowed = await isUserInViewerRoster(viewerId, viewerRole, clientUserId);
  if (!allowed) return null;

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('client_coach_assignments')
    .select(
      'id, assignment_type, resource_id, title_snapshot, assigned_at, starts_on, expires_on, revoked_at'
    )
    .eq('trainer_user_id', viewerId)
    .eq('client_user_id', clientUserId)
    .is('revoked_at', null)
    .order('assigned_at', { ascending: false });

  if (error) {
    if (import.meta.env.DEV) console.warn('[trainer-client-assignments] list trainer', error);
    return [];
  }

  return (data ?? [])
    .filter((row) => row.assignment_type && row.resource_id)
    .map((row) => ({
      id: row.id as string,
      assignmentType: row.assignment_type as CoachAssignmentType,
      resourceId: row.resource_id as string,
      titleSnapshot: typeof row.title_snapshot === 'string' ? row.title_snapshot : 'Untitled',
      assignedAt: row.assigned_at as string,
      startsOn: row.starts_on != null ? String(row.starts_on) : null,
      expiresOn: row.expires_on != null ? String(row.expires_on) : null,
    }));
}

async function fetchTitleAndValidateResource(
  viewerId: string,
  type: CoachAssignmentType,
  resourceId: string
): Promise<{ ok: true; title: string } | { ok: false; error: string }> {
  const supabase = getSupabaseServer();

  if (type === 'program') {
    const owns = await assertTrainerOwnsProgramDb(supabase, viewerId, resourceId);
    if (!owns) return { ok: false, error: 'Program not found or not owned by you' };
    const { data } = await supabase
      .from('programs')
      .select('title')
      .eq('id', resourceId)
      .maybeSingle();
    const title =
      data && typeof (data as { title?: string }).title === 'string'
        ? (data as { title: string }).title.trim() || 'Program'
        : 'Program';
    return { ok: true, title };
  }

  if (type === 'workout') {
    const { data, error } = await supabase
      .from('workouts')
      .select('id, title, trainer_id')
      .eq('id', resourceId)
      .maybeSingle();
    if (error || !data) return { ok: false, error: 'Workout not found' };
    const row = data as { trainer_id?: string; title?: string };
    if (row.trainer_id !== viewerId) return { ok: false, error: 'Workout not owned by you' };
    const title = typeof row.title === 'string' && row.title.trim() ? row.title.trim() : 'Workout';
    return { ok: true, title };
  }

  const { data, error } = await supabase
    .from('generated_wods')
    .select('id, title, name, author_id, status')
    .eq('id', resourceId)
    .maybeSingle();
  if (error || !data) return { ok: false, error: 'WOD not found' };
  const row = data as {
    author_id?: string | null;
    status?: string | null;
    name?: string | null;
    title?: string | null;
  };
  if (row.author_id !== viewerId) return { ok: false, error: 'WOD not owned by you' };
  if (row.status !== 'approved') return { ok: false, error: 'WOD must be approved before assigning' };
  const title =
    (typeof row.name === 'string' && row.name.trim()) ||
    (typeof row.title === 'string' && row.title.trim()) ||
    'WOD';
  return { ok: true, title };
}

export async function createClientCoachAssignment(
  viewerId: string,
  clientUserId: string,
  viewerRole: string,
  body: {
    assignmentType: string;
    resourceId: string;
    startsOn?: string | null;
    expiresOn?: string | null;
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const allowed = await isUserInViewerRoster(viewerId, viewerRole, clientUserId);
  if (!allowed) return { ok: false, error: 'Client not found or not in your roster' };

  const type = normalizeType(body.assignmentType);
  if (!type) return { ok: false, error: 'Invalid assignmentType' };
  const resourceId = body.resourceId?.trim();
  if (!resourceId) return { ok: false, error: 'resourceId required' };

  const validated = await fetchTitleAndValidateResource(viewerId, type, resourceId);
  if (!validated.ok) return validated;

  const supabase = getSupabaseServer();

  if (type === 'program') {
    const { error: upErr } = await supabase.from('user_programs').upsert(
      {
        user_id: clientUserId,
        program_id: resourceId,
        status: 'active',
        source: 'trainer_assigned',
      },
      { onConflict: 'user_id,program_id' }
    );
    if (upErr) {
      if (import.meta.env.DEV) console.warn('[trainer-client-assignments] upsert program', upErr);
      return { ok: false, error: 'Failed to enroll client in program' };
    }
  }

  const { data: inserted, error: insErr } = await supabase
    .from('client_coach_assignments')
    .insert({
      trainer_user_id: viewerId,
      client_user_id: clientUserId,
      assignment_type: type,
      resource_id: resourceId,
      title_snapshot: validated.title,
      starts_on: body.startsOn?.trim() || null,
      expires_on: body.expiresOn?.trim() || null,
    })
    .select('id')
    .single();

  if (insErr || !inserted?.id) {
    if (import.meta.env.DEV) console.warn('[trainer-client-assignments] insert', insErr);
    return { ok: false, error: 'Failed to create assignment' };
  }

  return { ok: true, id: inserted.id as string };
}

export async function revokeClientCoachAssignment(
  viewerId: string,
  clientUserId: string,
  viewerRole: string,
  assignmentId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const allowed = await isUserInViewerRoster(viewerId, viewerRole, clientUserId);
  if (!allowed) return { ok: false, error: 'Client not found or not in your roster' };

  const supabase = getSupabaseServer();
  const { data: row, error: fetchErr } = await supabase
    .from('client_coach_assignments')
    .select('id, trainer_user_id, client_user_id, revoked_at')
    .eq('id', assignmentId)
    .maybeSingle();

  if (fetchErr || !row) return { ok: false, error: 'Assignment not found' };
  const r = row as {
    trainer_user_id?: string;
    client_user_id?: string;
    revoked_at?: string | null;
  };
  if (r.trainer_user_id !== viewerId || r.client_user_id !== clientUserId) {
    return { ok: false, error: 'Assignment not found' };
  }
  if (r.revoked_at) return { ok: false, error: 'Assignment already revoked' };

  const { error: updErr } = await supabase
    .from('client_coach_assignments')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', assignmentId);

  if (updErr) {
    if (import.meta.env.DEV) console.warn('[trainer-client-assignments] revoke', updErr);
    return { ok: false, error: 'Failed to revoke assignment' };
  }
  return { ok: true };
}

export async function listOpenCoachAssignmentsForClient(
  clientUserId: string
): Promise<ClientCoachAssignmentApiRow[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('client_coach_assignments')
    .select(
      'id, assignment_type, resource_id, title_snapshot, assigned_at, starts_on, expires_on, dismissed_at, revoked_at'
    )
    .eq('client_user_id', clientUserId)
    .is('revoked_at', null)
    .is('dismissed_at', null)
    .order('assigned_at', { ascending: false });

  if (error) {
    if (import.meta.env.DEV) console.warn('[trainer-client-assignments] list client', error);
    return [];
  }

  const out: ClientCoachAssignmentApiRow[] = [];
  for (const row of data ?? []) {
    const expiresOn = row.expires_on != null ? String(row.expires_on) : null;
    if (isExpired(expiresOn)) continue;

    const assignmentType = row.assignment_type as CoachAssignmentType;
    const id = row.id as string;
    const resourceId = row.resource_id as string;
    const base: CoachAssignmentListItem = {
      id,
      assignmentType,
      resourceId,
      titleSnapshot:
        typeof row.title_snapshot === 'string' ? row.title_snapshot : 'Untitled',
      assignedAt: row.assigned_at as string,
      startsOn: row.starts_on != null ? String(row.starts_on) : null,
      expiresOn,
    };

    if (assignmentType === 'program') {
      out.push({
        ...base,
        action: 'set_program',
        programId: resourceId,
      });
    } else {
      out.push({
        ...base,
        action: 'open_workout',
        href: `/workout/assigned?assignmentId=${encodeURIComponent(id)}`,
      });
    }
  }
  return out;
}

export async function dismissCoachAssignmentForClient(
  clientUserId: string,
  assignmentId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseServer();
  const { data: row, error: fetchErr } = await supabase
    .from('client_coach_assignments')
    .select('id, client_user_id, revoked_at, dismissed_at')
    .eq('id', assignmentId)
    .maybeSingle();

  if (fetchErr || !row) return { ok: false, error: 'Assignment not found' };
  const r = row as { client_user_id?: string; revoked_at?: string | null };
  if (r.client_user_id !== clientUserId) return { ok: false, error: 'Assignment not found' };
  if (r.revoked_at) return { ok: false, error: 'Assignment is no longer active' };

  const { error: updErr } = await supabase
    .from('client_coach_assignments')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', assignmentId)
    .eq('client_user_id', clientUserId);

  if (updErr) {
    if (import.meta.env.DEV) console.warn('[trainer-client-assignments] dismiss', updErr);
    return { ok: false, error: 'Failed to dismiss' };
  }
  return { ok: true };
}

function generatedWodRowToArtist(row: {
  id: string;
  level: string | null;
  name: string | null;
  title: string | null;
  genre: string | null;
  image: string | null;
  day: string | null;
  description: string | null;
  intensity: number | null;
  workout_detail: unknown;
  exercise_overrides: unknown;
  target_volume_minutes: number | null;
  window_minutes: number | null;
  rest_load: string | null;
}): Artist {
  const workoutDetail = row.workout_detail as WorkoutDetail;
  if (!workoutDetail || typeof workoutDetail !== 'object' || !workoutDetail.main) {
    throw new Error('Invalid WOD payload');
  }
  const name =
    (typeof row.name === 'string' && row.name.trim()) ||
    (typeof row.title === 'string' && row.title.trim()) ||
    'WOD';
  return {
    id: row.id,
    name,
    genre: row.genre?.trim() || 'WOD',
    image: row.image?.trim() || DEFAULT_WOD_IMAGE,
    day: row.day?.trim() || 'WOD',
    description: row.description?.trim() || '',
    intensity: typeof row.intensity === 'number' ? row.intensity : 3,
    workoutDetail,
    exerciseOverrides: row.exercise_overrides as Record<string, Exercise> | undefined,
    targetVolumeMinutes:
      typeof row.target_volume_minutes === 'number' ? row.target_volume_minutes : undefined,
    windowMinutes: typeof row.window_minutes === 'number' ? row.window_minutes : undefined,
    restLoad: typeof row.rest_load === 'string' ? row.rest_load : undefined,
  };
}

export type CoachAssignmentPayloadResult =
  | { ok: true; assignmentType: 'program'; programId: string; title: string }
  | { ok: true; assignmentType: 'workout' | 'wod'; artist: Artist }
  | { ok: false; error: string };

export async function getCoachAssignmentPayloadForClient(
  clientUserId: string,
  assignmentId: string
): Promise<CoachAssignmentPayloadResult> {
  const supabase = getSupabaseServer();
  const { data: row, error } = await supabase
    .from('client_coach_assignments')
    .select(
      'id, client_user_id, trainer_user_id, assignment_type, resource_id, title_snapshot, dismissed_at, revoked_at, expires_on'
    )
    .eq('id', assignmentId)
    .maybeSingle();

  if (error || !row) return { ok: false, error: 'Assignment not found' };
  const r = row as {
    client_user_id?: string;
    trainer_user_id?: string;
    assignment_type?: string;
    resource_id?: string;
    title_snapshot?: string;
    dismissed_at?: string | null;
    revoked_at?: string | null;
    expires_on?: string | null;
  };
  if (r.client_user_id !== clientUserId) return { ok: false, error: 'Assignment not found' };
  if (r.revoked_at || r.dismissed_at) return { ok: false, error: 'Assignment is not available' };
  if (isExpired(r.expires_on != null ? String(r.expires_on) : null)) {
    return { ok: false, error: 'Assignment has expired' };
  }

  const trainerUserId = typeof r.trainer_user_id === 'string' ? r.trainer_user_id : '';
  if (!trainerUserId) return { ok: false, error: 'Assignment not found' };

  const assignmentType = r.assignment_type as CoachAssignmentType;
  const resourceId = r.resource_id as string;
  const title =
    typeof r.title_snapshot === 'string' && r.title_snapshot.trim()
      ? r.title_snapshot.trim()
      : 'Assignment';

  // Defense-in-depth: service role bypasses RLS — require resource owner to match assignment trainer
  // so poisoned rows (e.g. from a compromised JWT path) cannot leak other trainers' content.

  if (assignmentType === 'program') {
    const owns = await assertTrainerOwnsProgramDb(supabase, trainerUserId, resourceId);
    if (!owns) return { ok: false, error: 'Assignment not found' };
    return { ok: true, assignmentType: 'program', programId: resourceId, title };
  }

  if (assignmentType === 'workout') {
    const { data: w, error: wErr } = await supabase
      .from('workouts')
      .select('id, title, description, blocks, trainer_id')
      .eq('id', resourceId)
      .maybeSingle();
    if (wErr || !w) return { ok: false, error: 'Workout not found' };
    const wr = w as { trainer_id?: string };
    if (wr.trainer_id !== trainerUserId) return { ok: false, error: 'Workout not found' };
    try {
      const artist = supabaseWorkoutRowToArtist(
        w as { id: string; title: string; description: string | null; blocks: unknown }
      );
      return { ok: true, assignmentType: 'workout', artist };
    } catch {
      return { ok: false, error: 'Workout could not be loaded' };
    }
  }

  if (assignmentType === 'wod') {
    const { data: wod, error: wodErr } = await supabase
      .from('generated_wods')
      .select(
        'id, level, name, title, genre, image, day, description, intensity, workout_detail, exercise_overrides, target_volume_minutes, window_minutes, rest_load, status, author_id'
      )
      .eq('id', resourceId)
      .maybeSingle();
    if (wodErr || !wod) return { ok: false, error: 'WOD not found' };
    const w = wod as { status?: string | null; author_id?: string | null };
    if (w.status !== 'approved') return { ok: false, error: 'WOD is not available' };
    if (w.author_id !== trainerUserId) return { ok: false, error: 'WOD not found' };
    try {
      const artist = generatedWodRowToArtist(
        wod as Parameters<typeof generatedWodRowToArtist>[0]
      );
      return { ok: true, assignmentType: 'wod', artist };
    } catch {
      return { ok: false, error: 'WOD could not be loaded' };
    }
  }

  return { ok: false, error: 'Unknown assignment type' };
}
