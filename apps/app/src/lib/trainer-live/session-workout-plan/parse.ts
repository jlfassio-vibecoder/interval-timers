import type {
  SessionWorkoutPlanBlock,
  SessionWorkoutPlanBlockKind,
  TrainerLiveSessionWorkoutPlan,
} from './types';
import { createSessionWorkoutPlanBlockId } from './types';

function isBlockKind(x: string): x is SessionWorkoutPlanBlockKind {
  return x === 'warmup' || x === 'cooldown' || x === 'amrap' || x === 'tabata' || x === 'emom';
}

function parseExercises(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseBlock(o: Record<string, unknown>): SessionWorkoutPlanBlock | null {
  const kind = o.kind;
  const id = typeof o.id === 'string' && o.id.trim() ? o.id : createSessionWorkoutPlanBlockId();
  const label = typeof o.label === 'string' && o.label.trim() ? o.label : undefined;
  const exercises = parseExercises(o.exercises);

  if (typeof kind !== 'string' || !isBlockKind(kind)) return null;

  if (kind === 'warmup') {
    return { id, kind: 'warmup', exercises, ...(label ? { label } : {}) };
  }
  if (kind === 'cooldown') {
    return { id, kind: 'cooldown', exercises, ...(label ? { label } : {}) };
  }

  if (kind === 'amrap') {
    const dm = o.durationMinutes;
    const n =
      typeof dm === 'number' && Number.isFinite(dm)
        ? Math.round(dm)
        : typeof dm === 'string'
          ? Math.round(Number.parseFloat(dm))
          : NaN;
    if (!Number.isFinite(n) || n < 1 || n > 180) return null;
    return { id, kind: 'amrap', durationMinutes: n, exercises, ...(label ? { label } : {}) };
  }

  if (kind === 'tabata' || kind === 'emom') {
    const rc = o.roundCount;
    const rounds =
      typeof rc === 'number' && Number.isFinite(rc)
        ? Math.round(rc)
        : typeof rc === 'string'
          ? Math.round(Number.parseInt(rc, 10))
          : NaN;
    const maxR = kind === 'tabata' ? 32 : 120;
    if (!Number.isFinite(rounds) || rounds < 1 || rounds > maxR) return null;
    if (kind === 'tabata') {
      return { id, kind: 'tabata', roundCount: rounds, exercises, ...(label ? { label } : {}) };
    }
    return { id, kind: 'emom', roundCount: rounds, exercises, ...(label ? { label } : {}) };
  }

  return null;
}

export function parseTrainerLiveSessionWorkoutPlan(data: unknown): TrainerLiveSessionWorkoutPlan {
  if (!data || typeof data !== 'object') return { blocks: [] };
  const o = data as Record<string, unknown>;
  if (!Array.isArray(o.blocks)) return { blocks: [] };
  const blocks: SessionWorkoutPlanBlock[] = [];
  for (const row of o.blocks) {
    if (!row || typeof row !== 'object') continue;
    const b = parseBlock(row as Record<string, unknown>);
    if (b) blocks.push(b);
  }
  return { blocks };
}
