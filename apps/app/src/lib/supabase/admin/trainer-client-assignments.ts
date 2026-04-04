/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * P1: Coach assignments (programs, workouts, WODs) for Performance Lab + client HUD.
 */

import type { Artist, Exercise, WorkoutDetail } from '@/types';
import type { WorkoutSetTemplate } from '@/types/ai-workout';
import { getSupabaseServer } from '@/lib/supabase/server';
import { isUserInViewerRoster } from '@/lib/supabase/admin/trainer-roster';
import { supabaseWorkoutRowToArtist } from '@/lib/coach-assignment-map';
import {
  workoutRowToWorkoutSetTemplate,
  wodWorkoutDetailToWorkoutSetTemplate,
} from '@/lib/coach-assignment-workout-set';
import { getGeneratedExerciseBySlug } from '@/lib/supabase/public/generated-exercise-service';
import { grantChallengeAccess } from '@/lib/supabase/server/entitlements';

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

export type CoachAssignmentType = 'program' | 'workout' | 'wod' | 'exercise' | 'challenge';

export interface CoachAssignmentListItem {
  id: string;
  assignmentType: CoachAssignmentType;
  /** UUID resource for program/workout/wod; empty string for exercise assignments. */
  resourceId: string;
  titleSnapshot: string;
  assignedAt: string;
  startsOn: string | null;
  expiresOn: string | null;
  exerciseSlug?: string | null;
  coachNote?: string | null;
  dueOn?: string | null;
}

export interface ClientCoachAssignmentApiRow extends CoachAssignmentListItem {
  action: 'set_program' | 'open_workout' | 'open_exercise' | 'open_challenge';
  programId?: string;
  href?: string;
}

const DEFAULT_WOD_IMAGE = '/images/outdoor-calisthenics-workout-001.jpg';

function normalizeType(raw: string): CoachAssignmentType | null {
  const t = raw.trim().toLowerCase();
  if (t === 'program' || t === 'workout' || t === 'wod' || t === 'exercise' || t === 'challenge')
    return t;
  return null;
}

