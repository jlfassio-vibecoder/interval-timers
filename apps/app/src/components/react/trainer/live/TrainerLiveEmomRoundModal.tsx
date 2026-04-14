import { useCallback, useEffect, useState } from 'react';

export interface TrainerLiveEmomRoundModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pickerKey: number;
  disabled?: boolean;
  /** Second arg is exercise lines for `p_workout_list` on begin_emom_segment. */
  onConfirm: (roundCount: number, workoutList: string[]) => void | Promise<void>;
  /** Pre-fill from session plan */
  initialEmomPrefill?: { roundCount: number; workoutList: string[] } | null;
}

function isValidEmomPrefill(roundCount: number, workoutList: unknown[]): boolean {
  if (!Number.isFinite(roundCount) || roundCount < 1 || roundCount > 120) return false;
  return Array.isArray(workoutList);
}

export default function TrainerLiveEmomRoundModal({
  open,
  onOpenChange,
  pickerKey,
  disabled = false,
  onConfirm,
  initialEmomPrefill = null,
}: TrainerLiveEmomRoundModalProps) {
  const [roundInput, setRoundInput] = useState('10');
  const [exerciseText, setExerciseText] = useState('');

  useEffect(() => {
    if (!open) return;
    if (
      initialEmomPrefill &&
      isValidEmomPrefill(initialEmomPrefill.roundCount, initialEmomPrefill.workoutList)
    ) {
      setRoundInput(String(initialEmomPrefill.roundCount));
      setExerciseText(initialEmomPrefill.workoutList.join('\n'));
    } else {
      setRoundInput('10');
      setExerciseText('');
    }
  }, [open, pickerKey, initialEmomPrefill]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSubmit = useCallback(() => {
    const n = Number.parseInt(roundInput.trim(), 10);
    if (!Number.isFinite(n) || n < 1 || n > 120) return;
    const workoutList = exerciseText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    void onConfirm(n, workoutList);
  }, [onConfirm, exerciseText, roundInput]);

  if (!open) return null;

  const titleFromPlan =
    initialEmomPrefill != null &&
    isValidEmomPrefill(initialEmomPrefill.roundCount, initialEmomPrefill.workoutList);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        aria-label="Close"
        onClick={handleClose}
      />
      <div className="animate-zoom-in relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0d0500] shadow-2xl">
        <div className="border-b border-white/10 p-6 text-center">
          <h3 className="font-display text-xl font-bold text-white">
            {titleFromPlan ? 'EMOM from session plan' : 'EMOM rounds'}
          </h3>
          <p className="mt-1 text-sm text-white/60">
            1–120 rounds; optional exercises (one per line)
          </p>
        </div>
        <div className="space-y-4 p-6">
          <label className="block text-left">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-white/50">
              Round count
            </span>
            <input
              type="number"
              min={1}
              max={120}
              value={roundInput}
              disabled={disabled}
              onChange={(e) => setRoundInput(e.target.value)}
              className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
          <label className="block text-left">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-white/50">
              Exercises (optional)
            </span>
            <textarea
              value={exerciseText}
              disabled={disabled}
              onChange={(e) => setExerciseText(e.target.value)}
              rows={5}
              className="w-full resize-y rounded-lg border border-white/20 bg-black/40 px-3 py-2 font-mono text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
        </div>
        <div className="flex gap-2 border-t border-white/10 bg-black/30 p-4">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 rounded-xl border border-white/20 py-2 text-sm font-bold text-white/80 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => void handleSubmit()}
            className="flex-1 rounded-xl bg-teal-600 py-2 text-sm font-bold text-white hover:bg-teal-500 disabled:opacity-40"
          >
            Start EMOM
          </button>
        </div>
      </div>
    </div>
  );
}
