/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Server-side statistics using Supabase. Replaces firebase/admin/statistics
 * for dashboard stats and admin users list.
 */

import type { UserProfile } from '@/types';
import type { WorkoutLog } from '@/types';
import { getSupabaseServer } from '../server';

/**
 * Fetch all users from profiles (server-side).
 */
export async function getAllUsersServer(): Promise<UserProfile[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, role, purchased_index, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[getAllUsersServer] Error fetching profiles:', error);
    }
    throw error;
  }

  return (data ?? []).map((row) => ({
    uid: row.id,
    email: row.email ?? null,
    displayName: row.full_name ?? undefined,
    role: row.role as UserProfile['role'],
    purchasedIndex: row.purchased_index ?? undefined,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : typeof row.created_at === 'string'
          ? row.created_at
          : new Date().toISOString(),
    avatarUrl: row.avatar_url ?? undefined,
  })) as UserProfile[];
}

/**
 * Fetch all users for admin display. Supabase does not expose providerIds/emailVerified/customClaims
 * like Firebase Auth; we return profiles only (same shape, those fields will be undefined).
 */
export async function getAllUsersWithAuthServer(): Promise<UserProfile[]> {
  return getAllUsersServer();
}

/**
 * Fetch all workout logs from workout_logs (server-side).
 */
export async function getAllLogsServer(): Promise<WorkoutLog[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('workout_logs')
    .select('id, user_id, workout_id, workout_name, date, effort, rating, notes')
    .order('date', { ascending: false });

  if (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[getAllLogsServer] Error fetching workout_logs:', error);
    }
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    workoutId: row.workout_id ?? undefined,
    workoutName: row.workout_name,
    date:
      typeof row.date === 'string'
        ? row.date
        : ((row.date as unknown as Date)?.toISOString?.()?.slice(0, 10) ?? String(row.date)),
    effort: row.effort,
    rating: row.rating,
    notes: row.notes ?? '',
  })) as WorkoutLog[];
}

/**
 * Fetch all programs (id + createdAt) for dashboard count.
 */
export async function getAllProgramsServer(): Promise<
  Array<{ id: string; createdAt?: Date | string }>
> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.from('programs').select('id, created_at');

  if (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[getAllProgramsServer] Error fetching programs:', error);
    }
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at
        : typeof row.created_at === 'string'
          ? row.created_at
          : undefined,
  }));
}

function calculateGrowthRate(users: UserProfile[]): number | null {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const recentUsers = users.filter((user) => {
    try {
      const createdAt = new Date(user.createdAt);
      if (isNaN(createdAt.getTime())) return false;
      return createdAt >= thirtyDaysAgo && createdAt < now;
    } catch {
      return false;
    }
  });

  const previousUsers = users.filter((user) => {
    try {
      const createdAt = new Date(user.createdAt);
      if (isNaN(createdAt.getTime())) return false;
      return createdAt >= sixtyDaysAgo && createdAt < thirtyDaysAgo;
    } catch {
      return false;
    }
  });

  if (previousUsers.length === 0) {
    return recentUsers.length > 0 ? 100 : null;
  }

  const growth = ((recentUsers.length - previousUsers.length) / previousUsers.length) * 100;
  return Math.round(growth * 10) / 10;
}

export interface DashboardStats {
  totalUsers: number;
  totalPrograms: number;
  totalWorkoutsLogged: number;
  growthRate: number | null;
  recentActivity: Array<{
    id: string;
    userId: string;
    userEmail: string | null;
    workoutName: string;
    date: string;
    effort: number;
    rating: number;
  }>;
}

const STATS_TIMEOUT_MS = 10_000;

export async function getDashboardStats(): Promise<DashboardStats> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('STATS_TIMEOUT')), STATS_TIMEOUT_MS);
  });

  try {
    const [users, programs, logs] = await Promise.all([
      Promise.race([getAllUsersServer(), timeout]),
      Promise.race([getAllProgramsServer(), timeout]),
      Promise.race([getAllLogsServer(), timeout]),
    ]);
    clearTimeout(timeoutId);

    const growthRate = calculateGrowthRate(users);
    const recentLogs = logs.slice(0, 20);
    const userEmailMap = new Map<string, string | null>();
    users.forEach((user) => userEmailMap.set(user.uid, user.email));

    const recentActivity = recentLogs.map((log) => ({
      id: log.id ?? '',
      userId: log.userId,
      userEmail: userEmailMap.get(log.userId) ?? null,
      workoutName: log.workoutName,
      date: log.date,
      effort: log.effort,
      rating: log.rating,
    }));

    return {
      totalUsers: users.length,
      totalPrograms: programs.length,
      totalWorkoutsLogged: logs.length,
      growthRate,
      recentActivity,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[getDashboardStats] Error fetching dashboard statistics:', error);
    }
    throw error;
  }
}
