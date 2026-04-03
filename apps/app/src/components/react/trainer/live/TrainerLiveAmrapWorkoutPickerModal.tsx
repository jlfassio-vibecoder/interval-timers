import { useCallback, useEffect, useRef } from 'react';
import { AmrapWorkoutPicker } from '@interval-timers/amrap-workout-picker';

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
}

export default function TrainerLiveAmrapWorkoutPickerModal({
  open,
  onOpenChange,
  pickerKey,
  disabled = false,
  onWorkoutChosen,
}: TrainerLiveAmrapWorkoutPickerModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const savedFocusRef = useRef<HTMLElement | null>(null);

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
          Choose AMRAP workout
        </h2>
        <AmrapWorkoutPicker
          key={pickerKey}
          disabled={disabled}
          onCancel={() => handleClose()}
          onSelect={(workoutList, durationMinutes) => {
            void onWorkoutChosen(workoutList, durationMinutes);
          }}
        />
      </div>
    </div>
  );
}
