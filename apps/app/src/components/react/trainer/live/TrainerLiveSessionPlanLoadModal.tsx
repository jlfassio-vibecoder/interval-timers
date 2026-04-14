import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { missionControlApiAuthHeaders } from '@/lib/mission-control-api-auth';
import { parseFactoryMetabolicModeFromApi } from '@/lib/trainer-live/workout-factory-metabolic-mode';
import {
  applyImportedBlockToPlan,
  getSystemPresetsForKind,
  isLibraryRowCompatibleWithKind,
  mapLibraryRowToBlock,
  type SessionPlanImportMode,
  type SessionPlanImportTarget,
  type SessionPlanLibraryRow,
} from '@/lib/trainer-live/session-workout-plan/sessionPlanImport';
import type { SessionWorkoutPlanBlockKind, TrainerLiveSessionWorkoutPlan } from '@/lib/trainer-live/session-workout-plan/types';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

export interface TrainerLiveSessionPlanLoadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  plan: TrainerLiveSessionWorkoutPlan;
  targetKind: SessionWorkoutPlanBlockKind;
  targetBlockId?: string;
  defaultMode: SessionPlanImportMode;
  onImported: (next: TrainerLiveSessionWorkoutPlan, importedBlockId?: string) => void;
}

export default function TrainerLiveSessionPlanLoadModal({
  open,
  onOpenChange,
  disabled = false,
  plan,
  targetKind,
  targetBlockId,
  defaultMode,
  onImported,
}: TrainerLiveSessionPlanLoadModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const savedFocusRef = useRef<HTMLElement | null>(null);
  const [library, setLibrary] = useState<SessionPlanLibraryRow[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [mode, setMode] = useState<SessionPlanImportMode>(defaultMode);

  const presets = useMemo(() => getSystemPresetsForKind(targetKind), [targetKind]);
  const compatibleLibrary = useMemo(
    () => library.filter((row) => isLibraryRowCompatibleWithKind(targetKind, row)),
    [library, targetKind]
  );
  const modeLocked = defaultMode === 'replace_block';

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) return;
    setMode(defaultMode);
  }, [open, defaultMode]);

  useEffect(() => {
    if (!open) return;
    savedFocusRef.current = document.activeElement as HTMLElement | null;
    return () => {
      const el = savedFocusRef.current;
      if (el && typeof el.focus === 'function' && document.contains(el)) el.focus();
      savedFocusRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      const root = panelRef.current;
      if (!root) return;
      getFocusableElements(root)[0]?.focus();
    }, 100);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setLibrary([]);
      return;
    }
    let cancelled = false;
    setLibraryLoading(true);
    void (async () => {
      try {
        const auth = await missionControlApiAuthHeaders();
        const r = await fetch('/api/trainer/workouts', {
          credentials: 'include',
          headers: { ...auth },
        });
        const raw: unknown = await r.json().catch(() => null);
        if (cancelled) return;
        if (!r.ok) {
          const body = raw && typeof raw === 'object' ? (raw as { error?: string }) : {};
          const msg =
            typeof body.error === 'string' && body.error.trim()
              ? body.error.trim()
              : 'Could not load saved workouts';
          toast.error(msg);
          setLibrary([]);
          return;
        }
        const arr = Array.isArray(raw) ? raw : [];
        const rows: SessionPlanLibraryRow[] = arr
          .map((row: unknown) => {
            const o = row as {
              id?: string;
              title?: string;
              blocks?: unknown;
              durationMinutes?: number | null;
              factoryMetabolicMode?: unknown;
            };
            return {
              id: typeof o.id === 'string' ? o.id : '',
              title: typeof o.title === 'string' && o.title.trim() ? o.title : 'Workout',
              blocks: o.blocks,
              durationMinutes:
                typeof o.durationMinutes === 'number' && Number.isFinite(o.durationMinutes)
                  ? o.durationMinutes
                  : null,
              factoryMetabolicMode: parseFactoryMetabolicModeFromApi(o.factoryMetabolicMode),
            };
          })
          .filter((x) => x.id);
        setLibrary(rows);
      } catch {
        if (!cancelled) setLibrary([]);
      } finally {
        if (!cancelled) setLibraryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!disabled) handleClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = panelRef.current;
      if (!root) return;
      const focusable = getFocusableElements(root);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, disabled, handleClose]);

  const chosenMode = modeLocked ? 'replace_block' : mode;

  const applyBlock = useCallback(
    (block: ReturnType<typeof mapLibraryRowToBlock>) => {
      if (!block) {
        toast.error('That workout has no exercises to import.');
        return;
      }
      const target: SessionPlanImportTarget = {
        kind: targetKind,
        mode: chosenMode,
        ...(targetBlockId ? { blockId: targetBlockId } : {}),
      };
      const next = applyImportedBlockToPlan(plan, block, target);
      onImported(next, block.id);
      handleClose();
    },
    [chosenMode, handleClose, onImported, plan, targetBlockId, targetKind]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center p-4"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && !disabled && handleClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trainer-live-load-title"
        className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/15 bg-[#0d0500] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="trainer-live-load-title" className="mb-2 font-heading text-lg font-bold text-white">
          Load saved {targetKind}
        </h2>
        <p className="mb-4 text-xs text-white/55">
          Import a system preset or one of your library workouts into the session plan.
        </p>

        <label className="mb-4 block text-[10px] font-semibold uppercase tracking-wider text-white/45">
          Import mode
          <select
            value={chosenMode}
            disabled={disabled || modeLocked}
            onChange={(e) => setMode(e.target.value as SessionPlanImportMode)}
            className="mt-1 w-full rounded border border-white/15 bg-black/40 px-2 py-1 text-xs text-white"
          >
            <option value="replace_plan">Replace whole plan</option>
            <option value="append_block">Append new block</option>
            <option value="replace_block">Replace selected block</option>
          </select>
        </label>

        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/45">
          System presets
        </div>
        <ul className="mb-5 space-y-1">
          {presets.map((preset) => (
            <li key={preset.id}>
              <button
                type="button"
                disabled={disabled || !preset.available}
                onClick={() => applyBlock(preset.buildBlock())}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="block">{preset.label}</span>
                <span className="text-xs text-white/50">{preset.description}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/45">
          Your library
        </div>
        {libraryLoading ? (
          <p className="text-xs text-white/50">Loading…</p>
        ) : compatibleLibrary.length === 0 ? (
          <p className="text-xs text-white/45">No compatible saved workouts found.</p>
        ) : (
          <ul className="max-h-[35vh] space-y-1 overflow-y-auto pr-1">
            {compatibleLibrary.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => applyBlock(mapLibraryRowToBlock(targetKind, row))}
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-left text-sm text-white/90 hover:bg-white/10 disabled:opacity-40"
                >
                  {row.title}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            disabled={disabled}
            onClick={handleClose}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
