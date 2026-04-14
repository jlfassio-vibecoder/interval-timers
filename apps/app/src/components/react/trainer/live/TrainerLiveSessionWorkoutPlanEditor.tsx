import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { SessionPlanImportMode } from '@/lib/trainer-live/session-workout-plan/sessionPlanImport';
import type {
  SessionWorkoutPlanBlock,
  SessionWorkoutPlanBlockKind,
  TrainerLiveSessionWorkoutPlan,
} from '@/lib/trainer-live/session-workout-plan/types';
import { createSessionWorkoutPlanBlockId } from '@/lib/trainer-live/session-workout-plan/types';
import TrainerLiveSessionPlanLoadModal from './TrainerLiveSessionPlanLoadModal';

const BLOCK_KINDS: { kind: SessionWorkoutPlanBlockKind; label: string }[] = [
  { kind: 'warmup', label: 'Warm-up' },
  { kind: 'amrap', label: 'AMRAP' },
  { kind: 'tabata', label: 'Tabata' },
  { kind: 'emom', label: 'EMOM' },
  { kind: 'cooldown', label: 'Cooldown' },
];

function createEmptyBlock(kind: SessionWorkoutPlanBlockKind): SessionWorkoutPlanBlock {
  const id = createSessionWorkoutPlanBlockId();
  switch (kind) {
    case 'warmup':
      return { id, kind: 'warmup', exercises: [] };
    case 'cooldown':
      return { id, kind: 'cooldown', exercises: [] };
    case 'amrap':
      return { id, kind: 'amrap', durationMinutes: 15, exercises: [] };
    case 'tabata':
      return { id, kind: 'tabata', roundCount: 8, exercises: [] };
    case 'emom':
      return { id, kind: 'emom', roundCount: 10, exercises: [] };
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function exercisesToText(exercises: string[]): string {
  return exercises.join('\n');
}

/**
 * Split lines for storage without trimming — trimming on every `onChange` removed spaces between
 * words while typing (e.g. "Neck␠" became "Neck" immediately).
 */
function linesFromExerciseText(text: string): string[] {
  return text.replace(/\r\n/g, '\n').split('\n');
}

export default function TrainerLiveSessionWorkoutPlanEditor({
  plan,
  onChange,
  onImportedBlock,
  disabled = false,
  showImportSaved = true,
  compact = false,
}: {
  plan: TrainerLiveSessionWorkoutPlan;
  onChange: (next: TrainerLiveSessionWorkoutPlan) => void;
  onImportedBlock?: (kind: SessionWorkoutPlanBlockKind, blockId: string) => void;
  disabled?: boolean;
  showImportSaved?: boolean;
  /** When timer is running, use tighter spacing */
  compact?: boolean;
}) {
  const [addKind, setAddKind] = useState<SessionWorkoutPlanBlockKind>('warmup');
  const [loadOpen, setLoadOpen] = useState(false);
  const [loadKind, setLoadKind] = useState<SessionWorkoutPlanBlockKind>('warmup');
  const [loadBlockId, setLoadBlockId] = useState<string | undefined>(undefined);
  const [loadDefaultMode, setLoadDefaultMode] = useState<SessionPlanImportMode>('append_block');
  const [sessionComplete, setSessionComplete] = useState(false);

  const updateBlock = useCallback(
    (id: string, fn: (b: SessionWorkoutPlanBlock) => SessionWorkoutPlanBlock) => {
      onChange({
        blocks: plan.blocks.map((b) => (b.id === id ? fn(b) : b)),
      });
    },
    [onChange, plan.blocks]
  );

  const move = useCallback(
    (index: number, dir: -1 | 1) => {
      const j = index + dir;
      if (j < 0 || j >= plan.blocks.length) return;
      const next = [...plan.blocks];
      const t = next[index]!;
      next[index] = next[j]!;
      next[j] = t;
      onChange({ blocks: next });
    },
    [onChange, plan.blocks]
  );

  const remove = useCallback(
    (id: string) => {
      onChange({ blocks: plan.blocks.filter((b) => b.id !== id) });
    },
    [onChange, plan.blocks]
  );

  const addBlock = useCallback(() => {
    onChange({ blocks: [...plan.blocks, createEmptyBlock(addKind)] });
    setSessionComplete(false);
  }, [addKind, onChange, plan.blocks]);

  const clearPlan = useCallback(() => {
    onChange({ blocks: [] });
    setSessionComplete(false);
  }, [onChange]);

  const openGlobalLoad = useCallback(() => {
    setLoadKind(addKind);
    setLoadBlockId(undefined);
    setLoadDefaultMode(plan.blocks.length === 0 ? 'replace_plan' : 'append_block');
    setLoadOpen(true);
  }, [addKind, plan.blocks.length]);

  const openBlockLoad = useCallback((block: SessionWorkoutPlanBlock) => {
    setLoadKind(block.kind);
    setLoadBlockId(block.id);
    setLoadDefaultMode('replace_block');
    setLoadOpen(true);
  }, []);

  useEffect(() => {
    if (plan.blocks.length === 0) setSessionComplete(false);
  }, [plan.blocks.length]);

  return (
    <div
      className={`rounded-xl border border-white/10 bg-black/40 ${compact ? 'px-2 py-2' : 'px-3 py-3'}`}
      data-region="trainer-live-session-workout-plan-editor"
      data-testid="trainer-live-session-workout-plan-editor"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
            Session workout plan
          </div>
          <p className="text-xs text-white/45">
            Optional. Pre-fills block dialogs when you start segments. Clear to use empty pickers.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {showImportSaved ? (
            <button
              type="button"
              disabled={disabled}
              onClick={openGlobalLoad}
              className="rounded border border-white/15 px-2 py-0.5 text-[10px] text-white/80 hover:bg-white/10 disabled:opacity-40"
            >
              Load saved
            </button>
          ) : null}
          <button
            type="button"
            disabled={disabled || plan.blocks.length === 0}
            onClick={clearPlan}
            className="rounded border border-white/15 px-2 py-0.5 text-[10px] text-amber-200/90 hover:bg-white/10 disabled:opacity-40"
          >
            Clear plan
          </button>
        </div>
      </div>

      {plan.blocks.length === 0 ? (
        <p className="text-xs text-white/40">No blocks yet. Add a block or load a saved workout.</p>
      ) : (
        <ul className="mb-2 space-y-2">
          {plan.blocks.map((b, i) => (
            <li
              key={b.id}
              className="rounded-lg border border-white/10 bg-black/30 p-2"
              data-testid={`trainer-live-plan-block-${i}`}
            >
              <div className="mb-1 flex flex-wrap items-center gap-1">
                <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-white/70">
                  {b.kind}
                </span>
                <button
                  type="button"
                  disabled={disabled || i === 0}
                  onClick={() => move(i, -1)}
                  className="rounded px-1 text-[10px] text-white/50 hover:text-white disabled:opacity-30"
                  aria-label="Move up"
                >
                  Up
                </button>
                <button
                  type="button"
                  disabled={disabled || i === plan.blocks.length - 1}
                  onClick={() => move(i, 1)}
                  className="rounded px-1 text-[10px] text-white/50 hover:text-white disabled:opacity-30"
                  aria-label="Move down"
                >
                  Down
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => openBlockLoad(b)}
                  className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-white/70 hover:bg-white/10 disabled:opacity-40"
                >
                  Load
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => remove(b.id)}
                  className="ml-auto text-[10px] text-red-300/90 hover:underline disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
              <label className="mb-1 block text-[10px] text-white/45">
                Label (optional)
                <input
                  type="text"
                  value={b.label ?? ''}
                  disabled={disabled}
                  onChange={(e) => {
                    const v = e.target.value;
                    updateBlock(b.id, (block) => ({
                      ...block,
                      label: v === '' ? undefined : v,
                    }));
                  }}
                  className="mt-0.5 w-full rounded border border-white/15 bg-black/40 px-2 py-1 text-xs text-white"
                />
              </label>
              {(b.kind === 'amrap' || b.kind === 'tabata' || b.kind === 'emom') && (
                <label className="mb-1 block text-[10px] text-white/45">
                  {b.kind === 'amrap' ? 'Duration (min)' : 'Rounds'}
                  <input
                    type="number"
                    min={1}
                    max={b.kind === 'amrap' ? 180 : b.kind === 'tabata' ? 32 : 120}
                    value={
                      b.kind === 'amrap'
                        ? b.durationMinutes
                        : b.kind === 'tabata'
                          ? b.roundCount
                          : b.roundCount
                    }
                    disabled={disabled}
                    onChange={(e) => {
                      const n = Math.round(Number.parseFloat(e.target.value));
                      updateBlock(b.id, (block) => {
                        if (block.kind === 'amrap') {
                          return {
                            ...block,
                            durationMinutes: Number.isFinite(n) ? n : block.durationMinutes,
                          };
                        }
                        if (block.kind === 'tabata' || block.kind === 'emom') {
                          return {
                            ...block,
                            roundCount: Number.isFinite(n) ? n : block.roundCount,
                          };
                        }
                        return block;
                      });
                    }}
                    className="mt-0.5 w-24 rounded border border-white/15 bg-black/40 px-2 py-1 text-xs text-white"
                  />
                </label>
              )}
              <label className="block text-[10px] text-white/45">
                Exercises (one per line)
                <textarea
                  value={exercisesToText(b.exercises)}
                  disabled={disabled}
                  onChange={(e) => {
                    const exercises = linesFromExerciseText(e.target.value);
                    updateBlock(
                      b.id,
                      (block) => ({ ...block, exercises }) as SessionWorkoutPlanBlock
                    );
                  }}
                  rows={compact ? 2 : 3}
                  className="mt-0.5 w-full resize-y rounded border border-white/15 bg-black/40 px-2 py-1 font-mono text-xs text-white"
                />
              </label>
            </li>
          ))}
        </ul>
      )}

      {sessionComplete ? (
        <div className="mt-3 rounded-lg border border-emerald-300/35 bg-emerald-300/10 p-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
            Session plan ready
          </div>
          <p className="text-[10px] text-emerald-100/90">
            Blocks are saved to this session. You can start the timer when ready.
          </p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setSessionComplete(false)}
            className="mt-2 rounded border border-emerald-200/35 px-2 py-1 text-[10px] text-emerald-100 hover:bg-emerald-200/10 disabled:opacity-40"
          >
            Edit blocks
          </button>
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-orange-light/35 bg-orange-light/5 p-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-orange-light/90">
            Add block to plan
          </div>
          <p className="mb-2 text-[10px] text-white/60">
            This creates a new block at the end of the plan. It does not edit existing blocks above.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[10px] text-white/60">
              Block type to add
              <select
                value={addKind}
                disabled={disabled}
                onChange={(e) => setAddKind(e.target.value as SessionWorkoutPlanBlockKind)}
                className="ml-1 mt-0.5 rounded border border-white/15 bg-black/40 px-2 py-1 text-xs text-white"
              >
                {BLOCK_KINDS.map(({ kind, label }) => (
                  <option key={kind} value={kind}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={disabled}
              onClick={addBlock}
              data-testid="trainer-live-plan-add-block"
              className="border-orange-light/45 bg-orange-light/15 hover:bg-orange-light/20 rounded-lg border px-2 py-1 text-xs font-semibold text-orange-light disabled:opacity-40"
            >
              + Add block
            </button>
            <span className="text-[10px] text-white/45">
              Will add: {BLOCK_KINDS.find((k) => k.kind === addKind)?.label}
            </span>
          </div>
          <button
            type="button"
            disabled={disabled || plan.blocks.length === 0}
            onClick={() => setSessionComplete(true)}
            className="mt-2 rounded border border-emerald-300/35 bg-emerald-300/10 px-2 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-300/15 disabled:opacity-40"
          >
            Session complete
          </button>
        </div>
      )}

      <TrainerLiveSessionPlanLoadModal
        open={loadOpen}
        onOpenChange={setLoadOpen}
        disabled={disabled}
        plan={plan}
        targetKind={loadKind}
        targetBlockId={loadBlockId}
        defaultMode={loadDefaultMode}
        onImported={(next, importedBlockId) => {
          onChange(next);
          if (importedBlockId) onImportedBlock?.(loadKind, importedBlockId);
          toast.success(`Loaded ${loadKind} into session plan.`);
        }}
      />
    </div>
  );
}
