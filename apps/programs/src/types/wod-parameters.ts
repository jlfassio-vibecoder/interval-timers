/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * WOD Engine parameter types for time domain, format, bias, load, and social config.
 */

// --- Time Domain ---

export type TimeDomainCategory = 'sprint' | 'mid_range' | 'endurance';

export interface TimeDomainConfig {
  category: TimeDomainCategory;
  /** Optional hard stop in minutes (e.g., 12). */
  timeCapMinutes?: number;
}

export interface TimeDomainOption {
  id: TimeDomainCategory;
  name: string;
  shortName: string;
  description: string;
  rangeLabel: string;
  /** Lucide icon name for UI */
  icon: 'zap' | 'clock' | 'timer';
}

export const TIME_DOMAIN_OPTIONS: Record<TimeDomainCategory, TimeDomainOption> = {
  sprint: {
    id: 'sprint',
    name: 'Sprint',
    shortName: 'Sprint',
    description: 'High intensity, short burst. Allows time for strength segment beforehand.',
    rangeLabel: '< 8 min',
    icon: 'zap',
  },
  mid_range: {
    id: 'mid_range',
    name: 'Mid-Range',
    shortName: 'Mid',
    description: 'Classic Metcon sweet spot.',
    rangeLabel: '8–15 min',
    icon: 'clock',
  },
  endurance: {
    id: 'endurance',
    name: 'Endurance',
    shortName: 'Endurance',
    description: 'Grinder workout that takes up the majority of the class.',
    rangeLabel: '20+ min',
    icon: 'timer',
  },
};

export function getTimeDomainOption(id: TimeDomainCategory): TimeDomainOption {
  return TIME_DOMAIN_OPTIONS[id];
}

export function getAllTimeDomainOptions(): TimeDomainOption[] {
  return Object.values(TIME_DOMAIN_OPTIONS);
}

// --- Workout Format (multi-select) ---

export type WorkoutFormat = 'amrap' | 'rft' | 'emom' | 'chipper' | 'ladder' | 'tabata';

export interface WorkoutFormatOption {
  id: WorkoutFormat;
  name: string;
  shortName: string;
  description: string;
  icon: 'repeat' | 'timer' | 'list' | 'trending-up' | 'activity';
}

export const WORKOUT_FORMAT_OPTIONS: Record<WorkoutFormat, WorkoutFormatOption> = {
  amrap: {
    id: 'amrap',
    name: 'AMRAP',
    shortName: 'AMRAP',
    description: 'As Many Rounds As Possible (fixed time, variable volume)',
    icon: 'repeat',
  },
  rft: {
    id: 'rft',
    name: 'RFT',
    shortName: 'RFT',
    description: 'Rounds For Time (fixed volume, variable time)',
    icon: 'timer',
  },
  emom: {
    id: 'emom',
    name: 'EMOM',
    shortName: 'EMOM',
    description: 'Every Minute on the Minute (interval/pacing focus)',
    icon: 'timer',
  },
  chipper: {
    id: 'chipper',
    name: 'Chipper',
    shortName: 'Chipper',
    description: 'Long list of exercises completed once through',
    icon: 'list',
  },
  ladder: {
    id: 'ladder',
    name: 'Ladder',
    shortName: 'Ladder',
    description: 'Ascending or descending rep schemes (2-4-6-8...)',
    icon: 'trending-up',
  },
  tabata: {
    id: 'tabata',
    name: 'Tabata / Intervals',
    shortName: 'Tabata',
    description: 'Work/rest ratio intervals',
    icon: 'activity',
  },
};

export function getWorkoutFormatOption(id: WorkoutFormat): WorkoutFormatOption {
  return WORKOUT_FORMAT_OPTIONS[id];
}

export function getAllWorkoutFormats(): WorkoutFormatOption[] {
  return Object.values(WORKOUT_FORMAT_OPTIONS);
}

export const ALL_WORKOUT_FORMAT_IDS: WorkoutFormat[] = [
  'amrap',
  'rft',
  'emom',
  'chipper',
  'ladder',
  'tabata',
];

// --- Primary Focus / Bias ---

export type MovementBias = 'push' | 'pull' | 'squat' | 'hinge' | 'lunge' | 'balanced';

export type ModalityBias = 'monostructural' | 'gymnastics' | 'weightlifting' | 'balanced';

export type TargetArea = 'upper_body' | 'lower_body' | 'full_body';

export interface MovementBiasOption {
  id: MovementBias;
  name: string;
  description: string;
}

export const MOVEMENT_BIAS_OPTIONS: Record<MovementBias, MovementBiasOption> = {
  push: { id: 'push', name: 'Push', description: 'Push-dominant movements' },
  pull: { id: 'pull', name: 'Pull', description: 'Pull-dominant movements' },
  squat: { id: 'squat', name: 'Squat', description: 'Knee-dominant' },
  hinge: { id: 'hinge', name: 'Hinge', description: 'Hip-dominant' },
  lunge: { id: 'lunge', name: 'Lunge', description: 'Single-leg / lunge' },
  balanced: { id: 'balanced', name: 'Balanced', description: 'No movement bias' },
};

export interface ModalityBiasOption {
  id: ModalityBias;
  name: string;
  description: string;
}

