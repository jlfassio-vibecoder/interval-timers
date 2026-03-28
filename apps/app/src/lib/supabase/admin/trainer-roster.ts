/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Trainer roster and stats: fetch trainer's clients (from user_programs + programs)
 * and workout stats. Uses server Supabase client to bypass RLS.
 */

import { getSupabaseServer } from '@/lib/supabase/server';
import { averageAlignmentComposite } from '@/lib/fitness-goal-alignment';
import type { WorkoutLog } from '@/types';

export interface RosterItem {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  programIds: string[];
  /** Present for Mission Control roster; distinguishes program clients vs host buddies. */
  relationship?: 'client' | 'friend';
}

/**
 * Fetch distinct clients (profiles) who are enrolled in any of the trainer's programs.
 * Uses Supabase server client (service role when available) to bypass RLS.
 * Returns [] on any error or when roster is empty (dev/MVP friendly).
 */
export async function fetchTrainerRoster(trainerId: string): Promise<RosterItem[]> {
  try {
    const supabase = getSupabaseServer();

    const { data: programs, error: programsError } = await supabase
      .from('programs')
      .select('id')
      .eq('trainer_id', trainerId);

    if (programsError) {
      if (import.meta.env.DEV) console.warn('[trainer-roster] programs error:', programsError);
      return [];
    }
    if (!programs?.length) return [];

    const programIds = programs.map((p) => p.id);

    const { data: enrollments, error: enrollError } = await supabase
      .from('user_programs')
      .select('user_id, program_id')
      .in('program_id', programIds);

    if (enrollError) {
      if (import.meta.env.DEV) console.warn('[trainer-roster] user_programs error:', enrollError);
      return [];
    }
    if (!enrollments?.length) return [];

    const userIds = [...new Set(enrollments.map((e) => e.user_id))];

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name, created_at')
      .in('id', userIds)
      .order('full_name', { ascending: true });

    if (profilesError) {
      if (import.meta.env.DEV) console.warn('[trainer-roster] profiles error:', profilesError);
      return [];
    }
    if (!profiles?.length) return [];

    const programIdsByUser = new Map<string, string[]>();
    for (const e of enrollments) {
      const list = programIdsByUser.get(e.user_id) ?? [];
      if (!list.includes(e.program_id)) list.push(e.program_id);
      programIdsByUser.set(e.user_id, list);
    }

    return profiles.map((p) => ({
      id: p.id,
      email: p.email ?? null,
      full_name: p.full_name ?? null,
      created_at: p.created_at ?? new Date().toISOString(),
      programIds: programIdsByUser.get(p.id) ?? [],
      relationship: 'client' as const,
    }));
  } catch (err) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[trainer-roster] fetchTrainerRoster error:', err);
    }
    return [];
  }
}

/**
 * Host buddy roster from host_friend_connections.
 */
export async function fetchHostRoster(hostId: string): Promise<RosterItem[]> {
  try {
    const supabase = getSupabaseServer();
    const { data: rows, error } = await supabase
      .from('host_friend_connections')
      .select('buddy_user_id, created_at')
      .eq('host_id', hostId)
      .order('created_at', { ascending: false });

    if (error) {
      if (import.meta.env.DEV)
        console.warn('[trainer-roster] host_friend_connections error:', error);
      return [];
    }
    if (!rows?.length) return [];

    const buddyIds = rows.map((r) => r.buddy_user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name, created_at')
      .in('id', buddyIds)
      .order('full_name', { ascending: true });

    if (profilesError) {
      if (import.meta.env.DEV)
        console.warn('[trainer-roster] host roster profiles error:', profilesError);
      return [];
    }
    if (!profiles?.length) return [];

    const joinedAtByBuddy = new Map(rows.map((r) => [r.buddy_user_id, r.created_at]));

    return profiles.map((p) => ({
      id: p.id,
      email: p.email ?? null,
      full_name: p.full_name ?? null,
      created_at: joinedAtByBuddy.get(p.id) ?? p.created_at ?? new Date().toISOString(),
      programIds: [],
      relationship: 'friend' as const,
    }));
  } catch (err) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[trainer-roster] fetchHostRoster error:', err);
    }
    return [];
  }
}

/** Mission Control roster: host sees buddies; trainer/admin see program clients. */
export async function fetchRosterForMissionControlUser(
  uid: string,
  role: string
): Promise<RosterItem[]> {
  if (role === 'host') return fetchHostRoster(uid);
  return fetchTrainerRoster(uid);
}

/** True if host has an accepted buddy link to the target user. */
export async function isHostBuddy(hostId: string, buddyUserId: string): Promise<boolean> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('host_friend_connections')
    .select('host_id')
    .eq('host_id', hostId)
    .eq('buddy_user_id', buddyUserId)
    .maybeSingle();
  if (error) {
    if (import.meta.env.DEV) console.warn('[trainer-roster] isHostBuddy error:', error);
    return false;
  }
  return !!data;
}

/**
 * Whether the viewer may access Mission Control stats/profile for the target user
 * (program roster, host buddies, or admin with shared trainer roster).
 */
export async function isUserInViewerRoster(
  viewerId: string,
  viewerRole: string,
  targetUserId: string
): Promise<boolean> {
  if (viewerRole === 'host') {
    if (viewerId === targetUserId) return true;
    return isHostBuddy(viewerId, targetUserId);
  }
  const roster = await fetchTrainerRoster(viewerId);
  return roster.some((r) => r.id === targetUserId);
}

