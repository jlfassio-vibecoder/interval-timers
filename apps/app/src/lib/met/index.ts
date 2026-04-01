/**
 * MET (Metabolic Equivalent of Task) and BMR utilities for Training Log.
 * Enables normalized "Total Work" display (HIIT vs housework).
 *
 * Activity model: TAM (total active multiplier) = lifestyle (daily PAL) + workout (EAT modifier).
 */

import type { UserProfile, WorkoutLog } from '@/types';

/** Cap for TAM = lifestyle + workout modifier */
export const TAM_MAX = 2.5;

export const LIFESTYLE_BASELINE_IDS = [
  'sedentary',
  'low_active',
  'active',
  'highly_active',
] as const;
export type LifestyleBaselineId = (typeof LIFESTYLE_BASELINE_IDS)[number];

export const WORKOUT_ROUTINE_IDS = ['none', 'light', 'moderate', 'hard', 'pro'] as const;
export type WorkoutRoutineId = (typeof WORKOUT_ROUTINE_IDS)[number];

export interface ProfileBaseline {
  dateOfBirth?: string | null;
  biologicalSex?: string | null;
  weightKg?: number | null;
  heightCm?: number | null;
  /** @deprecated Prefer lifestyleBaseline + workoutRoutine + totalActiveMultiplier */
  activityLevelBaseline?: string | null;
  lifestyleBaseline?: string | null;
  workoutRoutine?: string | null;
  /** Persisted TAM; when set, preferred for TDEE if lifestyle/workout absent */
  totalActiveMultiplier?: number | null;
}

/**
 * Daily routine (lifestyle) multipliers — baseline before intentional exercise.
 */
export function getLifestyleMultiplier(id: string | null | undefined): number {
  switch (String(id ?? '').toLowerCase()) {
    case 'sedentary':
      return 1.2;
    case 'low_active':
      return 1.35;
    case 'active':
      return 1.55;
    case 'highly_active':
      return 1.75;
    default:
      return 1.2;
  }
}

/**
 * Workout routine (EAT) additive modifier on top of lifestyle.
 */
export function getWorkoutModifier(id: string | null | undefined): number {
  switch (String(id ?? 'none').toLowerCase()) {
    case 'none':
      return 0;
    case 'light':
      return 0.15;
    case 'moderate':
      return 0.25;
    case 'hard':
      return 0.4;
    case 'pro':
      return 0.55;
    default:
      return 0;
  }
}

/**
 * Total active multiplier: lifestyle PAL + EAT modifier, capped at TAM_MAX.
 */
export function computeTotalActiveMultiplier(
  lifestyleId?: string | null,
  workoutId?: string | null
): number {
  const raw = getLifestyleMultiplier(lifestyleId) + getWorkoutModifier(workoutId);
  return Math.min(TAM_MAX, Math.round(raw * 100) / 100);
}

/**
 * Map legacy activity_level_baseline enum to lifestyle_baseline id.
 */
export function lifestyleBaselineFromLegacyActivity(activityLevel?: string | null): string {
  switch (String(activityLevel ?? '').toLowerCase()) {
    case 'sedentary':
      return 'sedentary';
    case 'lightly_active':
      return 'low_active';
    case 'moderately_active':
      return 'active';
    case 'very_active':
      return 'highly_active';
    default:
      return '';
  }
}

/**
 * Map lifestyle_baseline id to legacy activity_level_baseline for DB compatibility.
 */
export function legacyActivityLevelFromLifestyle(lifestyleId?: string | null): string {
  switch (String(lifestyleId ?? '').toLowerCase()) {
    case 'sedentary':
      return 'sedentary';
    case 'low_active':
      return 'lightly_active';
    case 'active':
      return 'moderately_active';
    case 'highly_active':
      return 'very_active';
    default:
      return 'sedentary';
  }
}

/**
 * Mifflin-St Jeor BMR formula (kcal/day).
 * Requires: biologicalSex, weightKg, heightCm, age (or dateOfBirth to compute age).
 */
export function computeBMR(baseline: ProfileBaseline): number | null {
  const { biologicalSex, weightKg, heightCm, dateOfBirth } = baseline;
  if (weightKg == null || weightKg <= 0 || heightCm == null || heightCm <= 0 || !biologicalSex) {
    return null;
  }
  const age = dateOfBirth ? getAgeYears(dateOfBirth) : null;
  if (age == null || age < 10 || age > 120) return null;

  const sex = String(biologicalSex).toLowerCase();
  if (sex === 'male') {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  }
  if (sex === 'female') {
    return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  }
  return null;
}

/**
 * Activity multiplier for TDEE from legacy single-field enum (pre–bimodal model).
 */
export function getActivityMultiplier(activityLevel?: string | null): number {
  switch (String(activityLevel ?? '').toLowerCase()) {
    case 'sedentary':
      return 1.2;
    case 'lightly_active':
      return 1.375;
    case 'moderately_active':
      return 1.55;
    case 'very_active':
      return 1.9;
    default:
      return 1.375;
  }
}

/**
 * Effective TAM for TDEE: stored value, or computed from lifestyle + workout, or legacy activity field.
 */
export function resolveTotalActiveMultiplier(baseline: ProfileBaseline): number {
  const stored = baseline.totalActiveMultiplier;
  if (stored != null && Number.isFinite(stored) && stored > 0) {
    return Math.min(TAM_MAX, stored);
  }
  const lifestyle = baseline.lifestyleBaseline;
  const workout = baseline.workoutRoutine;
  const hasBimodal = (lifestyle != null && lifestyle !== '') || (workout != null && workout !== '');
  if (hasBimodal) {
    return computeTotalActiveMultiplier(
      lifestyle && lifestyle !== '' ? lifestyle : 'sedentary',
      workout && workout !== '' ? workout : 'none'
    );
  }
  const legacyActivity = Reflect.get(baseline, 'activityLevelBaseline') as string | null | undefined;
  return getActivityMultiplier(legacyActivity);
}

