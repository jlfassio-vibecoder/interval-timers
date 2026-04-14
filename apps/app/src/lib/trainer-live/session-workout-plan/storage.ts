import type { TrainerLiveSessionWorkoutPlan } from './types';
import { parseTrainerLiveSessionWorkoutPlan } from './parse';
import type { PreferredBlockIdsByKind } from './prefill';

export function trainerLiveSessionWorkoutPlanStorageKey(sessionId: string): string {
  return `trainer-live-session-workout-plan:${sessionId}`;
}

export function trainerLiveSessionWorkoutPlanPreferredBlocksStorageKey(sessionId: string): string {
  return `trainer-live-session-workout-plan-preferred-blocks:${sessionId}`;
}

export function loadSessionWorkoutPlanFromSessionStorage(
  sessionId: string
): TrainerLiveSessionWorkoutPlan | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(trainerLiveSessionWorkoutPlanStorageKey(sessionId));
    if (!raw) return null;
    return parseTrainerLiveSessionWorkoutPlan(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function saveSessionWorkoutPlanToSessionStorage(
  sessionId: string,
  plan: TrainerLiveSessionWorkoutPlan
): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(
      trainerLiveSessionWorkoutPlanStorageKey(sessionId),
      JSON.stringify(plan)
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearSessionWorkoutPlanSessionStorage(sessionId: string): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(trainerLiveSessionWorkoutPlanStorageKey(sessionId));
    sessionStorage.removeItem(trainerLiveSessionWorkoutPlanPreferredBlocksStorageKey(sessionId));
  } catch {
    /* ignore */
  }
}

export function loadPreferredPlanBlocksFromSessionStorage(
  sessionId: string
): PreferredBlockIdsByKind {
  if (typeof sessionStorage === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(trainerLiveSessionWorkoutPlanPreferredBlocksStorageKey(sessionId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const obj = parsed as Record<string, unknown>;
    const result: PreferredBlockIdsByKind = {};
    for (const key of ['warmup', 'cooldown', 'amrap', 'tabata', 'emom'] as const) {
      const v = obj[key];
      if (typeof v === 'string' && v.trim()) result[key] = v;
    }
    return result;
  } catch {
    return {};
  }
}

export function savePreferredPlanBlocksToSessionStorage(
  sessionId: string,
  preferred: PreferredBlockIdsByKind
): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(
      trainerLiveSessionWorkoutPlanPreferredBlocksStorageKey(sessionId),
      JSON.stringify(preferred)
    );
  } catch {
    /* quota / private mode */
  }
}
