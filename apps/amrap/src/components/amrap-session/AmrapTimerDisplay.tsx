/**
 * Shared AMRAP timer display. Renders phase label, title, subtext, and time value.
 * Used by both Solo and Social session views.
 */
import React from 'react';

export type AmrapTimerPhase = 'waiting' | 'setup' | 'work' | 'finished';

export interface AmrapTimerDisplayProps {
  phase: AmrapTimerPhase;
  displayLabel: string;
  displayTitle: string;
  displaySub?: string;
  displayValue: string;
  /** When true, uses compact text styling (e.g. for scheduled/countdown display) */
  beforeCountdownWindow?: boolean;
  showStartButton?: boolean;
  onStart?: () => void;
  /** Optional wrapper className (e.g. for bg color) */
  containerClassName?: string;
  /** Optional content to render below the timer value (e.g. work phase controls, "Work complete") */
  children?: React.ReactNode;
  /**
   * When set (or with `stackStartWithClockAside`), renders a row: left column | label+clock | right column.
   * Used for Trainer Live embed so actions sit left of the clock digits.
   */
  clockAsideLeft?: React.ReactNode;
  clockAsideRight?: React.ReactNode;
  /** When true with `showStartButton`, renders Start in the left column above `clockAsideLeft`. */
  stackStartWithClockAside?: boolean;
}

function getTimerBg(phase: AmrapTimerPhase): string {
  switch (phase) {
    case 'setup':
      return 'bg-stone-800';
    case 'work':
      return 'bg-orange-600';
    case 'finished':
      return 'bg-stone-900';
    default:
      return 'bg-stone-800';
  }
}

export default function AmrapTimerDisplay({
  phase,
  displayLabel,
  displayTitle,
  displaySub,
  displayValue,
  beforeCountdownWindow = false,
  showStartButton = false,
  onStart,
  containerClassName,
  children,
  clockAsideLeft,
  clockAsideRight,
  stackStartWithClockAside = false,
}: AmrapTimerDisplayProps) {
  const bg = containerClassName ?? getTimerBg(phase);
  const isTimeValue = /^\d{1,2}:\d{2}$/.test(displayValue);

  const useClockAsideRow =
    clockAsideLeft != null ||
    clockAsideRight != null ||
    (stackStartWithClockAside && showStartButton);

  const startButtonEl =
    showStartButton && onStart ? (
      <button
        type="button"
        onClick={onStart}
        className="mt-8 w-full max-w-[14rem] rounded-2xl bg-orange-600 px-[4.5rem] py-6 text-[1.875rem] font-bold text-white shadow-[0_0_40px_rgba(234,88,12,0.4)] hover:bg-orange-500"
      >
        Start
      </button>
    ) : null;

  const labelAndClock = (
    <div className="flex w-full flex-col items-center text-center">
      <div className="mb-2 text-[15px] font-bold uppercase tracking-widest opacity-80">
        {displayLabel}
      </div>
      <div
        className={`w-full overflow-hidden min-w-0 font-bold tabular-nums ${
          beforeCountdownWindow
            ? 'text-[2.25rem] text-white/90 md:text-[2.8125rem]'
            : `font-mono ${phase === 'work' ? 'text-orange-500' : 'text-white/90'}`
        }`}
        style={!beforeCountdownWindow ? { containerType: 'inline-size' } : undefined}
      >
        {beforeCountdownWindow ? (
          displayValue
        ) : (
          <span
            style={
              isTimeValue
                ? { fontSize: 'clamp(2rem, min(15cqw, 15cqh), 9rem)' }
                : undefined
            }
            className={!isTimeValue ? 'text-[clamp(1.5rem,5vmin,4rem)]' : undefined}
          >
            {displayValue}
          </span>
        )}
      </div>
      {!(stackStartWithClockAside && showStartButton) && startButtonEl}
    </div>
  );

  const mainClockArea = (
    <div className="flex h-full w-full flex-col items-center justify-between">
      {labelAndClock}
      {children && <div className="mt-0 w-full flex-grow">{children}</div>}
    </div>
  );

  return (
    <div
      className={`rounded-2xl border border-white/10 ${bg} p-6 transition-colors duration-300`}
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-2xl font-bold">{displayTitle}</h2>
        {displaySub ? (
          <p className="text-right text-sm font-medium opacity-90">{displaySub}</p>
        ) : (
          <span />
        )}
      </div>

      {useClockAsideRow ? (
        <div className="mt-8 grid w-full grid-cols-4 items-start gap-4 sm:gap-6">
          <div className="col-span-1 flex min-h-0 min-w-0 flex-col items-center justify-start gap-3 text-left">
            {stackStartWithClockAside && showStartButton && onStart && (
              <button
                type="button"
                onClick={onStart}
                className="w-full max-w-[14rem] rounded-2xl bg-orange-600 px-6 py-5 text-lg font-bold text-white shadow-[0_0_40px_rgba(234,88,12,0.4)] hover:bg-orange-500 sm:py-6 sm:text-xl"
              >
                Start
              </button>
            )}
            {clockAsideLeft}
          </div>
          <div className="col-span-2 min-w-0 flex flex-col justify-start self-stretch">
            {mainClockArea}
          </div>
          {clockAsideRight != null ? (
            <div className="col-span-1 flex h-full min-w-0 flex-col items-center justify-start">
              {clockAsideRight}
            </div>
          ) : (
            <div className="col-span-1 min-w-0" aria-hidden />
          )}
        </div>
      ) : (
        <div className="mt-8 text-center">
          {mainClockArea}
        </div>
      )}
    </div>
  );
}
