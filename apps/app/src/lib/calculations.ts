/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Heart-rate and age helpers for HIIT / Training Log (Tanaka max HR, Karvonen reserve).
 */

/** Supported age range for Tanaka-based estimates (years). */
const AGE_MIN = 10;
const AGE_MAX = 100;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function isFinitePositive(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/**
 * Parse birth date from ISO `YYYY-MM-DD` string or Date.
 * @param birthdate - Calendar date of birth (no time-of-day semantics required for age).
 * @param referenceDate - Defaults to now; use for deterministic tests (local calendar).
 * @returns Whole years elapsed, or `null` if missing/invalid/birth in the future.
 *
 * Age uses the **local** calendar for both parsed `YYYY-MM-DD` and `referenceDate`, so
 * birthdays align with the user’s timezone (consistent with HTML date inputs).
 */
export function calculateAgeYears(
  birthdate: string | Date | null | undefined,
  referenceDate: Date = new Date()
): number | null {
  if (birthdate == null || birthdate === '') return null;
  const birth =
    typeof birthdate === 'string'
      ? parseIsoDateOnly(birthdate)
      : birthdate instanceof Date && !Number.isNaN(birthdate.getTime())
        ? birthdate
        : null;
  if (!birth) return null;

  const ref = referenceDate;
  if (Number.isNaN(ref.getTime())) return null;

  const refYear = ref.getFullYear();
  const refMonth = ref.getMonth();
  const refDay = ref.getDate();
  const birthYear = birth.getFullYear();
  const birthMonth = birth.getMonth();
  const birthDay = birth.getDate();

  let y = refYear - birthYear;
  const m = refMonth - birthMonth;
  if (m < 0 || (m === 0 && refDay < birthDay)) {
    y -= 1;
  }
  if (y < 0) return null;
  return y;
}

/** Parse `YYYY-MM-DD` as local calendar date at local midnight. */
function parseIsoDateOnly(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) {
    return null;
  }
  return dt;
}

/**
 * Tanaka et al. estimate of maximal heart rate (bpm).
 * Formula: **MaxHR ≈ 208 − 0.7 × age** (years).
 *
 * @param ageYears - Chronological age in whole years.
 * @returns Rounded bpm, or `null` if age outside supported band.
 */
export function estimateMaxHrTanaka(ageYears: number): number | null {
  if (!Number.isFinite(ageYears) || ageYears < AGE_MIN || ageYears > AGE_MAX) {
    return null;
  }
  return Math.round(208 - 0.7 * ageYears);
}

/**
 * Prefer measured max HR when provided; otherwise use formula estimate.
 */
export function getEffectiveMaxHrBpm(params: {
  manualMaxHrBpm: number | null | undefined;
  estimatedMaxHrBpm: number | null | undefined;
}): number | null {
  if (isFinitePositive(params.manualMaxHrBpm)) {
    const m = Math.round(params.manualMaxHrBpm);
    if (m >= 100 && m <= 230) return m;
  }
  if (isFinitePositive(params.estimatedMaxHrBpm)) {
    return Math.round(params.estimatedMaxHrBpm);
  }
  return null;
}

export interface HeartRateAtIntensityInput {
  maxHrBpm: number;
  /** If set and valid (0 < resting < max), uses Karvonen (HRR). */
  restingHrBpm: number | null | undefined;
  /** Fraction of effort scale 0–1 (clamped). */
  intensity: number;
}

/**
 * Target heart rate for a given intensity.
 *
 * **Karvonen (heart rate reserve):** if resting HR is usable,
 * `HR = (MaxHR − RestingHR) × intensity + RestingHR`.
 *
 * **% of max (fallback):** if resting is missing or invalid,
 * `HR = MaxHR × intensity`.
 */
export function getHeartRateAtIntensity(input: HeartRateAtIntensityInput): number {
  const max = Math.round(input.maxHrBpm);
  const intensity = clamp01(input.intensity);
  const rest = input.restingHrBpm;
  if (isFinitePositive(rest) && rest < max && rest > 0) {
    const r = Math.round(rest);
    return Math.round((max - r) * intensity + r);
  }
  return Math.round(max * intensity);
}

/** Five zones as fractions of **max HR** (industry-common display bands). */
const ZONE_BANDS: readonly { name: string; intensityMin: number; intensityMax: number }[] = [
  { name: 'Warm-up', intensityMin: 0.5, intensityMax: 0.6 },
  { name: 'Fat burn', intensityMin: 0.6, intensityMax: 0.7 },
  { name: 'Aerobic', intensityMin: 0.7, intensityMax: 0.8 },
  { name: 'Anaerobic', intensityMin: 0.8, intensityMax: 0.9 },
  { name: 'Red line', intensityMin: 0.9, intensityMax: 1.0 },
];

