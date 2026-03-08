/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared type definitions for AI Workout Generation (Workout Factory)
 * Workouts are 1–N sessions (single, split, or two-a-day) with no week-by-week schedule.
 */

import type {
  UserDemographics,
  MedicalProfile,
  Goals,
  ExerciseBlock,
  Exercise,
  WarmupBlock,
  ProgressionProtocol,
  VolumeLandmark,
  PatternSkeleton,
  ExerciseSelection,
} from '@/types/ai-program';

/** Split type for workout persona */
export type WorkoutSplitType =
  | 'upper_lower'
  | 'ppl'
  | 'full_body'
  | 'push_pull_legs'
  | 'bro_split'
  | 'custom';

/** Lifestyle for recovery and volume calibration */
export type WorkoutLifestyle = 'sedentary' | 'active' | 'athlete';

// --- HIIT (Metabolic Conditioning) Mode ---

export type HiitProtocolFormat =
  | 'standard_ratio'
  | 'tabata'
  | 'emom'
  | 'amrap'
  | 'ladder'
  | 'chipper';

export type HiitWorkRestRatio = '1:1' | '2:1' | '1:2' | '1:3';

export interface HiitCircuitStructure {
  includeWarmup: boolean;
  circuit1: boolean;
  circuit2: boolean;
  circuit3: boolean;
  includeCooldown: boolean;
}

export type HiitSessionDurationTier = 'micro_dose' | 'standard_interval' | 'high_volume';

export type HiitPrimaryGoal = 'vo2_max' | 'lactate_tolerance' | 'explosive_power' | 'fat_oxidation';

export interface HiitOptions {
  protocolFormat: HiitProtocolFormat;
  workRestRatio?: HiitWorkRestRatio;
  circuitStructure: HiitCircuitStructure;
  sessionDurationTier: HiitSessionDurationTier;
  primaryGoal: HiitPrimaryGoal;
}

/**
 * Block structure options for workout generation (Workout Factory)
 */
export interface BlockOptions {
  includeWarmup: boolean;
  mainBlockCount: 1 | 2 | 3 | 4 | 5;
  includeFinisher: boolean;
  includeCooldown: boolean;
}

/**
 * Complete user persona for workout generation (API request payload)
 * More detailed than ProgramPersona: goal, lifestyle, weekly time, sessions, split.
 */
export interface WorkoutPersona {
  title?: string;
  description?: string;
  demographics: UserDemographics;
  medical: MedicalProfile;
  goals: Goals;
  zoneId?: string;
  selectedEquipmentIds?: string[];
  /** Total minutes per week available for training */
  weeklyTimeMinutes: number;
  /** Number of sessions per week (1–7) */
  sessionsPerWeek: number;
  /** Target duration per session in minutes */
  sessionDurationMinutes: number;
  splitType: WorkoutSplitType;
  lifestyle: WorkoutLifestyle;
  /** True if user can do two-a-days (e.g. AM/PM sessions) */
  twoADay: boolean;
  /** Optional focus for single-session (e.g. "upper push only") */
  preferredFocus?: string;
  /** When true, use density-based (time/ratios) logic and Timer Schema in chain */
  hiitMode?: boolean;
  /** Required when hiitMode is true; protocol, ratio, circuit structure, session tier, primary goal */
  hiitOptions?: HiitOptions;
}

/**
 * Admin configuration for workout generation (Workout Factory UI)
 */
export interface WorkoutConfig {
  workoutInfo: {
    title: string;
    description: string;
  };
  targetAudience: UserDemographics;
  requirements: {
    sessionsPerWeek: number;
    sessionDurationMinutes: number;
    splitType: WorkoutSplitType;
    lifestyle: WorkoutLifestyle;
    twoADay: boolean;
    weeklyTimeMinutes: number;
  };
  medicalContext?: {
    includeInjuries: boolean;
    injuries?: string;
    includeConditions: boolean;
    conditions?: string;
  };
  goals: Goals;
  zoneId?: string;
  selectedEquipmentIds?: string[];
  preferredFocus?: string;
  blockOptions?: BlockOptions;
  hiitMode?: boolean;
  hiitOptions?: HiitOptions;
}