export interface TrainerStats {
  totalClients: number;
  totalWorkoutsLogged: number;
  recentActivity: Array<{
    id: string;
    userId: string;
    userEmail: string | null;
    userName: string | null;
    workoutName: string;
    date: string;
    effort: number;
    rating: number;
  }>;
}

const RECENT_ACTIVITY_LIMIT = 20;

/**
 * Aggregate stats for trainer's roster: total clients, total workouts, recent activity.
 */
export async function fetchTrainerStats(trainerId: string): Promise<TrainerStats> {
  return fetchMissionControlRosterStats(trainerId, 'trainer');
}

/** Intel / aggregate stats for whoever the viewer’s roster is (trainer programs or host buddies). */
export async function fetchMissionControlRosterStats(
  viewerId: string,
  viewerRole: string
): Promise<TrainerStats> {
  const roster = await fetchRosterForMissionControlUser(viewerId, viewerRole);
  const totalClients = roster.length;
  if (totalClients === 0) {
    return { totalClients: 0, totalWorkoutsLogged: 0, recentActivity: [] };
  }

  const supabase = getSupabaseServer();
  const userIds = roster.map((r) => r.id);
  const profileByUserId = new Map(roster.map((r) => [r.id, r]));

  const { data: logs, error: logsError } = await supabase
    .from('workout_logs')
    .select('id, user_id, workout_name, date, effort, rating')
    .in('user_id', userIds)
    .order('date', { ascending: false })
    .limit(500);

  if (logsError) throw logsError;
  const allLogs = logs ?? [];
  const totalWorkoutsLogged = allLogs.length;

  const recentLogs = allLogs.slice(0, RECENT_ACTIVITY_LIMIT);
  const recentActivity = recentLogs.map((log) => {
    const p = profileByUserId.get(log.user_id);
    return {
      id: log.id,
      userId: log.user_id,
      userEmail: p?.email ?? null,
      userName: p?.full_name ?? null,
      workoutName: log.workout_name,
      date: log.date,
      effort: log.effort,
      rating: log.rating,
    };
  });

  return {
    totalClients,
    totalWorkoutsLogged,
    recentActivity,
  };
}

export interface ClientStats {
  userId: string;
  email: string | null;
  full_name: string | null;
  totalWorkouts: number;
  avgEffort: number | null;
  avgRating: number | null;
  logs: Array<{
    id: string;
    workoutName: string;
    date: string;
    effort: number;
    rating: number;
    durationSeconds?: number | null;
    workoutType?: string | null;
    workoutFormat?: string | null;
    intensity?: string | null;
    isActiveRest?: boolean | null;
    goalSnapshot?: string[] | null;
  }>;
  alignmentAverage: number | null;
  alignmentScoredSessions: number;
}

/**
 * Per-member stats. Verifies the user is on the viewer’s roster (trainer programs or host buddies).
 */
export async function fetchClientStats(
  viewerId: string,
  userId: string,
  viewerRole: string = 'trainer'
): Promise<ClientStats | null> {
  const allowed = await isUserInViewerRoster(viewerId, viewerRole, userId);
  if (!allowed) return null;

  const supabase = getSupabaseServer();
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('id', userId)
    .maybeSingle();
  const client = {
    id: userId,
    email: profileRow?.email ?? null,
    full_name: profileRow?.full_name ?? null,
  };

  const { data: logs, error } = await supabase
    .from('workout_logs')
    .select(
      'id, workout_name, date, effort, rating, notes, duration_seconds, workout_type, workout_format, intensity, is_active_rest, goal_snapshot'
    )
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) throw error;
  const logList = logs ?? [];

  let avgEffort: number | null = null;
  let avgRating: number | null = null;
  if (logList.length > 0) {
    avgEffort = logList.reduce((sum, l) => sum + l.effort, 0) / logList.length;
    avgRating = logList.reduce((sum, l) => sum + l.rating, 0) / logList.length;
  }

  const alignmentInputLogs: WorkoutLog[] = logList.map((l) => ({
    id: l.id,
    userId,
    workoutName: l.workout_name,
    date: l.date,
    effort: l.effort,
    rating: l.rating,
    notes: l.notes ?? '',
    durationSeconds: l.duration_seconds ?? null,
    workoutType: l.workout_type ?? null,
    workoutFormat: l.workout_format ?? null,
    intensity: l.intensity ?? null,
    isActiveRest: l.is_active_rest ?? null,
    goalSnapshot: l.goal_snapshot ?? null,
  }));
  const alignmentAverageStats = averageAlignmentComposite(alignmentInputLogs);

  return {
    userId: client.id,
    email: client.email,
    full_name: client.full_name,
    totalWorkouts: logList.length,
    avgEffort,
    avgRating,
    logs: logList.map((l) => ({
      id: l.id,
      workoutName: l.workout_name,
      date: l.date,
      effort: l.effort,
      rating: l.rating,
      durationSeconds: l.duration_seconds ?? null,
      workoutType: l.workout_type ?? null,
      workoutFormat: l.workout_format ?? null,
      intensity: l.intensity ?? null,
      isActiveRest: l.is_active_rest ?? null,
      goalSnapshot: l.goal_snapshot ?? null,
    })),
    alignmentAverage: alignmentAverageStats.averageComposite,
    alignmentScoredSessions: alignmentAverageStats.scoredSessions,
  };
}