/**
 * Estimated TDEE (Total Daily Energy Expenditure) in kcal/day using TAM.
 */
export function computeTDEE(baseline: ProfileBaseline): number | null {
  const bmr = computeBMR(baseline);
  if (bmr == null) return null;
  return bmr * resolveTotalActiveMultiplier(baseline);
}

/**
 * MET value for common activities (simplified; real MET tables are more granular).
 */
export const MET_VALUES: Record<string, number> = {
  hiit: 8,
  tabata: 8,
  amrap: 7.5,
  emom: 7,
  circuit: 7,
  strength: 6,
  resistance_training: 6,
  swimming_moderate: 7,
  housework: 3,
  walking: 3.5,
  running_moderate: 8,
  cycling_moderate: 6,
  mobility: 3,
};

/**
 * Estimated calorie burn for duration (minutes) at given MET.
 * Formula: kcal = MET * weight_kg * (duration_min / 60).
 *
 * Training Log stores subjective intensity as `effort` (1–10), analogous to RPE; a future
 * refinement can scale MET or kcal from effort without a separate DB column.
 */
export function estimateCalorieBurn(
  met: number,
  weightKg: number,
  durationMinutes: number
): number {
  if (weightKg <= 0 || durationMinutes <= 0) return 0;
  return met * weightKg * (durationMinutes / 60);
}

/**
 * Infer MET from workout source/type for Training Log.
 */
export function inferMETFromWorkout(source?: string | null, workoutFormat?: string | null): number {
  const s = String(source ?? workoutFormat ?? '').toLowerCase();
  if (s.includes('tabata')) return MET_VALUES.tabata;
  if (s.includes('amrap')) return MET_VALUES.amrap;
  if (s.includes('emom')) return MET_VALUES.emom;
  if (s.includes('circuit')) return MET_VALUES.circuit;
  if (s.includes('straight sets')) return MET_VALUES.strength;
  if (s.includes('strength') || s.includes('resistance')) return MET_VALUES.resistance_training;
  if (s.includes('hiit')) return MET_VALUES.hiit;
  if (s.includes('swim')) return MET_VALUES.swimming_moderate;
  if (s.includes('warmup') || s.includes('mobility')) return 3;
  if (s.includes('walk')) return MET_VALUES.walking;
  if (s.includes('run')) return MET_VALUES.running_moderate;
  if (s.includes('cycle') || s.includes('bike')) return MET_VALUES.cycling_moderate;
  return MET_VALUES.hiit;
}

function getAgeYears(dateOfBirth: string): number | null {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

/**
 * Whether the user has enough baseline data for BMR/MET calculations.
 * Requires: dateOfBirth, biologicalSex, weightKg, heightCm.
 */
export function hasBaselineForMET(baseline: ProfileBaseline): boolean {
  return (
    baseline.dateOfBirth != null &&
    baseline.dateOfBirth !== '' &&
    baseline.biologicalSex != null &&
    baseline.biologicalSex !== '' &&
    baseline.weightKg != null &&
    baseline.weightKg > 0 &&
    baseline.heightCm != null &&
    baseline.heightCm > 0
  );
}

/** MET session inputs + rounded kcal estimate for a single log (Training Log modal / analytics). */
export interface WorkoutMetSessionData {
  met: number;
  durationMinutes: number;
  /** Rounded to nearest integer for display. */
  estimatedKcal: number;
}

/**
 * Map app user profile fields to MET/TDEE baseline (single source for Training Log islands).
 */
export function userProfileToProfileBaseline(
  user: UserProfile | null | undefined
): ProfileBaseline | null {
  if (!user) return null;
  return {
    dateOfBirth: user.dateOfBirth,
    biologicalSex: user.biologicalSex,
    weightKg: user.weightKg,
    heightCm: user.heightCm,
    activityLevelBaseline: user.activityLevelBaseline,
    lifestyleBaseline: user.lifestyleBaseline,
    workoutRoutine: user.workoutRoutine,
    totalActiveMultiplier: user.totalActiveMultiplier,
  };
}

/**
 * Per-session MET estimate and kcal from log + profile baseline.
 * Returns null when baseline is incomplete, or duration is missing/non-positive.
 */
export function getWorkoutMetSessionData(
  log: WorkoutLog,
  baseline: ProfileBaseline | null
): WorkoutMetSessionData | null {
  if (baseline == null || !hasBaselineForMET(baseline)) return null;
  const sec = log.durationSeconds;
  if (sec == null || sec <= 0) return null;
  const durationMinutes = sec / 60;
  const weightKg = baseline.weightKg!;
  const met = inferMETFromWorkout(log.source, log.workoutFormat);
  const rawKcal = estimateCalorieBurn(met, weightKg, durationMinutes);
  return {
    met,
    durationMinutes,
    estimatedKcal: Math.round(rawKcal),
  };
}

/**
 * Rounded estimated kcal for one log (Training Log design doc §3 sketch).
 * Same math as {@link getWorkoutMetSessionData}; use this when only kcal is needed.
 *
 * `WorkoutLog.calories` (device/manual) is separate and not used here; optional future
 * UI can show logged vs estimated side by side.
 */
export function estimateSessionKcalFromLog(
  log: WorkoutLog,
  baseline: ProfileBaseline | null
): number | null {
  return getWorkoutMetSessionData(log, baseline)?.estimatedKcal ?? null;
}