function normalizeExerciseSlug(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s || s.length > 200) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) return null;
  return s;
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
      'id, assignment_type, resource_id, title_snapshot, assigned_at, starts_on, expires_on, revoked_at, exercise_slug, coach_note, due_on'
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
    .filter((row) => {
      const t = row.assignment_type as string;
      if (!t) return false;
      if (t === 'exercise')
        return typeof row.exercise_slug === 'string' && row.exercise_slug.trim() !== '';
      return typeof row.resource_id === 'string' && row.resource_id.length > 0;
    })
    .map((row) => ({
      id: row.id as string,
      assignmentType: row.assignment_type as CoachAssignmentType,
      resourceId:
        row.assignment_type === 'exercise'
          ? ''
          : typeof row.resource_id === 'string'
            ? row.resource_id
            : '',
      titleSnapshot: typeof row.title_snapshot === 'string' ? row.title_snapshot : 'Untitled',
      assignedAt: row.assigned_at as string,
      startsOn: row.starts_on != null ? String(row.starts_on) : null,
      expiresOn: row.expires_on != null ? String(row.expires_on) : null,
      exerciseSlug:
        row.assignment_type === 'exercise' && typeof row.exercise_slug === 'string'
          ? row.exercise_slug
          : null,
      coachNote: typeof row.coach_note === 'string' ? row.coach_note : null,
      dueOn: row.due_on != null ? String(row.due_on) : null,
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

  if (type === 'challenge') {
    const { data, error } = await supabase
      .from('challenges')
      .select('id, title, author_id, status')
      .eq('id', resourceId)
      .maybeSingle();
    if (error || !data) return { ok: false, error: 'Challenge not found' };
    const ch = data as { author_id?: string; status?: string; title?: string };
    if (ch.author_id !== viewerId) return { ok: false, error: 'Challenge not owned by you' };
    if (ch.status !== 'published') {
      return { ok: false, error: 'Challenge must be published before assigning' };
    }
    const title = typeof ch.title === 'string' && ch.title.trim() ? ch.title.trim() : 'Challenge';
    return { ok: true, title };
  }

  if (type === 'wod') {
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
    if (row.status !== 'approved')
      return { ok: false, error: 'WOD must be approved before assigning' };
    const title =
      (typeof row.name === 'string' && row.name.trim()) ||
      (typeof row.title === 'string' && row.title.trim()) ||
      'WOD';
    return { ok: true, title };
  }

  return { ok: false, error: 'Invalid assignment type' };
}

async function validateExerciseSlugForAssign(
  slug: string
): Promise<{ ok: true; title: string } | { ok: false; error: string }> {
  try {
    const ex = await getGeneratedExerciseBySlug(slug, true);
    if (!ex) return { ok: false, error: 'Exercise not found or not approved' };
    const title =
      typeof ex.exerciseName === 'string' && ex.exerciseName.trim() ? ex.exerciseName.trim() : slug;
    return { ok: true, title };
  } catch {
    return { ok: false, error: 'Failed to validate exercise' };
  }
}

export async function createClientCoachAssignment(
  viewerId: string,
  clientUserId: string,
  viewerRole: string,
  body: {
    assignmentType: string;
    resourceId?: string;
    exerciseSlug?: string;
    coachNote?: string | null;
    dueOn?: string | null;
    startsOn?: string | null;
    expiresOn?: string | null;
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const allowed = await isUserInViewerRoster(viewerId, viewerRole, clientUserId);
  if (!allowed) return { ok: false, error: 'Client not found or not in your roster' };

  const type = normalizeType(body.assignmentType);
  if (!type) return { ok: false, error: 'Invalid assignmentType' };

  let validated: { ok: true; title: string } | { ok: false; error: string };
  let resourceId: string | null = null;
  let exerciseSlug: string | null = null;
  const coachNote =
    typeof body.coachNote === 'string' && body.coachNote.trim() ? body.coachNote.trim() : null;
  const dueOn =
    typeof body.dueOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dueOn.trim())
      ? body.dueOn.trim()
      : null;

  if (type === 'exercise') {
    const slug = normalizeExerciseSlug(body.exerciseSlug ?? '');
    if (!slug)
      return {
        ok: false,
        error: 'Valid exerciseSlug required (lowercase letters, numbers, hyphens)',
      };
    validated = await validateExerciseSlugForAssign(slug);
    if (!validated.ok) return validated;
    exerciseSlug = slug;
  } else {
    const rid = body.resourceId?.trim();
    if (!rid) return { ok: false, error: 'resourceId required' };
    resourceId = rid;
    validated = await fetchTitleAndValidateResource(viewerId, type, resourceId);
    if (!validated.ok) return validated;
  }

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
      resource_id: type === 'exercise' ? null : resourceId,
      exercise_slug: type === 'exercise' ? exerciseSlug : null,
      coach_note: type === 'exercise' ? coachNote : null,
      due_on: type === 'exercise' ? dueOn : null,
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

  const newAssignmentId = inserted.id as string;

  // Grant after insert so a failed insert never leaves user_challenges without this assignment row.
  if (type === 'challenge' && resourceId) {
    try {
      await grantChallengeAccess(clientUserId, resourceId);
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[trainer-client-assignments] grantChallengeAccess', e);
      await supabase.from('client_coach_assignments').delete().eq('id', newAssignmentId);
      return { ok: false, error: 'Failed to grant challenge access' };
    }
  }

  // Trainer library: mark workout as delivered to at least one client (private lifecycle; not SEO).
  if (type === 'workout' && resourceId) {
    const { error: visErr } = await supabase
      .from('workouts')
      .update({ visibility: 'assigned' })
      .eq('id', resourceId)
      .eq('trainer_id', viewerId);
    if (visErr && import.meta.env.DEV) {
      console.warn('[trainer-client-assignments] workout visibility update', visErr);
    }
  }

  return { ok: true, id: newAssignmentId };
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
      'id, assignment_type, resource_id, title_snapshot, assigned_at, starts_on, expires_on, dismissed_at, revoked_at, exercise_slug, coach_note, due_on'
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
    const resourceId =
      typeof row.resource_id === 'string' && row.resource_id ? row.resource_id : '';
    const slug =
      assignmentType === 'exercise' && typeof row.exercise_slug === 'string'
        ? row.exercise_slug.trim()
        : '';
    if (assignmentType === 'exercise' && !slug) continue;

    const base: CoachAssignmentListItem = {
      id,
      assignmentType,
      resourceId: assignmentType === 'exercise' ? '' : resourceId,
      titleSnapshot: typeof row.title_snapshot === 'string' ? row.title_snapshot : 'Untitled',
      assignedAt: row.assigned_at as string,
      startsOn: row.starts_on != null ? String(row.starts_on) : null,
      expiresOn,
      exerciseSlug: assignmentType === 'exercise' ? slug : null,
      coachNote: typeof row.coach_note === 'string' ? row.coach_note : null,
      dueOn: row.due_on != null ? String(row.due_on) : null,
    };

    if (assignmentType === 'program') {
      out.push({
        ...base,
        action: 'set_program',
        programId: resourceId,
      });
    } else if (assignmentType === 'exercise') {
      out.push({
        ...base,
        action: 'open_exercise',
        href: `/exercises/${encodeURIComponent(slug)}/learn`,
      });
    } else if (assignmentType === 'challenge') {
      out.push({
        ...base,
        action: 'open_challenge',
        href: `/challenges/${encodeURIComponent(resourceId)}`,
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
  const r = row as {
    client_user_id?: string;
    revoked_at?: string | null;
    dismissed_at?: string | null;
  };
  if (r.client_user_id !== clientUserId) return { ok: false, error: 'Assignment not found' };
  if (r.revoked_at) return { ok: false, error: 'Assignment is no longer active' };
  if (r.dismissed_at) return { ok: false, error: 'Assignment already dismissed' };

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
  | {
      ok: true;
      assignmentType: 'workout' | 'wod';
      artist: Artist;
      assignmentId: string;
      resourceId: string;
      workoutSet: WorkoutSetTemplate;
    }
  | { ok: true; assignmentType: 'exercise'; slug: string; title: string; href: string }
  | { ok: true; assignmentType: 'challenge'; challengeId: string; title: string; href: string }
  | { ok: false; error: string };

export async function getCoachAssignmentPayloadForClient(
  clientUserId: string,
  assignmentId: string
): Promise<CoachAssignmentPayloadResult> {
  const supabase = getSupabaseServer();
  const { data: row, error } = await supabase
    .from('client_coach_assignments')
    .select(
      'id, client_user_id, trainer_user_id, assignment_type, resource_id, title_snapshot, dismissed_at, revoked_at, expires_on, exercise_slug'
    )
    .eq('id', assignmentId)
    .maybeSingle();

  if (error || !row) return { ok: false, error: 'Assignment not found' };
  const r = row as {
    id?: string;
    client_user_id?: string;
    trainer_user_id?: string;
    assignment_type?: string;
    resource_id?: string;
    title_snapshot?: string;
    dismissed_at?: string | null;
    revoked_at?: string | null;
    expires_on?: string | null;
  };
  const assignmentRowId =
    typeof r.id === 'string' && r.id.trim() ? r.id.trim() : assignmentId.trim();
  if (r.client_user_id !== clientUserId) return { ok: false, error: 'Assignment not found' };
  if (r.revoked_at || r.dismissed_at) return { ok: false, error: 'Assignment is not available' };
  if (isExpired(r.expires_on != null ? String(r.expires_on) : null)) {
    return { ok: false, error: 'Assignment has expired' };
  }

  const trainerUserId = typeof r.trainer_user_id === 'string' ? r.trainer_user_id : '';
  if (!trainerUserId) return { ok: false, error: 'Assignment not found' };

  const assignmentType = r.assignment_type as CoachAssignmentType;
  const resourceId = typeof r.resource_id === 'string' ? r.resource_id : '';
  const title =
    typeof r.title_snapshot === 'string' && r.title_snapshot.trim()
      ? r.title_snapshot.trim()
      : 'Assignment';

  // Defense-in-depth: service role bypasses RLS — require resource owner to match assignment trainer
  // so poisoned rows (e.g. from a compromised JWT path) cannot leak other trainers' content.

  if (assignmentType === 'exercise') {
    const slug =
      typeof (r as { exercise_slug?: string }).exercise_slug === 'string'
        ? (r as { exercise_slug: string }).exercise_slug.trim()
        : '';
    if (!slug) return { ok: false, error: 'Assignment not found' };
    const ex = await validateExerciseSlugForAssign(slug);
    if (!ex.ok) return { ok: false, error: ex.error };
    return {
      ok: true,
      assignmentType: 'exercise',
      slug,
      title: ex.title,
      href: `/exercises/${encodeURIComponent(slug)}/learn`,
    };
  }

  if (assignmentType === 'program') {
    const owns = await assertTrainerOwnsProgramDb(supabase, trainerUserId, resourceId);
    if (!owns) return { ok: false, error: 'Assignment not found' };
    return { ok: true, assignmentType: 'program', programId: resourceId, title };
  }

  if (assignmentType === 'challenge') {
    if (!resourceId) return { ok: false, error: 'Assignment not found' };
    const { data: ch, error: chErr } = await supabase
      .from('challenges')
      .select('id, author_id, status')
      .eq('id', resourceId)
      .maybeSingle();
    if (chErr || !ch) return { ok: false, error: 'Assignment not found' };
    const crow = ch as { author_id?: string; status?: string };
    if (crow.author_id !== trainerUserId) return { ok: false, error: 'Assignment not found' };
    if (crow.status !== 'published') return { ok: false, error: 'Challenge is not available' };
    return {
      ok: true,
      assignmentType: 'challenge',
      challengeId: resourceId,
      title,
      href: `/challenges/${encodeURIComponent(resourceId)}`,
    };
  }

  if (!resourceId) return { ok: false, error: 'Assignment not found' };

  if (assignmentType === 'workout') {
    const { data: w, error: wErr } = await supabase
      .from('workouts')
      .select('id, title, description, blocks, trainer_id, difficulty_level')
      .eq('id', resourceId)
      .maybeSingle();
    if (wErr || !w) return { ok: false, error: 'Workout not found' };
    const wr = w as { trainer_id?: string };
    if (wr.trainer_id !== trainerUserId) return { ok: false, error: 'Workout not found' };
    try {
      const artist = supabaseWorkoutRowToArtist(
        w as { id: string; title: string; description: string | null; blocks: unknown }
      );
      const workoutSet = workoutRowToWorkoutSetTemplate(
        w as {
          title: string;
          description: string | null;
          blocks: unknown;
          difficulty_level?: string | null;
        }
      );
      return {
        ok: true,
        assignmentType: 'workout',
        artist,
        assignmentId: assignmentRowId,
        resourceId,
        workoutSet,
      };
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
      const artist = generatedWodRowToArtist(wod as Parameters<typeof generatedWodRowToArtist>[0]);
      const wd = artist.workoutDetail;
      if (!wd) throw new Error('WOD detail missing');
      const workoutSet = wodWorkoutDetailToWorkoutSetTemplate(artist.name, artist.description, wd);
      return {
        ok: true,
        assignmentType: 'wod',
        artist,
        assignmentId: assignmentRowId,
        resourceId,
        workoutSet,
      };
    } catch {
      return { ok: false, error: 'WOD could not be loaded' };
    }
  }

  return { ok: false, error: 'Unknown assignment type' };
}

/** Row for Mission Control Client Workouts page (library + assignees). */
export interface TrainerWorkoutOverviewRow {
  id: string;
  title: string;
  source?: string;
  visibility?: 'draft' | 'ready' | 'assigned';
  durationMinutes: number | null;
  createdAt: string | null;
  lineageId: string;
  versionIndex: number;
}

export interface WorkoutAssignmentClientRow {
  assignmentId: string;
  clientUserId: string;
  clientName: string;
  assignedAt: string;
}

function profileDisplayName(p: {
  full_name?: string | null;
  username?: string | null;
  email?: string | null;
  id?: string;
}): string {
  const fn = typeof p.full_name === 'string' ? p.full_name.trim() : '';
  if (fn) return fn;
  const u = typeof p.username === 'string' ? p.username.trim() : '';
  if (u) return u;
  const e = typeof p.email === 'string' ? p.email.trim() : '';
  if (e) return e;
  return typeof p.id === 'string' ? p.id.slice(0, 8) : 'Client';
}

/**
 * Trainer library workouts plus workout-type assignments grouped by `resource_id` (workouts.id).
 * Host role returns empty lists (matches GET /api/trainer/workouts behavior).
 */
export async function fetchTrainerWorkoutClientOverview(
  trainerUserId: string,
  viewerRole: string
): Promise<{
  workouts: TrainerWorkoutOverviewRow[];
  assignmentsByWorkoutId: Record<string, WorkoutAssignmentClientRow[]>;
}> {
  if (viewerRole === 'host') {
    return { workouts: [], assignmentsByWorkoutId: {} };
  }

  const supabase = getSupabaseServer();

  const selectWithLineage =
    'id, title, source, visibility, duration_minutes, created_at, lineage_id, version_index';
  const selectLegacy = 'id, title, source, visibility, duration_minutes, created_at';

  const primary = await supabase
    .from('workouts')
    .select(selectWithLineage)
    .eq('trainer_id', trainerUserId)
    .order('created_at', { ascending: false });

  let wData: unknown[] = primary.data ?? [];

  // If lineage columns are missing (migration not applied yet), fall back so library + assignees still load.
  if (primary.error) {
    if (import.meta.env.DEV) {
      console.warn('[trainer-client-assignments] workout overview (retry without lineage)', primary.error);
    }
    const fallback = await supabase
      .from('workouts')
      .select(selectLegacy)
      .eq('trainer_id', trainerUserId)
      .order('created_at', { ascending: false });

    if (fallback.error) {
      if (import.meta.env.DEV) {
        console.warn('[trainer-client-assignments] workout overview workouts', fallback.error);
      }
      return { workouts: [], assignmentsByWorkoutId: {} };
    }
    wData = fallback.data ?? [];
  }

  const workouts: TrainerWorkoutOverviewRow[] = wData.map((w: unknown) => {
    const row = w as {
      id: string;
      title: string | null;
      source?: string | null;
      visibility?: string | null;
      duration_minutes?: number | null;
      created_at?: string | null;
      lineage_id?: string | null;
      version_index?: number | null;
    };
    const title = typeof row.title === 'string' && row.title.trim() ? row.title.trim() : 'Workout';
    const source = typeof row.source === 'string' && row.source ? row.source : undefined;
    const visibility =
      row.visibility === 'draft' || row.visibility === 'ready' || row.visibility === 'assigned'
        ? row.visibility
        : undefined;
    const durationMinutes =
      typeof row.duration_minutes === 'number' && Number.isFinite(row.duration_minutes)
        ? row.duration_minutes
        : null;
    const lineageId = typeof row.lineage_id === 'string' ? row.lineage_id : row.id;
    const versionIndex =
      typeof row.version_index === 'number' && Number.isFinite(row.version_index)
        ? row.version_index
        : 1;
    return {
      id: row.id,
      title,
      ...(source !== undefined ? { source } : {}),
      ...(visibility !== undefined ? { visibility } : {}),
      durationMinutes,
      createdAt: row.created_at != null ? String(row.created_at) : null,
      lineageId,
      versionIndex,
    };
  });

  const { data: aData, error: aErr } = await supabase
    .from('client_coach_assignments')
    .select('id, client_user_id, resource_id, assigned_at, title_snapshot')
    .eq('trainer_user_id', trainerUserId)
    .eq('assignment_type', 'workout')
    .is('revoked_at', null);

  if (aErr) {
    if (import.meta.env.DEV) console.warn('[trainer-client-assignments] workout overview assignments', aErr);
    return { workouts, assignmentsByWorkoutId: {} };
  }

  const rows = (aData ?? []).filter(
    (r) => typeof (r as { resource_id?: string }).resource_id === 'string'
  ) as Array<{
    id: string;
    client_user_id: string;
    resource_id: string;
    assigned_at: string | null;
  }>;

  const clientIds = [...new Set(rows.map((r) => r.client_user_id).filter(Boolean))];
  const nameById = new Map<string, string>();

  if (clientIds.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, full_name, username, email')
      .in('id', clientIds);
    for (const p of profs ?? []) {
      const row = p as {
        id?: string;
        full_name?: string | null;
        username?: string | null;
        email?: string | null;
      };
      if (typeof row.id === 'string') {
        nameById.set(row.id, profileDisplayName(row));
      }
    }
  }

  const assignmentsByWorkoutId: Record<string, WorkoutAssignmentClientRow[]> = {};

  for (const r of rows) {
    const rid = r.resource_id;
    if (!rid) continue;
    const clientName = nameById.get(r.client_user_id) ?? r.client_user_id.slice(0, 8);
    const entry: WorkoutAssignmentClientRow = {
      assignmentId: r.id,
      clientUserId: r.client_user_id,
      clientName,
      assignedAt: r.assigned_at != null ? String(r.assigned_at) : '',
    };
    if (!assignmentsByWorkoutId[rid]) assignmentsByWorkoutId[rid] = [];
    assignmentsByWorkoutId[rid].push(entry);
  }

  for (const rid of Object.keys(assignmentsByWorkoutId)) {
    assignmentsByWorkoutId[rid].sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
  }

  return { workouts, assignmentsByWorkoutId };
}
