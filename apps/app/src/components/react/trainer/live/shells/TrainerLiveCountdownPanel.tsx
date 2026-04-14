import { useEffect, useRef, useState } from 'react';

const PRESETS_SEC = [60, 120, 180, 300] as const;

function formatMmSs(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * P2: Countdown is local only — not synchronized across participants.
 * Clients see a static placeholder until P3 adds Realtime/RPC state.
 */
export default function TrainerLiveCountdownPanel({ variant }: { variant: 'trainer' | 'client' }) {
  const [durationSec, setDurationSec] = useState(180);
  const [remainingSec, setRemainingSec] = useState(180);
  const [running, setRunning] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running || variant !== 'trainer') {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    tickRef.current = setInterval(() => {
      setRemainingSec((r) => {
        if (r <= 1) {
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [running, variant]);

  const applyDuration = (sec: number) => {
    const n = Math.max(1, Math.min(3599, Math.floor(sec)));
    setDurationSec(n);
    if (!running) setRemainingSec(n);
  };

  if (variant === 'client') {
    return (
      <div
        className="rounded-2xl border border-white/15 bg-white/5 p-4 text-white md:p-6"
        data-region="trainer-live-simple-countdown-interval"
      >
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-orange-light">
          Countdown
        </p>
        <p className="mb-4 font-mono text-4xl tabular-nums tracking-tight md:text-5xl">--:--</p>
        <p className="text-sm text-white/55">
          Timer is trainer-controlled. Times are not live-synced in this version — follow your
          trainer&apos;s cue.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-white/15 bg-white/5 p-4 text-white md:p-6"
      data-region="trainer-live-simple-countdown-interval"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-orange-light">
        Countdown
      </p>
      <p className="mb-4 text-center font-mono text-5xl tabular-nums tracking-tight md:text-6xl">
        {formatMmSs(remainingSec)}
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        {PRESETS_SEC.map((sec) => (
          <button
            key={sec}
            type="button"
            disabled={running}
            onClick={() => applyDuration(sec)}
            className="rounded-lg border border-white/20 px-2 py-1 text-xs hover:bg-white/10 disabled:opacity-40"
          >
            {sec / 60}m
          </button>
        ))}
      </div>
      <label className="mb-4 block text-xs uppercase tracking-wider text-white/45">
        Seconds
        <input
          type="number"
          min={1}
          max={3599}
          disabled={running}
          value={durationSec}
          onChange={(e) => applyDuration(Number(e.target.value) || 1)}
          className="mt-1 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 font-mono text-white disabled:opacity-40"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setRunning(true)}
          disabled={running || remainingSec <= 0}
          className="rounded-xl bg-orange-light px-4 py-2 text-sm font-bold uppercase text-black hover:bg-white disabled:opacity-40"
        >
          Start
        </button>
        <button
          type="button"
          onClick={() => setRunning(false)}
          disabled={!running}
          className="rounded-xl border border-white/25 px-4 py-2 text-sm font-semibold uppercase hover:bg-white/10 disabled:opacity-40"
        >
          Pause
        </button>
        <button
          type="button"
          onClick={() => {
            setRunning(false);
            setRemainingSec(durationSec);
          }}
          className="rounded-xl border border-white/25 px-4 py-2 text-sm font-semibold uppercase hover:bg-white/10"
        >
          Reset
        </button>
      </div>
      <p className="mt-4 text-xs text-white/40">
        P2: not synced to clients — each device has its own clock until a future release.
      </p>
    </div>
  );
}
