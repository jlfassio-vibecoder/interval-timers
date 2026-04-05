/**
 * Shared AMRAP work-phase controls: rounds display and LOG ROUND button.
 * Used by both Solo and Social session views.
 */
import React from 'react';

/** Keeps label inside the border at narrow widths (wraps at space; scales padding/type). */
const LOG_ROUND_BUTTON_CLASSES =
  'box-border w-full min-w-0 max-w-[min(14rem,100%)] rounded-2xl border-2 border-orange-400 bg-orange-600 px-3 py-4 text-center text-sm font-bold leading-tight text-white shadow-[0_0_40px_rgba(234,88,12,0.4)] transition-all hover:bg-orange-500 active:scale-95 sm:px-6 sm:py-5 sm:text-base md:px-8 md:py-6 md:text-xl lg:text-2xl';

export type AmrapWorkPhaseControlsLayout =
  | 'default'
  /** LOG ROUND + footer; pair with `embedBesideClockRounds` in `AmrapTimerDisplay` clock row */
  | 'embedBesideClockActions'
  /** Large rounds counter; right of clock in embed */
  | 'embedBesideClockRounds';

export interface AmrapWorkPhaseControlsProps {
  roundsCount: number;
  logRoundError: string | null;
  timerState: 'setup' | 'work' | 'finished';
  onLogRound: () => void;
  /** When true (free-workout segment), hide rounds count and LOG ROUND */
  hideAmrapRounds?: boolean;
  /** Optional content between rounds count and LOG ROUND button (e.g. exercise list) */
  children?: React.ReactNode;
  layout?: AmrapWorkPhaseControlsLayout;
  /** Rendered below LOG ROUND when `layout` is `embedBesideClockActions` (e.g. host pause/finish). */
  leftColumnFooter?: React.ReactNode;
}

export default function AmrapWorkPhaseControls({
  roundsCount,
  logRoundError,
  timerState,
  onLogRound,
  hideAmrapRounds = false,
  children,
  layout = 'default',
  leftColumnFooter,
}: AmrapWorkPhaseControlsProps) {
  if (timerState !== 'setup' && timerState !== 'work') {
    return null;
  }

  if (hideAmrapRounds && timerState === 'work') {
    return (
      <div className="mt-8 flex flex-col items-center px-2 text-center">
        <p className="max-w-md text-lg text-white/85">
          Host-led exercises — use the remaining time. Follow the host; rounds are not logged in this
          segment.
        </p>
      </div>
    );
  }

  const roundsColumn = (
    <div className="flex shrink-0 flex-col items-center text-center">
      <div className="mb-1 text-xs font-bold uppercase tracking-widest text-white/60 sm:text-sm">
        Your rounds
      </div>
      <div className="text-6xl font-bold leading-none text-white tabular-nums sm:text-7xl">
        {roundsCount}
      </div>
    </div>
  );

  const logRoundColumn =
    timerState === 'work' ? (
      <>
        {logRoundError && (
          <p className="text-[1.3125rem] text-red-400">{logRoundError}</p>
        )}
        <button
          type="button"
          onClick={onLogRound}
          className={LOG_ROUND_BUTTON_CLASSES}
        >
          LOG ROUND
        </button>
      </>
    ) : null;

  if (layout === 'embedBesideClockActions') {
    return leftColumnFooter ? (
      <div className="flex w-full flex-col gap-3 text-left">
        {leftColumnFooter}
        {children}
      </div>
    ) : (
      <>{children}</>
    );
  }

  if (layout === 'embedBesideClockRounds') {
    return (
      <div className="flex w-full min-w-0 flex-col items-center gap-4">
        {roundsColumn}
        {timerState === 'work' ? (
          <div className="flex w-full flex-col items-center gap-2">
            {logRoundError && (
              <p className="text-center text-[1.3125rem] text-red-400">{logRoundError}</p>
            )}
            <button
              type="button"
              onClick={onLogRound}
              className={LOG_ROUND_BUTTON_CLASSES}
            >
              LOG ROUND
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-8 flex h-full w-full flex-col items-center justify-end">
      {logRoundColumn && (
        <div className="mb-8 w-full max-w-xs flex flex-col items-center">
          {logRoundColumn}
        </div>
      )}
      <div className="flex flex-col items-center justify-end flex-grow">
        <div className="mb-4 text-[1.3125rem] font-bold uppercase tracking-widest text-white/60">
          Your rounds
        </div>
        <div className="mb-4 text-[3.375rem] font-bold text-white">{roundsCount}</div>
      </div>
      {children}
    </div>
  );
}
