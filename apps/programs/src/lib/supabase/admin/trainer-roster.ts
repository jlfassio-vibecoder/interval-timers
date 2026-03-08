/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Trainer roster and stats: fetch trainer's clients (from user_programs + programs)
 * and workout stats. Uses server Supabase client to bypass RLS.
 */

import { getSupabaseServer } from '@/lib/supabase/server';

export interface RosterItem {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  programIds: string[];
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
    }));
  } catch (err) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[trainer-roster] fetchTrainerRoster error:', err);
    }
    return [];
  }
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
  const roster = await fetchTrainerRoster(trainerId);
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
  }>;
}

/**
 * Per-client stats. Verifies the user is in the trainer's roster before returning.
 */
export async function fetchClientStats(
  trainerId: string,
  userId: string
): Promise<ClientStats | null> {
  const roster = await fetchTrainerRoster(trainerId);
  const client = roster.find((r) => r.id === userId);
  if (!client) return null;

  const supabase = getSupabaseServer();
  const { data: logs, error } = await supabase
    .from('workout_logs')
    .select('id, workout_name, date, effort, rating')
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
    })),
  };
}
