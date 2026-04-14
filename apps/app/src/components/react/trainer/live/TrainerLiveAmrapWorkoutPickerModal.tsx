import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  AmrapWorkoutPicker,
  BuildWorkoutFlow,
  isValidAttachWorkoutInput,
  type AmrapSavedWorkoutItem,
} from '@interval-timers/amrap-workout-picker';
import { missionControlApiAuthHeaders } from '@/lib/mission-control-api-auth';
import { workoutRowToAmrapAttachParams } from '@/lib/trainer-live/amrap-workout-list-adapter';
import { parseFactoryMetabolicModeFromApi } from '@/lib/trainer-live/workout-factory-metabolic-mode';
import { mapFeaturedRowsToPickerItems } from '@/lib/trainer-live/featured-workouts-picker-adapter';
import { useFeaturedWorkoutsQuery } from '@/hooks/useFeaturedWorkouts';

/** Same focusable query as ExerciseDetailModal / WorkoutSummaryModal (no shared util in repo). */
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

export interface TrainerLiveAmrapWorkoutPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Bump when opening the modal so the picker resets to the protocol step */
  pickerKey: number;
  /** While attach RPC runs */
  disabled?: boolean;
  /** Called when user completes preset or General AMRAP; parent runs attach */
  onWorkoutChosen: (workoutList: string[], durationMinutes: number) => void | Promise<void>;
  /**
   * When set with valid exercises + duration, opens the General AMRAP builder first (session plan).
   * Trainer can switch to the full protocol / library via Back or the secondary control.
   */
  initialAmrapPrefill?: { durationMinutes: number; workoutList: string[] } | null;
}

export default function TrainerLiveAmrapWorkoutPickerModal({
  open,
  onOpenChange,
  pickerKey,
  disabled = false,
  onWorkoutChosen,
  initialAmrapPrefill = null,
}: TrainerLiveAmrapWorkoutPickerModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const savedFocusRef = useRef<HTMLElement | null>(null);
  const [savedLibrary, setSavedLibrary] = useState<AmrapSavedWorkoutItem[] | undefined>(undefined);
  const [savedLibraryLoading, setSavedLibraryLoading] = useState(false);
  /** Skip session-plan pre-fill and show the full AmrapWorkoutPicker (levels / saved library). */
  const [fullProtocolPicker, setFullProtocolPicker] = useState(false);

  const featuredQuery = useFeaturedWorkoutsQuery('trainer_live_amrap', { enabled: open });
  const featuredPickerItems = useMemo(
    () => mapFeaturedRowsToPickerItems(featuredQuery.rows, savedLibrary),
    [featuredQuery.rows, savedLibrary]
  );

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) return;
    setFullProtocolPicker(false);
  }, [open, pickerKey]);

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
    const t = window.setTimeout(() => {
      const root = panelRef.current;
      if (!root) return;
      const focusable = getFocusableElements(root);
      focusable[0]?.focus();
    }, 100);
    return () => window.clearTimeout(t);
  }, [open, pickerKey]);

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
          .filter((x) => x.id && x.mode === 'amrap_density')
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

  if (!open) return null;

  const showSessionPlanBuilder =
    !fullProtocolPicker &&
    initialAmrapPrefill != null &&
    isValidAttachWorkoutInput(initialAmrapPrefill.durationMinutes, initialAmrapPrefill.workoutList);

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
        aria-labelledby="trainer-live-amrap-picker-title"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-[#0d0500] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="trainer-live-amrap-picker-title"
          className="mb-4 font-heading text-lg font-bold text-white"
        >
          {showSessionPlanBuilder ? 'AMRAP from session plan' : 'Choose AMRAP workout'}
        </h2>
        {showSessionPlanBuilder ? (
          <>
            <p className="mb-4 text-xs text-white/55">
              Edit duration and exercises, or switch to levels and your saved library.
            </p>
            <BuildWorkoutFlow
              key={pickerKey}
              planKey={pickerKey}
              initialPlan={initialAmrapPrefill}
              backFromBuilderTargetsProtocol
              onComplete={(durationMinutes, workoutList) => {
                void onWorkoutChosen(workoutList, durationMinutes);
              }}
              onBack={() => setFullProtocolPicker(true)}
              disabled={disabled}
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => setFullProtocolPicker(true)}
              className="border-orange-light/35 bg-orange-light/10 hover:bg-orange-light/15 mt-4 w-full rounded-lg border py-2 text-sm text-orange-light disabled:opacity-40"
            >
              Browse levels &amp; saved workouts
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={disabled}
              className="mt-3 w-full text-sm font-medium text-white/60 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <p className="mb-4 text-xs text-white/55">
              Only workouts generated in Workout Factory as{' '}
              <span className="text-white/80">Density AMRAP</span> appear here.
            </p>
            <AmrapWorkoutPicker
              key={pickerKey}
              disabled={disabled}
              onCancel={() => handleClose()}
              onSelect={(workoutList, durationMinutes) => {
                void onWorkoutChosen(workoutList, durationMinutes);
              }}
              featuredSavedWorkouts={featuredPickerItems}
              featuredSavedWorkoutsLoading={open && featuredQuery.loading}
              savedWorkouts={savedLibraryLoading ? undefined : savedLibrary}
              onConfirmSavedWorkout={(item, durationMinutes) => {
                try {
                  const p = workoutRowToAmrapAttachParams({
                    blocks: item.blocks,
                    durationMinutes,
                  });
                  void onWorkoutChosen(p.workoutList, p.durationMinutes);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Could not use this workout');
                }
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