/**
 * Single session definition from Workout Architect (Step 1)
 */
export interface WorkoutSessionSpec {
  session_number: number;
  session_name: string;
  focus: string;
  duration_minutes: number;
  volume_targets?: string;
}

/**
 * Step 1: Workout Architect Blueprint
 * Establishes sessions and progression; compatible shape for Biomechanist/Coach (split, volume_landmarks).
 */
export interface WorkoutArchitectBlueprint {
  workout_set_name: string;
  rationale: string;
  /** Sessions to generate (1–N) */
  sessions: WorkoutSessionSpec[];
  /** Compatible with program ArchitectBlueprint for steps 2–3 */
  split: {
    type: string;
    days_per_week: number;
    session_duration_minutes: number;
  };
  progression_protocol: ProgressionProtocol;
  progression_rules: {
    description: string;
    weeks_1_3: string;
    weeks_4_6: string;
  };
  volume_landmarks: VolumeLandmark[];
}

/**
 * Single workout in a set (same shape as ProgramSchedule.workouts[n])
 */
export interface WorkoutInSet {
  title: string;
  description: string;
  warmupBlocks?: WarmupBlock[];
  blocks?: Exercise[];
  exerciseBlocks?: ExerciseBlock[];
  finisherBlocks?: WarmupBlock[];
  cooldownBlocks?: WarmupBlock[];
  /** Per-exercise image/instruction overrides (same pattern as WOD). Key = exercise name from workout. */
  exerciseOverrides?: Record<string, import('@/types').Exercise>;
}

// --- HIIT Playback (Dynamic Protocol Engine) ---

/** Single block in the linear timeline consumed by the interval timer */
export interface HIITTimelineBlock {
  type: 'warmup' | 'work' | 'rest' | 'cooldown';
  duration: number; // seconds
  name: string;
  notes?: string;
  /** Primary exercise image URL when available (e.g. from exerciseOverrides). */
  imageUrl?: string;
}

/** Target goal for theming and science copy */
export type HIITTargetGoal = 'VO2' | 'Lactate' | 'Power' | 'FatOx';

/** Data contract for the Dynamic Protocol Engine: meta, science, linear timeline */
export interface HIITWorkoutData {
  meta: {
    title: string;
    protocol: string;
    description: string;
    targetGoal: HIITTargetGoal;
    durationMin?: number;
  };
  science: {
    title: string;
    summary: string;
    benefit1: string;
    benefit2: string;
  };
  timeline: HIITTimelineBlock[];
}

/**
 * Workout set template (chain output) – 1–N workouts, no weeks
 */
export interface WorkoutSetTemplate {
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  workouts: WorkoutInSet[];
}

/**
 * Workout metadata stored in Firestore (master document)
 * Workouts array stored on same document.
 */
export interface WorkoutMetadata {
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  targetAudience: UserDemographics;
  equipmentProfile?: {
    zoneId?: string;
    equipmentIds?: string[];
  };
  goals?: Goals;
  /** Snapshot of config used for generation (for edit mode) */
  workoutConfig?: WorkoutConfig;
  chain_metadata?: WorkoutChainMetadata;
  status: 'draft' | 'published';
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  /** Number of workouts in set (convenience for list view) */
  workoutCount?: number;
}

/**
 * Chain metadata for workout generation (workout-specific step 1 and 4)
 */
export interface WorkoutChainMetadata {
  step1_workout_architect: WorkoutArchitectBlueprint;
  step2_biomechanist: PatternSkeleton;
  step3_coach: ExerciseSelection[];
  step4_workout_mathematician: WorkoutInSet[];
  generated_at: Date;
  model_used: string;
  total_tokens?: number;
}

/**
 * Workout library item (metadata + id for listing)
 */
export interface WorkoutLibraryItem extends WorkoutMetadata {
  id: string;
}