export interface HeartRateZoneRow {
  name: string;
  intensityMin: number;
  intensityMax: number;
  bpmMin: number;
  bpmMax: number;
}

export interface GetUserHeartRateZonesInput {
  dateOfBirth: string | Date | null | undefined;
  manualMaxHrBpm: number | null | undefined;
  restingHrBpm: number | null | undefined;
  referenceDate?: Date;
}

/**
 * Five heart-rate zones using the same Karvonen vs %max branch as {@link getHeartRateAtIntensity}.
 * Zone boundaries are **50–60%, 60–70%, … 90–100%** of max HR expressed as intensity 0.5–1.0.
 */
export function getUserHeartRateZones(
  input: GetUserHeartRateZonesInput
): HeartRateZoneRow[] | null {
  const cal = buildPhysiologicalCalibration({
    dateOfBirth: input.dateOfBirth,
    manualMaxHrBpm: input.manualMaxHrBpm,
    restingHrBpm: input.restingHrBpm,
    referenceDate: input.referenceDate,
  });
  if (cal.tier === 'none' || cal.effectiveMaxHrBpm == null) return null;

  const max = cal.effectiveMaxHrBpm;
  const rest = cal.restingHrBpm;

  return ZONE_BANDS.map((z) => ({
    name: z.name,
    intensityMin: z.intensityMin,
    intensityMax: z.intensityMax,
    bpmMin: getHeartRateAtIntensity({
      maxHrBpm: max,
      restingHrBpm: rest,
      intensity: z.intensityMin,
    }),
    bpmMax: getHeartRateAtIntensity({
      maxHrBpm: max,
      restingHrBpm: rest,
      intensity: z.intensityMax,
    }),
  }));
}

export type PhysiologicalCalibrationTier = 'none' | 'max_only' | 'full';

export interface PhysiologicalCalibration {
  readonly tier: PhysiologicalCalibrationTier;
  readonly effectiveMaxHrBpm: number | null;
  readonly estimatedMaxHrBpm: number | null;
  readonly manualMaxHrBpm: number | null;
  readonly restingHrBpm: number | null;
  readonly ageYears: number | null;
}

export interface BuildPhysiologicalCalibrationInput {
  dateOfBirth: string | Date | null | undefined;
  manualMaxHrBpm: number | null | undefined;
  restingHrBpm: number | null | undefined;
  referenceDate?: Date;
}

/**
 * Resolves Tanaka estimate from DOB, effective max (manual wins), and calibration tier.
 * - **full:** max HR known + usable resting (Karvonen-capable).
 * - **max_only:** max HR known, no usable resting.
 * - **none:** cannot determine max HR.
 */
export function buildPhysiologicalCalibration(
  input: BuildPhysiologicalCalibrationInput
): PhysiologicalCalibration {
  const ref = input.referenceDate ?? new Date();
  const ageYears = calculateAgeYears(input.dateOfBirth, ref);
  const estimatedMaxHrBpm = ageYears != null ? estimateMaxHrTanaka(ageYears) : null;
  const effectiveMaxHrBpm = getEffectiveMaxHrBpm({
    manualMaxHrBpm: input.manualMaxHrBpm,
    estimatedMaxHrBpm,
  });

  const manual =
    isFinitePositive(input.manualMaxHrBpm) &&
    Math.round(input.manualMaxHrBpm) >= 100 &&
    Math.round(input.manualMaxHrBpm) <= 230
      ? Math.round(input.manualMaxHrBpm)
      : null;

  let resting: number | null = null;
  if (isFinitePositive(input.restingHrBpm)) {
    const r = Math.round(input.restingHrBpm);
    if (effectiveMaxHrBpm != null && r > 0 && r < effectiveMaxHrBpm) {
      resting = r;
    }
  }

  if (effectiveMaxHrBpm == null) {
    return {
      tier: 'none',
      effectiveMaxHrBpm: null,
      estimatedMaxHrBpm,
      manualMaxHrBpm: manual,
      restingHrBpm: resting,
      ageYears,
    };
  }

  const tier: PhysiologicalCalibrationTier = resting != null ? 'full' : 'max_only';
  return {
    tier,
    effectiveMaxHrBpm,
    estimatedMaxHrBpm,
    manualMaxHrBpm: manual,
    restingHrBpm: resting,
    ageYears,
  };
}
