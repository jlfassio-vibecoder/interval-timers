/**
 * Mission Control profile fetch with tiered authorization.
 * Trainers: roster users only. Admin/super_admin: any user.
 * Hosts: own profile, or accepted buddies on their roster (host_friend_connections).
 */

import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchTrainerRoster, isHostBuddy } from './trainer-roster';
import { userHasTrainerRecord } from './trainer-record';

/** DTO returned to Mission Control viewers. Omits sensitive fields based on viewer tier. */
export interface MissionControlProfileDto {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  primary_fitness_goal: string | null;
  fitness_goal_ranking: string[] | null;
  preferred_hiit_style: string | null;
  preferred_hiit_styles: string[] | null;
  injury_limitation_tags: string[] | null;
  physical_limitations: string[] | null;
  medical_conditions: string[] | null;
  pregnancy_postpartum: string[] | null;
  units_system: string | null;
  weekly_goal_minutes: number | null;
  profile_completed_at: string | null;
  /** Extended fields for admin/super_admin only */
  date_of_birth?: string | null;
  biological_sex?: string | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  activity_level_baseline?: string | null;
  lifestyle_baseline?: string | null;
  workout_routine?: string | null;
  total_active_multiplier?: number | null;
  resting_hr_bpm?: number | null;
  max_hr_bpm?: number | null;
  created_at?: string | null;
}

/**
 * Fetch profile for Mission Control viewer. Enforces:
 * - host: own profile or buddy profiles (roster connection)
 * - trainer: roster users only
 * - admin/super_admin: any user
 */
export async function fetchMissionControlProfile(
  callerId: string,
  callerRole: string,
  targetUserId: string
): Promise<MissionControlProfileDto | null> {
  const isAdminElevated = callerRole === 'admin' || callerRole === 'super_admin';
  const hasTrainerRecord = await userHasTrainerRecord(callerId);
  const isTrainer = callerRole === 'trainer' || hasTrainerRecord || isAdminElevated;

  if (callerRole === 'host') {
    if (callerId !== targetUserId) {
      const isBuddy = await isHostBuddy(callerId, targetUserId);
      if (!isBuddy) return null;
    }
  } else if (isTrainer && !isAdminElevated) {
    const roster = await fetchTrainerRoster(callerId);
    if (!roster.some((r) => r.id === targetUserId)) return null;
  }

  const supabase = getSupabaseServer();
  const logError = (err: unknown) => {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.warn('[mission-control-profile]', err);
    }
  };

  const toBaseDto = (row: {
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
    role: string | null;
    primary_fitness_goal: string | null;
    fitness_goal_ranking?: unknown;
    preferred_hiit_style: string | null;
    preferred_hiit_styles: unknown;
    injury_limitation_tags: unknown;
    physical_limitations: unknown;
    medical_conditions: unknown;
    pregnancy_postpartum: unknown;
    units_system: string | null;
    weekly_goal_minutes: number | null;
    profile_completed_at: string | null;
  }): MissionControlProfileDto => ({
    id: row.id,
    email: row.email ?? null,
    full_name: row.full_name ?? null,
    avatar_url: row.avatar_url ?? null,
    role: row.role ?? 'client',
    primary_fitness_goal: row.primary_fitness_goal ?? null,
    fitness_goal_ranking: Array.isArray(row.fitness_goal_ranking) ? row.fitness_goal_ranking : null,
    preferred_hiit_style: row.preferred_hiit_style ?? null,
    preferred_hiit_styles: Array.isArray(row.preferred_hiit_styles)
      ? row.preferred_hiit_styles
      : null,
    injury_limitation_tags: Array.isArray(row.injury_limitation_tags)
      ? row.injury_limitation_tags
      : null,
    physical_limitations: Array.isArray(row.physical_limitations) ? row.physical_limitations : null,
    medical_conditions: Array.isArray(row.medical_conditions) ? row.medical_conditions : null,
    pregnancy_postpartum: Array.isArray(row.pregnancy_postpartum) ? row.pregnancy_postpartum : null,
    units_system: row.units_system ?? null,
    weekly_goal_minutes:
      typeof row.weekly_goal_minutes === 'number' ? row.weekly_goal_minutes : null,
    profile_completed_at: row.profile_completed_at ?? null,
  });

  // Separate branches so each .select() list is typed; trainers/hosts do not fetch admin-only columns.
  if (isAdminElevated) {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, email, full_name, avatar_url, role, weekly_goal_minutes, primary_fitness_goal, fitness_goal_ranking, preferred_hiit_style, preferred_hiit_styles, injury_limitation_tags, physical_limitations, medical_conditions, pregnancy_postpartum, units_system, profile_completed_at, date_of_birth, biological_sex, weight_kg, height_cm, activity_level_baseline, lifestyle_baseline, workout_routine, total_active_multiplier, resting_hr_bpm, max_hr_bpm, created_at'
      )
      .eq('id', targetUserId)
      .maybeSingle();

    if (error) {
      logError(error);
      return null;
    }
    if (!data) return null;

    const base = toBaseDto(data);
    return {
      ...base,
      date_of_birth: data.date_of_birth ?? null,
      biological_sex: data.biological_sex ?? null,
      weight_kg: data.weight_kg != null ? Number(data.weight_kg) : null,
      height_cm: data.height_cm != null ? Number(data.height_cm) : null,
      activity_level_baseline: data.activity_level_baseline ?? null,
      lifestyle_baseline: data.lifestyle_baseline ?? null,
      workout_routine: data.workout_routine ?? null,
      total_active_multiplier:
        data.total_active_multiplier != null ? Number(data.total_active_multiplier) : null,
      resting_hr_bpm: data.resting_hr_bpm != null ? Number(data.resting_hr_bpm) : null,
      max_hr_bpm: data.max_hr_bpm != null ? Number(data.max_hr_bpm) : null,
      created_at: data.created_at ?? null,
    };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, email, full_name, avatar_url, role, weekly_goal_minutes, primary_fitness_goal, fitness_goal_ranking, preferred_hiit_style, preferred_hiit_styles, injury_limitation_tags, physical_limitations, medical_conditions, pregnancy_postpartum, units_system, profile_completed_at'
    )
    .eq('id', targetUserId)
    .maybeSingle();

  if (error) {
    logError(error);
    return null;
  }
  if (!data) return null;

  return toBaseDto(data);
}
