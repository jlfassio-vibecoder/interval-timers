/**
 * Mission Control profile fetch with tiered authorization.
 * Trainers: roster users only. Admin/super_admin: any user. Hosts: own profile only.
 */

import { getSupabaseServer } from '@/lib/supabase/server';
import { fetchTrainerRoster } from './trainer-roster';

/** DTO returned to Mission Control viewers. Omits sensitive fields based on viewer tier. */
export interface MissionControlProfileDto {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  primary_fitness_goal: string | null;
  preferred_hiit_style: string | null;
  injury_limitation_tags: string[] | null;
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
 * - host: own profile only
 * - trainer: roster users only
 * - admin/super_admin: any user
 */
export async function fetchMissionControlProfile(
  callerId: string,
  callerRole: string,
  targetUserId: string
): Promise<MissionControlProfileDto | null> {
  const isAdminElevated = callerRole === 'admin' || callerRole === 'super_admin';
  const isTrainer = callerRole === 'trainer' || isAdminElevated;

  if (callerRole === 'host') {
    if (callerId !== targetUserId) return null;
  } else if (isTrainer && !isAdminElevated) {
    const roster = await fetchTrainerRoster(callerId);
    if (!roster.some((r) => r.id === targetUserId)) return null;
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, email, full_name, avatar_url, role, weekly_goal_minutes, primary_fitness_goal, preferred_hiit_style, injury_limitation_tags, units_system, profile_completed_at, date_of_birth, biological_sex, weight_kg, height_cm, activity_level_baseline, lifestyle_baseline, workout_routine, total_active_multiplier, resting_hr_bpm, max_hr_bpm, created_at'
    )
    .eq('id', targetUserId)
    .maybeSingle();

  if (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.warn('[mission-control-profile]', error);
    }
    return null;
  }
  if (!data) return null;

  const base: MissionControlProfileDto = {
    id: data.id,
    email: data.email ?? null,
    full_name: data.full_name ?? null,
    avatar_url: data.avatar_url ?? null,
    role: data.role ?? 'client',
    primary_fitness_goal: data.primary_fitness_goal ?? null,
    preferred_hiit_style: data.preferred_hiit_style ?? null,
    injury_limitation_tags: Array.isArray(data.injury_limitation_tags)
      ? data.injury_limitation_tags
      : null,
    units_system: data.units_system ?? null,
    weekly_goal_minutes:
      typeof data.weekly_goal_minutes === 'number' ? data.weekly_goal_minutes : null,
    profile_completed_at: data.profile_completed_at ?? null,
  };

  if (isAdminElevated) {
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

  return base;
}