export const MODALITY_BIAS_OPTIONS: Record<ModalityBias, ModalityBiasOption> = {
  monostructural: {
    id: 'monostructural',
    name: 'Cardio Focus',
    description: 'Running, rowing, biking',
  },
  gymnastics: {
    id: 'gymnastics',
    name: 'Gymnastics Focus',
    description: 'Bodyweight control (pull-ups, burpees, box jumps)',
  },
  weightlifting: {
    id: 'weightlifting',
    name: 'Strength Focus',
    description: 'External load (barbell, dumbbell)',
  },
  balanced: {
    id: 'balanced',
    name: 'Balanced',
    description: 'Mix of modalities',
  },
};

export interface TargetAreaOption {
  id: TargetArea;
  name: string;
  description: string;
}

export const TARGET_AREA_OPTIONS: Record<TargetArea, TargetAreaOption> = {
  upper_body: {
    id: 'upper_body',
    name: 'Upper Body Dominant',
    description: 'Arms, shoulders, back emphasis',
  },
  lower_body: {
    id: 'lower_body',
    name: 'Lower Body Dominant',
    description: 'Legs, hips emphasis',
  },
  full_body: {
    id: 'full_body',
    name: 'Full Body',
    description: 'Balanced full-body workout',
  },
};

// --- Load Profile ---

export type LoadProfile = 'heavy' | 'standard' | 'light';

export interface LoadProfileOption {
  id: LoadProfile;
  name: string;
  shortName: string;
  description: string;
  icon: 'dumbbell' | 'scale' | 'wind';
}

export const LOAD_PROFILE_OPTIONS: Record<LoadProfile, LoadProfileOption> = {
  heavy: {
    id: 'heavy',
    name: 'Heavy / Strength',
    shortName: 'Heavy',
    description: 'High weight, low reps. Focus: Power & Force',
    icon: 'dumbbell',
  },
  standard: {
    id: 'standard',
    name: 'Standard / RX',
    shortName: 'RX',
    description: 'Moderate weight, moderate reps. Focus: Capacity',
    icon: 'scale',
  },
  light: {
    id: 'light',
    name: 'Light / Speed',
    shortName: 'Light',
    description: 'Low weight, high reps. Focus: Cardiovascular endurance',
    icon: 'wind',
  },
};

export function getLoadProfileOption(id: LoadProfile): LoadProfileOption {
  return LOAD_PROFILE_OPTIONS[id];
}

export function getAllLoadProfileOptions(): LoadProfileOption[] {
  return Object.values(LOAD_PROFILE_OPTIONS);
}

// --- Social Configuration ---

export type SocialConfig = 'solo' | 'partner' | 'team';

export interface SocialConfigOption {
  id: SocialConfig;
  name: string;
  description: string;
  icon: 'user' | 'users-two' | 'users';
}

export const SOCIAL_CONFIG_OPTIONS: Record<SocialConfig, SocialConfigOption> = {
  solo: {
    id: 'solo',
    name: 'Solo',
    description: 'Standard individual athlete',
    icon: 'user',
  },
  partner: {
    id: 'partner',
    name: 'Partner',
    description: 'Synchro elements, you-go-I-go rest formats',
    icon: 'users-two',
  },
  team: {
    id: 'team',
    name: 'Team',
    description: 'Doubled volume or team relay elements',
    icon: 'users',
  },
};

export function getSocialConfigOption(id: SocialConfig): SocialConfigOption {
  return SOCIAL_CONFIG_OPTIONS[id];
}

export function getAllSocialConfigOptions(): SocialConfigOption[] {
  return Object.values(SOCIAL_CONFIG_OPTIONS);
}

// --- Combined Parameters ---

export interface WODParameters {
  timeDomain: TimeDomainConfig;
  allowedFormats: WorkoutFormat[];
  movementBias: MovementBias;
  modalityBias: ModalityBias;
  targetArea: TargetArea;
  loadProfile: LoadProfile;
  socialConfig: SocialConfig;
  exclusions: string[];
}

/** Default WOD parameters when none specified */
export const DEFAULT_WOD_PARAMETERS: WODParameters = {
  timeDomain: { category: 'mid_range' },
  allowedFormats: ALL_WORKOUT_FORMAT_IDS,
  movementBias: 'balanced',
  modalityBias: 'balanced',
  targetArea: 'full_body',
  loadProfile: 'standard',
  socialConfig: 'solo',
  exclusions: [],
};

/**
 * Merge partial parameters with defaults (for iteration or API).
 */
export function mergeWODParameters(partial?: Partial<WODParameters> | null): WODParameters {
  if (!partial) return { ...DEFAULT_WOD_PARAMETERS };
  return {
    ...DEFAULT_WOD_PARAMETERS,
    ...partial,
    timeDomain: {
      ...DEFAULT_WOD_PARAMETERS.timeDomain,
      ...partial.timeDomain,
    },
    allowedFormats:
      (partial.allowedFormats?.length ?? 0) > 0
        ? (partial.allowedFormats ?? DEFAULT_WOD_PARAMETERS.allowedFormats)
        : DEFAULT_WOD_PARAMETERS.allowedFormats,
    exclusions: partial.exclusions ?? DEFAULT_WOD_PARAMETERS.exclusions,
  };
}
