import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { AmrapSavedWorkoutItem } from '@interval-timers/amrap-workout-picker';
import { missionControlApiAuthHeaders } from '@/lib/mission-control-api-auth';
import {
  isValidTabataAttachInput,
  workoutRowToTabataAttachParams,
} from '@/lib/trainer-live/tabata-workout-list-adapter';
import { parseFactoryMetabolicModeFromApi } from '@/lib/trainer-live/workout-factory-metabolic-mode';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

export interface TrainerLiveTabataWorkoutPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pickerKey: number;
  disabled?: boolean;
  onWorkoutChosen: (workoutList: string[], roundCount: number) => void | Promise<void>;
}

export default function TrainerLiveTabataWorkoutPickerModal({
  open,
  onOpenChange,
  pickerKey,
  disabled = false,
  onWorkoutChosen,
}: TrainerLiveTabataWorkoutPickerModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const savedFocusRef = useRef<HTMLElement | null>(null);
  const [savedLibrary, setSavedLibrary] = useState<AmrapSavedWorkoutItem[] | undefined>(undefined);
  const [savedLibraryLoading, setSavedLibraryLoading] = useState(false);
  const [phase, setPhase] = useState<'list' | 'confirm'>('list');
  const [selected, setSelected] = useState<AmrapSavedWorkoutItem | null>(null);
  const [roundInput, setRoundInput] = useState('8');

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) return;
    savedFocusRef.current = document.activeElement as HTMLElement | null;
    return () => {
      const el = savedFocusRef.current;
      if (el && typeof el.focus === 'function' && document.contains(el)) {
        el.focus();
      }
      savedFocusRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setPhase('list');
    setSelected(null);
    setRoundInput('8');
  }, [open, pickerKey]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      const root = panelRef.current;
      if (!root) return;
      const focusable = getFocusableElements(root);
      focusable[0]?.focus();
    }, 100);
    return () => window.clearTimeout(t);
  }, [open, pickerKey, phase]);

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
      setSavedLibrary(undefined);
      return;
    }
    let cancelled = false;
    setSavedLibraryLoading(true);
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
          setSavedLibrary([]);
          return;
        }
        const arr = Array.isArray(raw) ? raw : [];
        const items: AmrapSavedWorkoutItem[] = arr
          .map((row: unknown) => {
            const o = row as {
              id?: string;
              title?: string;
              blocks?: unknown;
              durationMinutes?: number | null;
              source?: string;
              factoryMetabolicMode?: unknown;
            };
            const mode = parseFactoryMetabolicModeFromApi(o.factoryMetabolicMode);
            return {
              id: typeof o.id === 'string' ? o.id : '',
              title: typeof o.title === 'string' && o.title.trim() ? o.title : 'Workout',
              blocks: o.blocks,
              durationMinutes:
                typeof o.durationMinutes === 'number' && Number.isFinite(o.durationMinutes)
                  ? o.durationMinutes
                  : null,
              source: typeof o.source === 'string' ? o.source : undefined,
              mode,
            };
          })
          .filter((x) => x.id && x.mode === 'tabata_balanced')
          .map(({ id, title, blocks, durationMinutes, source }) => ({
            id,
            title,
            blocks,
            durationMinutes,
            ...(source !== undefined ? { source } : {}),
          }));
        setSavedLibrary(items);
      } catch {
        if (!cancelled) setSavedLibrary([]);
      } finally {
        if (!cancelled) setSavedLibraryLoading(false);
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

  const confirmAttach = useCallback(() => {
    if (!selected) return;
    const parsed = parseInt(roundInput, 10);
    try {
      const p = workoutRowToTabataAttachParams({
        blocks: selected.blocks,
        roundCount: Number.isFinite(parsed) ? parsed : undefined,
      });
      if (!isValidTabataAttachInput(p.roundCount, p.workoutList)) {
        toast.error('Choose 1–32 rounds and at least one exercise.');
        return;
      }
      void onWorkoutChosen(p.workoutList, p.roundCount);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not use this workout');
    }
  }, [onWorkoutChosen, roundInput, selected]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && !disabled && handleClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trainer-live-tabata-picker-title"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-[#0d0500] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="trainer-live-tabata-picker-title"
          className="mb-4 font-heading text-lg font-bold text-white"
        >
          Choose Tabata workout
        </h2>

        {phase === 'list' ? (
          <div className="space-y-3">
            <p className="text-sm text-white/70">
              Only workouts generated in Workout Factory as{' '}
              <span className="text-white/90">Balanced Tabata</span> appear here. Pick a saved workout; you
              will set the number of Tabata rounds (20s work / 10s rest) on the next step.
            </p>
            {savedLibraryLoading ? (
              <div className="py-8 text-center text-sm text-white/50">Loading workouts…</div>
            ) : !savedLibrary?.length ? (
              <div className="py-8 text-center text-sm text-white/50">No saved workouts yet.</div>
            ) : (
              <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
                {savedLibrary.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setSelected(item);
                        setPhase('confirm');
                      }}
                      className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-left text-sm text-white hover:bg-white/10 disabled:opacity-40"
                    >
                      <span className="font-medium">{item.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={disabled}
                onClick={handleClose}
                className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/90 hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-white/80">
              <span className="font-medium text-white">{selected?.title ?? 'Workout'}</span>
            </p>
            <div>
              <label htmlFor="trainer-live-tabata-rounds" className="mb-1 block text-xs text-white/60">
                Rounds (1–32)
              </label>
              <input
                id="trainer-live-tabata-rounds"
                type="number"
                min={1}
                max={32}
                value={roundInput}
                onChange={(e) => setRoundInput(e.target.value)}
                disabled={disabled}
                className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-white"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  setPhase('list');
                  setSelected(null);
                }}
                className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/90 hover:bg-white/10"
              >
                Back
              </button>
              <button
                type="button"
                disabled={disabled}
                data-testid="trainer-live-tabata-picker-confirm"
                onClick={() => void confirmAttach()}
                className="border-orange-light/50 bg-orange-light/15 hover:bg-orange-light/25 rounded-lg border px-3 py-1.5 text-sm text-orange-light"
              >
                Use for Tabata
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
