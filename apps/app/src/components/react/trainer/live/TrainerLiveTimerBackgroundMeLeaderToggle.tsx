import { useTrainerLiveTimerBackground } from '@/contexts/TrainerLiveTimerBackgroundContext';

/**
 * Me / Leader segmented control for AMRAP timer background video source.
 * Intended for the timer title row (left of subtitle); not absolutely positioned.
 */
export default function TrainerLiveTimerBackgroundMeLeaderToggle() {
  const { mode, setMode } = useTrainerLiveTimerBackground();

  return (
    <div
      className="pointer-events-auto flex shrink-0 gap-1 self-end rounded-lg border border-white/15 bg-black/55 p-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-lg sm:self-auto"
      data-testid="trainer-live-timer-bg-me-leader-toggle"
    >
      <button
        type="button"
        onClick={() => setMode('self')}
        className={`rounded px-2 py-1 ${mode === 'self' ? 'bg-orange-light/30 text-orange-light' : 'text-white/70 hover:bg-white/10'}`}
      >
        Me
      </button>
      <button
        type="button"
        onClick={() => setMode('leader')}
        className={`rounded px-2 py-1 ${mode === 'leader' ? 'bg-orange-light/30 text-orange-light' : 'text-white/70 hover:bg-white/10'}`}
      >
        Leader
      </button>
    </div>
  );
}
