import type { TrainerLiveSessionWorkoutPlan } from './types';
import { parseTrainerLiveSessionWorkoutPlan } from './parse';

export function trainerLiveSessionWorkoutPlanStorageKey(sessionId: string): string {
  return `trainer-live-session-workout-plan:${sessionId}`;
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
  } catch {
    /* ignore */
  }
}
