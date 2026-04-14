import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { missionControlApiAuthHeaders } from '@/lib/mission-control-api-auth';
import { savedWorkoutRowToSessionPlan } from '@/lib/trainer-live/session-workout-plan/importSavedWorkout';
import type {
  SessionWorkoutPlanBlock,
  SessionWorkoutPlanBlockKind,
  TrainerLiveSessionWorkoutPlan,
} from '@/lib/trainer-live/session-workout-plan/types';
import { createSessionWorkoutPlanBlockId } from '@/lib/trainer-live/session-workout-plan/types';

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
  disabled = false,
  showImportSaved = true,
  compact = false,
}: {
  plan: TrainerLiveSessionWorkoutPlan;
  onChange: (next: TrainerLiveSessionWorkoutPlan) => void;
  disabled?: boolean;
  showImportSaved?: boolean;
  /** When timer is running, use tighter spacing */
  compact?: boolean;
}) {
  const [addKind, setAddKind] = useState<SessionWorkoutPlanBlockKind>('warmup');
  const [importBusy, setImportBusy] = useState(false);

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
  }, [addKind, onChange, plan.blocks]);

  const clearPlan = useCallback(() => {
    onChange({ blocks: [] });
  }, [onChange]);

  const importSaved = useCallback(async () => {
    setImportBusy(true);
    try {
      const auth = await missionControlApiAuthHeaders();
      const r = await fetch('/api/trainer/workouts', {
        credentials: 'include',
        headers: { ...auth },
      });
      const raw: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        const body = raw && typeof raw === 'object' ? (raw as { error?: string }) : {};
        const msg =
          typeof body.error === 'string' && body.error.trim()
            ? body.error.trim()
            : 'Could not load saved workouts';
        toast.error(msg);
        return;
      }
      const arr = Array.isArray(raw) ? raw : [];
      if (arr.length === 0) {
        toast.message('No saved workouts in your library.');
        return;
      }
      const first = arr[0] as {
        id?: string;
        title?: string;
        blocks?: unknown;
        durationMinutes?: number | null;
      };
      const imported = savedWorkoutRowToSessionPlan(first);
      if (imported.blocks.length === 0) {
        toast.error('That workout has no exercises to import.');
        return;
      }
      onChange(imported);
      toast.success('Loaded exercises into plan (AMRAP block). Edit or add blocks as needed.');
    } catch {
      toast.error('Could not import workout.');
    } finally {
      setImportBusy(false);
    }
  }, [onChange]);

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
              disabled={disabled || importBusy}
              onClick={() => void importSaved()}
              className="rounded border border-white/15 px-2 py-0.5 text-[10px] text-white/80 hover:bg-white/10 disabled:opacity-40"
            >
              {importBusy ? 'Loading…' : 'Load saved'}
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

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[10px] text-white/45">
          Add block
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
          className="border-orange-light/35 bg-orange-light/10 hover:bg-orange-light/15 rounded-lg border px-2 py-1 text-xs text-orange-light disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
}
