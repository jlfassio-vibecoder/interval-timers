/**
 * Shared AMRAP work-phase controls: rounds display and LOG ROUND button.
 * Used by both Solo and Social session views.
 */
import React from 'react';

export interface AmrapWorkPhaseControlsProps {
  roundsCount: number;
  logRoundError: string | null;
  timerState: 'setup' | 'work' | 'finished';
  onLogRound: () => void;
  /** Optional content between rounds count and LOG ROUND button (e.g. exercise list) */
  children?: React.ReactNode;
}

export default function AmrapWorkPhaseControls({
  roundsCount,
  logRoundError,
  timerState,
  onLogRound,
  children,
}: AmrapWorkPhaseControlsProps) {
  if (timerState !== 'setup' && timerState !== 'work') {
    return null;
  }

  return (
    <div className="mt-8 flex flex-col items-center">
      <div className="mb-4 text-[1.3125rem] font-bold uppercase tracking-widest text-white/60">
        Your rounds
      </div>
      <div className="mb-4 text-[3.375rem] font-bold text-white">{roundsCount}</div>
      {children}
      {timerState === 'work' && (
        <>
          {logRoundError && (
            <p className="mb-2 text-[1.3125rem] text-red-400">{logRoundError}</p>
          )}
          <button
            type="button"
            onClick={onLogRound}
            className="rounded-2xl border-2 border-orange-400 bg-orange-600 px-[4.5rem] py-9 text-[1.875rem] font-bold text-white shadow-[0_0_40px_rgba(234,88,12,0.4)] transition-all hover:bg-orange-500 active:scale-95"
          >
            LOG ROUND
          </button>
        </>
      )}
    </div>
  );
}
