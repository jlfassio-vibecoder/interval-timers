import { useEffect } from 'react';
import { AmrapWorkoutPicker } from '@interval-timers/amrap-workout-picker';

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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disabled) onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange, disabled]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/75"
        aria-label="Close"
        disabled={disabled}
        onClick={() => {
          if (!disabled) onOpenChange(false);
        }}
      />
      <div
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
          onCancel={() => onOpenChange(false)}
          onSelect={(workoutList, durationMinutes) => {
            void onWorkoutChosen(workoutList, durationMinutes);
          }}
        />
      </div>
    </div>
  );
}
