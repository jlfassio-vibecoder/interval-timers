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
    .select(
      'id, email, full_name, avatar_url, role, purchased_index, created_at, last_sign_in_at, sign_in_visit_count, activity_visit_count'
    )
    .order('created_at', { ascending: false });

  if (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[getAllUsersServer] Error fetching profiles:', error);
    }
    throw error;
  }

  return (data ?? []).map((row) => {
    const lastSignInAtRaw = (row as { last_sign_in_at?: Date | string | null }).last_sign_in_at;
    const lastSignInAt =
      lastSignInAtRaw == null
        ? undefined
        : lastSignInAtRaw instanceof Date
          ? lastSignInAtRaw.toISOString()
          : typeof lastSignInAtRaw === 'string'
            ? lastSignInAtRaw
            : undefined;
    const signInVisitCount = (row as { sign_in_visit_count?: number }).sign_in_visit_count ?? 0;
    const activityVisitCount = (row as { activity_visit_count?: number }).activity_visit_count ?? 0;
    return {
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
      lastSignInAt: lastSignInAt ?? null,
      signInVisitCount,
      activityVisitCount,
    };
  }) as UserProfile[];
}

/**
 * Auth metadata from Supabase Auth (auth.admin.listUsers). Used to enrich profiles.
 */
interface AuthUserMeta {
  providerIds: string[];
  emailVerified: boolean;
  lastSignInAt: string | null;
}

/**
 * Fetch auth metadata (provider identities, email_verified) for all users via Auth Admin API.
 * Requires service role. Returns a map of user id -> auth meta; missing ids mean no auth row or error.
 */
async function getAuthUsersMeta(
  supabase: ReturnType<typeof getSupabaseServer>
): Promise<Map<string, AuthUserMeta>> {
  const map = new Map<string, AuthUserMeta>();
  const perPage = 1000;
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
        console.error('[getAuthUsersMeta] Error listing auth users:', error);
      }
      break;
    }
    const users = data?.users ?? [];
    for (const u of users) {
      const providerIds: string[] = [];
      if (Array.isArray((u as { identities?: Array<{ provider?: string }> }).identities)) {
        for (const ident of (u as { identities: Array<{ provider?: string }> }).identities) {
          if (ident?.provider) providerIds.push(ident.provider);
        }
      }
      if (
        providerIds.length === 0 &&
        (u as { app_metadata?: { provider?: string; providers?: string[] } }).app_metadata
      ) {
        const meta = (u as { app_metadata: { provider?: string; providers?: string[] } })
          .app_metadata;
        if (Array.isArray(meta.providers)) providerIds.push(...meta.providers);
        else if (meta.provider) providerIds.push(meta.provider);
      }
      const emailVerified = !!(u as { email_confirmed_at?: string | null }).email_confirmed_at;
      const lastSignInAtRaw = (u as { last_sign_in_at?: string | null }).last_sign_in_at;
      const lastSignInAt = lastSignInAtRaw ?? null;
      map.set(u.id, { providerIds, emailVerified, lastSignInAt });
    }
    hasMore = users.length === perPage;
    page += 1;
  }

  return map;
}

/**
 * Fetch all users for admin display. Enriches profiles with auth provider identities and
 * email_verified from Supabase Auth (requires service role for auth.admin.listUsers).
 */
export async function getAllUsersWithAuthServer(): Promise<UserProfile[]> {
  const profiles = await getAllUsersServer();
  const supabase = getSupabaseServer();

  try {
    const authMeta = await getAuthUsersMeta(supabase);
    return profiles.map((p) => {
      const meta = authMeta.get(p.uid);
      return {
        ...p,
        providerIds: meta?.providerIds.length ? meta.providerIds : undefined,
        emailVerified: meta?.emailVerified ?? undefined,
        lastSignInAt: meta?.lastSignInAt ?? p.lastSignInAt ?? null,
      };
    });
  } catch {
    return profiles;
  }
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
