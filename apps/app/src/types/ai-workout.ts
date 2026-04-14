/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared type definitions for AI Workout Generation (Workout Factory)
 * Workouts are 1–N sessions (single, split, or two-a-day) with no week-by-week schedule.
 */

import type {
  WorkoutInSet as WorkoutInSetContract,
  WorkoutSetTemplate as WorkoutSetTemplateContract,
} from '@interval-timers/workout-contract';
import type {
  UserDemographics,
  MedicalProfile,
  Goals,
  ProgressionProtocol,
  VolumeLandmark,
  PatternSkeleton,
  ExerciseSelection,
  ExerciseBlock,
  Exercise,
  WarmupBlock,
} from '@/types/ai-program';

/** Re-export for consumers. WorkoutInSet uses warmupBlocks/cooldownBlocks (WarmupBlock[]); main blocks use exerciseBlocks (ExerciseBlock[]). */
export type { ExerciseBlock, Exercise, WarmupBlock };
import type { Exercise as MappedExercise } from '@/types';

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

/** Density-based AMRAP (reps per station, laps for time) — parallel to HIIT interval mode. */
export type AmrapDensityProtocolFormat = 'AMRAP_DENSITY';

/** No timed work:rest between stations; continuous lap format. */
export type AmrapDensityWorkRest = 'continuous' | '0:0';

export interface AmrapDensityOptions {
  protocolFormat: AmrapDensityProtocolFormat;
  workRestRatio: AmrapDensityWorkRest;
  sessionDurationTier: HiitSessionDurationTier;
}

/** Balanced Strength & Cardio Tabata (Workout Factory) — fixed 20s/10s; pairing drives exercise count. */
export type TabataBalancedPairingPattern =
  | 'single'
  | 'antagonist_pair'
  | 'agonist_pair'
  | 'four_station'
  | 'eight_station';

export interface TabataBalancedOptions {
  pairingPattern: TabataBalancedPairingPattern;
  /** Classic Tabata default 8; trainers may adjust (bounds enforced in prepare). */
  roundCount: number;
}

/** Workout Factory EMOM mode — mutually exclusive with HIIT / Density AMRAP / Balanced Tabata. */
export type EmomFactoryStructure =
  /** Same work every minute (one exercise). */
  | 'single_movement'
  /** Rotate exercises each minute; cycle length = stationsPerCycle minutes before repeat. */
  | 'alternating'
  /** Multiple movements completed inside the same minute before rest. */
  | 'complex';

export interface EmomFactoryOptions {
  structure: EmomFactoryStructure;
  /** Total EMOM minutes (one round = one minute on the clock). */
  totalRounds: number;
  /** Alternating only: minutes in one full rotation (2–8). totalRounds must be divisible by this. */
  stationsPerCycle?: number;
  /** Alternating: one station in the cycle is active rest / easy recovery. */
  includeRestStation?: boolean;
  /** Complex only: how many distinct movements in the same minute (2–4). */
  movementsPerMinute?: number;
}

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
  /** Freeform injury / medical context from the trainer (Step 1 + Step 4 brief). */
  medicalNotes?: string;
  /** Comma-separated extra equipment names merged after ID resolution (no zone required). */
  additionalEquipmentLabels?: string;
  /** When true, use density-based (time/ratios) logic and Timer Schema in chain */
  hiitMode?: boolean;
  /** Required when hiitMode is true; protocol, ratio, circuit structure, session tier, primary goal */
  hiitOptions?: HiitOptions;
  /**
   * When true, use Density-Based AMRAP (reps per station, Total Laps Completed).
   * Mutually exclusive with hiitMode in API/UI.
   */
  amrapDensityMode?: boolean;
  /** Required when amrapDensityMode is true */
  amrapDensityOptions?: AmrapDensityOptions;
  /**
   * When true, use guided Tabata (20s/10s, strength/cardio pairing presets).
   * Mutually exclusive with hiitMode and amrapDensityMode in API/UI.
   */
  tabataBalancedMode?: boolean;
  /** Required when tabataBalancedMode is true */
  tabataBalancedOptions?: TabataBalancedOptions;
  /**
   * When true, use structured EMOM factory (single / alternating / complex).
   * Mutually exclusive with hiitMode, amrapDensityMode, and tabataBalancedMode in API/UI.
   */
  emomMode?: boolean;
  /** Required when emomMode is true */
  emomOptions?: EmomFactoryOptions;
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
  /** Single textarea; preferred over toggled medicalContext when set. */
  medicalNotes?: string;
  goals: Goals;
  zoneId?: string;
  selectedEquipmentIds?: string[];
  /** Comma-separated equipment names merged with catalog selections in prepare. */
  additionalEquipmentLabels?: string;
  preferredFocus?: string;
  blockOptions?: BlockOptions;
  hiitMode?: boolean;
  hiitOptions?: HiitOptions;
  amrapDensityMode?: boolean;
  amrapDensityOptions?: AmrapDensityOptions;
  tabataBalancedMode?: boolean;
  tabataBalancedOptions?: TabataBalancedOptions;
  emomMode?: boolean;
  emomOptions?: EmomFactoryOptions;
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
 * Single workout in a set (same shape as ProgramSchedule.workouts[n]).
 * Base fields: @interval-timers/workout-contract; app adds mapped exercise overrides.
 */
export interface WorkoutInSet extends WorkoutInSetContract {
  /** Per-exercise image/instruction overrides (same pattern as WOD). Key = exercise name from workout. */
  exerciseOverrides?: Record<string, MappedExercise>;
}

/** Default warmup block suggested when a workout has none. */
export const DEFAULT_WARMUP_BLOCKS: WarmupBlock[] = [
  {
    order: 1,
    exerciseName: 'General warm-up',
    instructions: [
      '5–10 min light cardio or dynamic stretches',
      'Prepare joints and muscles for the workout',
    ],
  },
];

/** Default cooldown block suggested when a workout has none. */
export const DEFAULT_COOLDOWN_BLOCKS: WarmupBlock[] = [
  {
    order: 1,
    exerciseName: 'Cool down',
    instructions: [
      '5–10 min light activity (e.g. walking)',
      'Static stretches for major muscle groups used',
    ],
  },
];

/**
 * Ensures a workout has warmupBlocks and cooldownBlocks. When missing or empty,
 * adds DEFAULT_WARMUP_BLOCKS and DEFAULT_COOLDOWN_BLOCKS.
 */
export function ensureWarmupAndCooldown<
  T extends { warmupBlocks?: WarmupBlock[]; cooldownBlocks?: WarmupBlock[] },
>(workout: T): T {
  const w = workout as { warmupBlocks?: WarmupBlock[]; cooldownBlocks?: WarmupBlock[] };
  if (!w.warmupBlocks || w.warmupBlocks.length === 0) {
    w.warmupBlocks = [...DEFAULT_WARMUP_BLOCKS];
  }
  if (!w.cooldownBlocks || w.cooldownBlocks.length === 0) {
    w.cooldownBlocks = [...DEFAULT_COOLDOWN_BLOCKS];
  }
  return workout;
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
export interface WorkoutSetTemplate extends Omit<WorkoutSetTemplateContract, 'workouts'> {
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
