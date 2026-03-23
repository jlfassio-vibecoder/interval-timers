/**
 * Host-only: pick duration for synced free-workout countdown (post-recap segment).
 */
import { useState } from 'react';
import { X } from 'lucide-react';

const PRESETS_MIN = [5, 10, 15, 20] as const;
const MAX_MIN = 120;

export interface FreeWorkoutTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (durationSec: number) => void | Promise<void>;
}

export default function FreeWorkoutTimerModal({
  isOpen,
  onClose,
  onStart,
}: FreeWorkoutTimerModalProps) {
  const [customMin, setCustomMin] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const parseCustom = (): number | null => {
    const n = parseInt(customMin.trim(), 10);
    if (Number.isNaN(n) || n < 1 || n > MAX_MIN) return null;
    return n;
  };

  const handlePreset = async (min: number) => {
    setBusy(true);
    try {
      await onStart(min * 60);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleCustomStart = async () => {
    const min = parseCustom();
    if (min == null) return;
    setBusy(true);
    try {
      await onStart(min * 60);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="free-workout-modal-title"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0500] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => !busy && onClose()}
          className="absolute right-3 top-3 rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 id="free-workout-modal-title" className="mb-2 pr-8 text-xl font-bold text-white">
          Free workout timer
        </h2>
        <p className="mb-4 text-sm text-white/70">
          Everyone sees the same countdown. Lead by example — no AMRAP rounds logged during this
          segment.
        </p>
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-white/50">Quick start</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {PRESETS_MIN.map((min) => (
            <button
              key={min}
              type="button"
              disabled={busy}
              onClick={() => handlePreset(min)}
              className="rounded-xl border border-orange-500/50 bg-orange-600/20 px-4 py-2 text-sm font-bold text-orange-200 transition-colors hover:bg-orange-600/40 disabled:opacity-50"
            >
              {min} min
            </button>
          ))}
        </div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">
          Custom (1–{MAX_MIN} min)
        </p>
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            max={MAX_MIN}
            value={customMin}
            onChange={(e) => setCustomMin(e.target.value)}
            placeholder="Minutes"
            className="min-w-0 flex-1 rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-white placeholder:text-white/40"
          />
          <button
            type="button"
            disabled={busy || parseCustom() == null}
            onClick={handleCustomStart}
            className="rounded-xl border-2 border-orange-500 bg-orange-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
}
