/**
 * Ordered session plan for Trainer Live activity rail (trainer-local; optional sessionStorage).
 * "Shells" = activity block kinds (not TrainerLiveShell video_only / countdown_timer).
 */

export type SessionWorkoutPlanBlockKind = 'warmup' | 'cooldown' | 'amrap' | 'tabata' | 'emom';

export interface SessionWorkoutPlanBlockBase {
  /** Stable id for React keys and reorder */
  id: string;
  label?: string;
}

export interface SessionWorkoutPlanBlockWarmup extends SessionWorkoutPlanBlockBase {
  kind: 'warmup';
  exercises: string[];
}

export interface SessionWorkoutPlanBlockCooldown extends SessionWorkoutPlanBlockBase {
  kind: 'cooldown';
  exercises: string[];
}

export interface SessionWorkoutPlanBlockAmrap extends SessionWorkoutPlanBlockBase {
  kind: 'amrap';
  durationMinutes: number;
  exercises: string[];
}

export interface SessionWorkoutPlanBlockTabata extends SessionWorkoutPlanBlockBase {
  kind: 'tabata';
  roundCount: number;
  exercises: string[];
}

export interface SessionWorkoutPlanBlockEmom extends SessionWorkoutPlanBlockBase {
  kind: 'emom';
  roundCount: number;
  exercises: string[];
}

export type SessionWorkoutPlanBlock =
  | SessionWorkoutPlanBlockWarmup
  | SessionWorkoutPlanBlockCooldown
  | SessionWorkoutPlanBlockAmrap
  | SessionWorkoutPlanBlockTabata
  | SessionWorkoutPlanBlockEmom;

export interface TrainerLiveSessionWorkoutPlan {
  blocks: SessionWorkoutPlanBlock[];
}

export function createSessionWorkoutPlanBlockId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `blk-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
