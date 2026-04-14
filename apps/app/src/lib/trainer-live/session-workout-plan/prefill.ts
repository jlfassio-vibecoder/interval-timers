import type {
  SessionWorkoutPlanBlockAmrap,
  SessionWorkoutPlanBlockEmom,
  SessionWorkoutPlanBlockTabata,
  SessionWorkoutPlanBlockWarmup,
  SessionWorkoutPlanBlockCooldown,
  TrainerLiveSessionWorkoutPlan,
} from './types';

/**
 * Flexible MVP: pre-fill from the first block of that kind in plan order.
 * Trainers may reorder the plan in the rail; we do not enforce a strict queue at RPC time.
 */
export function getFirstAmrapBlock(
  plan: TrainerLiveSessionWorkoutPlan
): SessionWorkoutPlanBlockAmrap | null {
  for (const b of plan.blocks) {
    if (b.kind === 'amrap') return b;
  }
  return null;
}

export function getFirstTabataBlock(
  plan: TrainerLiveSessionWorkoutPlan
): SessionWorkoutPlanBlockTabata | null {
  for (const b of plan.blocks) {
    if (b.kind === 'tabata') return b;
  }
  return null;
}

export function getFirstEmomBlock(
  plan: TrainerLiveSessionWorkoutPlan
): SessionWorkoutPlanBlockEmom | null {
  for (const b of plan.blocks) {
    if (b.kind === 'emom') return b;
  }
  return null;
}

export function getFirstWarmupBlock(
  plan: TrainerLiveSessionWorkoutPlan
): SessionWorkoutPlanBlockWarmup | null {
  for (const b of plan.blocks) {
    if (b.kind === 'warmup') return b;
  }
  return null;
}

export function getFirstCooldownBlock(
  plan: TrainerLiveSessionWorkoutPlan
): SessionWorkoutPlanBlockCooldown | null {
  for (const b of plan.blocks) {
    if (b.kind === 'cooldown') return b;
  }
  return null;
}

export function sessionPlanHasAnyBlocks(plan: TrainerLiveSessionWorkoutPlan): boolean {
  return plan.blocks.length > 0;
}
