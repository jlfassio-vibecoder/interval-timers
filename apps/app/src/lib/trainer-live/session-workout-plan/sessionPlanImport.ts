import { workoutBlocksToAmrapExerciseNames } from '@/lib/trainer-live/amrap-workout-list-adapter';
import type { FactoryMetabolicMode } from '@/lib/trainer-live/workout-factory-metabolic-mode';
import { createSessionWorkoutPlanBlockId } from './types';
import type {
  SessionWorkoutPlanBlock,
  SessionWorkoutPlanBlockKind,
  TrainerLiveSessionWorkoutPlan,
} from './types';
import { buildDailyWarmupSessionPlan, DAILY_WARMUP_LABEL } from './warmupSessionPlan';

export type SessionPlanImportMode = 'replace_plan' | 'replace_block' | 'append_block';

export interface SessionPlanImportTarget {
  kind: SessionWorkoutPlanBlockKind;
  mode: SessionPlanImportMode;
  blockId?: string;
}

export interface SessionPlanLibraryRow {
  id: string;
  title: string;
  blocks?: unknown;
  durationMinutes?: number | null;
  factoryMetabolicMode?: FactoryMetabolicMode | null;
}

export interface SessionPlanSystemPreset {
  id: string;
  label: string;
  description: string;
  kind: SessionWorkoutPlanBlockKind;
  available: boolean;
  buildBlock: () => SessionWorkoutPlanBlock | null;
}

const DEFAULT_ROUNDS = 8;
const DEFAULT_EMOM_ROUNDS = 10;
const DEFAULT_DURATION_MINUTES = 15;

export function getSystemPresetsForKind(kind: SessionWorkoutPlanBlockKind): SessionPlanSystemPreset[] {
  if (kind === 'warmup') {
    return [
      {
        id: 'system:daily-warmup',
        label: DAILY_WARMUP_LABEL,
        description: 'System preset shared by all trainers.',
        kind,
        available: true,
        buildBlock: () => buildDailyWarmupSessionPlan().blocks[0] ?? null,
      },
    ];
  }
  const kindLabel =
    kind === 'amrap'
      ? 'AMRAP'
      : kind === 'tabata'
        ? 'Tabata'
        : kind === 'emom'
          ? 'EMOM'
          : 'Cooldown';
  return [
    {
      id: `system:${kind}:coming-soon`,
      label: `${kindLabel} preset`,
      description: 'System preset coming soon.',
      kind,
      available: false,
      buildBlock: () => null,
    },
  ];
}

export function mapLibraryRowToBlock(
  kind: SessionWorkoutPlanBlockKind,
  row: SessionPlanLibraryRow
): SessionWorkoutPlanBlock | null {
  const exercises = workoutBlocksToAmrapExerciseNames(row.blocks);
  if (exercises.length === 0) return null;
  const label = row.title.trim() || 'Imported workout';
  if (kind === 'warmup' || kind === 'cooldown') {
    return { id: createSessionWorkoutPlanBlockId(), kind, label, exercises };
  }
  if (kind === 'amrap') {
    const dm = row.durationMinutes;
    const durationMinutes =
      typeof dm === 'number' && Number.isFinite(dm) && dm >= 1 && dm <= 180
        ? Math.round(dm)
        : DEFAULT_DURATION_MINUTES;
    return { id: createSessionWorkoutPlanBlockId(), kind, label, durationMinutes, exercises };
  }
  if (kind === 'tabata') {
    return { id: createSessionWorkoutPlanBlockId(), kind, label, roundCount: DEFAULT_ROUNDS, exercises };
  }
  return { id: createSessionWorkoutPlanBlockId(), kind, label, roundCount: DEFAULT_EMOM_ROUNDS, exercises };
}

export function isLibraryRowCompatibleWithKind(
  kind: SessionWorkoutPlanBlockKind,
  row: SessionPlanLibraryRow
): boolean {
  if (kind === 'warmup' || kind === 'cooldown') return true;
  const mode = row.factoryMetabolicMode ?? null;
  if (kind === 'amrap') return mode === 'amrap_density' || mode == null;
  if (kind === 'tabata') return mode === 'tabata_balanced' || mode == null;
  if (kind === 'emom')
    return mode === 'emom_factory' || mode === 'hiit' || mode == null;
  return true;
}

export function applyImportedBlockToPlan(
  plan: TrainerLiveSessionWorkoutPlan,
  block: SessionWorkoutPlanBlock,
  target: SessionPlanImportTarget
): TrainerLiveSessionWorkoutPlan {
  if (target.mode === 'replace_plan') {
    return { blocks: [block] };
  }
  if (target.mode === 'append_block') {
    return { blocks: [...plan.blocks, block] };
  }
  if (!target.blockId) {
    return { blocks: [...plan.blocks, block] };
  }
  const replaced = plan.blocks.map((b) => (b.id === target.blockId ? { ...block, id: b.id } : b));
  const found = replaced.some((b) => b.id === target.blockId);
  return found ? { blocks: replaced } : { blocks: [...replaced, block] };
}
