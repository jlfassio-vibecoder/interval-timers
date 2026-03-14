import { useState, useCallback, type FormEvent } from 'react';

// Fixed upper bound for 18+ audience: 220 - 18 = 202, +3% margin. No age input in recovery flow.
const MAX_BPM = Math.round(202 * 1.03);

export interface ManualBpmViewProps {
  onSubmit: (hr: number) => void;
  onBack: () => void;
}

export default function ManualBpmView({ onSubmit, onBack }: ManualBpmViewProps) {
  const [bpm, setBpm] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const num = Number(bpm);
      if (!Number.isInteger(num) || num < 40 || num > MAX_BPM) {
        setError(`Enter a value between 40 and ${MAX_BPM}`);
        return;
      }
      setError('');
      onSubmit(num);
    },
    [bpm, onSubmit]
  );

  return (
    <section className="view-section">
      <header className="text-center mt-4 mb-8">
        <h2 className="text-xl font-black">Enter Heart Rate</h2>
        <p className="text-zinc-400 text-sm mt-1">
          Enter your resting heart rate in BPM (40–{MAX_BPM})
        </p>
      </header>
      <form onSubmit={handleSubmit} className="flex-grow flex flex-col items-center gap-6 mt-8">
        <div className="w-full max-w-[200px]">
          <input
            type="number"
            inputMode="numeric"
            min={40}
            max={MAX_BPM}
            step={1}
            value={bpm}
            onChange={(e) => {
              setBpm(e.target.value);
              setError('');
            }}
            placeholder="e.g. 72"
            className="w-full py-4 px-6 text-center text-3xl font-black font-mono bg-zinc-800 border-2 border-zinc-600 rounded-2xl text-white placeholder-zinc-500 focus:border-orange focus:outline-none"
            aria-label="Heart rate in BPM"
          />
          {error && (
            <p className="text-amber-400 text-sm mt-2 text-center" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3 w-full max-w-[200px]">
          <button
            type="submit"
            className="py-4 px-8 bg-orange text-white rounded-2xl font-black text-lg active:scale-95 transition-transform"
          >
            Submit
          </button>
          <button
            type="button"
            onClick={onBack}
            className="py-2 text-zinc-400 hover:text-orange-light text-sm font-semibold"
          >
            Back to camera
          </button>
        </div>
      </form>
    </section>
  );
}
