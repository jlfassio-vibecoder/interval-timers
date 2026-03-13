import { useState, useEffect } from 'react';

export interface TimerViewProps {
  endTime: number;
  onStartScan: () => void;
}

function formatElapsed(ms: number): string {
  const elapsed = Math.floor(ms / 1000);
  const m = Math.floor(elapsed / 60)
    .toString()
    .padStart(2, '0');
  const s = (elapsed % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function TimerView({ endTime, onStartScan }: TimerViewProps) {
  const [clock, setClock] = useState(() => Date.now() - endTime);

  useEffect(() => {
    const id = setInterval(() => {
      setClock(Date.now() - endTime);
    }, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  return (
    <section className="view-section">
      <header className="text-center mt-8 mb-auto">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-darkest/80 text-orange-light mb-4 text-2xl">
          🔗
        </div>
        <h1 className="text-2xl font-black tracking-tight">Session Synced</h1>
        <p className="text-zinc-400 text-sm mt-2">Ready to record recovery metrics.</p>
      </header>

      <div className="text-center my-12">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">
          Time Since Workout Ended
        </p>
        <div className="text-6xl font-black font-mono text-orange-light tracking-tighter">
          {formatElapsed(clock)}
        </div>
      </div>

      <div className="mt-auto pb-8 space-y-4">
        <button
          type="button"
          onClick={onStartScan}
          className="w-full py-5 bg-orange text-white rounded-2xl font-black text-xl shadow-[0_0_20px_rgba(234,88,12,0.4)] active:scale-95 transition-transform min-h-[48px] hover:bg-orange-medium"
        >
          START HR SCAN
        </button>
        <p className="text-center text-xs text-zinc-500">
          Place finger over rear camera. On iPhone, turn on flashlight from Control Center first.
        </p>
      </div>
    </section>
  );
}
