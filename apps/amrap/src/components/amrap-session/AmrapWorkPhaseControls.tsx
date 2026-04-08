/**
 * Shared AMRAP work-phase controls: rounds display and LOG ROUND button.
 * Used by both Solo and Social session views.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';

/** Keeps label inside the border at narrow widths (wraps at space; scales padding/type). */
const LOG_ROUND_BUTTON_CLASSES =
  'box-border w-full min-w-0 max-w-[min(14rem,100%)] rounded-2xl border-2 border-orange-400 bg-orange-600 px-3 py-4 text-center text-sm font-bold leading-tight text-white shadow-[0_0_40px_rgba(234,88,12,0.4)] transition-all hover:bg-orange-500 active:scale-95 disabled:pointer-events-none disabled:opacity-95 sm:px-6 sm:py-5 sm:text-base md:px-8 md:py-6 md:text-xl lg:text-2xl';

const LOG_ROUND_COOLDOWN_CLASSES =
  'border-emerald-400/90 bg-emerald-700 text-white shadow-[0_0_28px_rgba(16,185,129,0.45)] hover:bg-emerald-700';

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
  onLogRound: () => void | boolean | Promise<void | boolean | undefined>;
  /** When true (free-workout segment), hide rounds count and LOG ROUND */
  hideAmrapRounds?: boolean;
  /** Optional content between rounds count and LOG ROUND button (e.g. exercise list) */
  children?: React.ReactNode;
  layout?: AmrapWorkPhaseControlsLayout;
  /** Rendered below LOG ROUND when `layout` is `embedBesideClockActions` (e.g. host pause/finish). */
  leftColumnFooter?: React.ReactNode;
  /**
   * Live/social only: +1 rounds display until realtime confirms (solo skips — parent updates count synchronously).
   */
  optimisticLogRoundCount?: boolean;
}

const EMBED_LOG_ROUND_BASE =
  'box-border w-full min-w-0 max-w-full rounded-2xl border-2 px-3 py-3 text-center text-sm font-bold leading-tight transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-95 sm:py-4 sm:text-base';

export default function AmrapWorkPhaseControls({
  roundsCount,
  logRoundError,
  timerState,
  onLogRound,
  hideAmrapRounds = false,
  children,
  layout = 'default',
  leftColumnFooter,
  optimisticLogRoundCount = false,
}: AmrapWorkPhaseControlsProps) {
  const [isCooldown, setIsCooldown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [optimisticDelta, setOptimisticDelta] = useState(0);
  const cooldownTimeoutRef = useRef<number | null>(null);
  const prevRoundsCountRef = useRef(roundsCount);

  const clearCooldownTimer = useCallback(() => {
    if (cooldownTimeoutRef.current != null) {
      clearTimeout(cooldownTimeoutRef.current);
      cooldownTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearCooldownTimer();
  }, [clearCooldownTimer]);

  useEffect(() => {
    if (roundsCount > prevRoundsCountRef.current) {
      setOptimisticDelta(0);
    }
    prevRoundsCountRef.current = roundsCount;
  }, [roundsCount]);

  const handleLogRound = useCallback(async () => {
    if (timerState !== 'work' || isCooldown || isSubmitting) return;
    clearCooldownTimer();
    setIsCooldown(true);
    setIsSubmitting(true);
    if (optimisticLogRoundCount) {
      setOptimisticDelta(1);
    }
    try {
      const out = await Promise.resolve(onLogRound());
      if (out === false) {
        setOptimisticDelta(0);
        setIsCooldown(false);
        return;
      }
      cooldownTimeoutRef.current = window.setTimeout(() => {
        setIsCooldown(false);
        cooldownTimeoutRef.current = null;
      }, 5000);
    } catch {
      setOptimisticDelta(0);
      setIsCooldown(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    timerState,
    isCooldown,
    isSubmitting,
    onLogRound,
    optimisticLogRoundCount,
    clearCooldownTimer,
  ]);

  const displayedRounds = optimisticLogRoundCount ? roundsCount + optimisticDelta : roundsCount;

  const logRoundLabel = isCooldown ? (
    <span className="inline-flex items-center justify-center gap-1.5">
      <Check className="h-5 w-5 shrink-0" strokeWidth={2.75} aria-hidden />
      Logged!
    </span>
  ) : (
    'LOG ROUND'
  );

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

  const defaultButtonClass = isCooldown
    ? `${LOG_ROUND_BUTTON_CLASSES} ${LOG_ROUND_COOLDOWN_CLASSES}`
    : LOG_ROUND_BUTTON_CLASSES;

  const roundsColumn = (
    <div className="flex shrink-0 flex-col items-center text-center">
      <div className="mb-1 text-xs font-bold uppercase tracking-widest text-white/60 sm:text-sm">
        Your rounds
      </div>
      <div className="text-6xl font-bold leading-none text-white tabular-nums sm:text-7xl">
        {displayedRounds}
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
          onClick={handleLogRound}
          disabled={isCooldown || isSubmitting}
          aria-busy={isSubmitting}
          className={defaultButtonClass}
        >
          {logRoundLabel}
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
    const embedButtonClass = isCooldown
      ? `${EMBED_LOG_ROUND_BASE} border-emerald-400/90 bg-emerald-700 text-white shadow-[0_0_24px_rgba(16,185,129,0.4)] hover:bg-emerald-700`
      : `${EMBED_LOG_ROUND_BASE} border-orange-400 bg-orange-600 text-white shadow-[0_0_40px_rgba(234,88,12,0.4)] hover:bg-orange-500`;

    return (
      <div className="flex h-full w-full min-w-0 flex-col items-center justify-center gap-3 text-center">
        <div className="flex w-full flex-col items-center">
          <div className="mb-1 text-xs font-bold uppercase tracking-widest text-white/60 sm:text-sm">
            Your rounds
          </div>
          <div className="text-5xl font-bold leading-none text-white tabular-nums sm:text-6xl">
            {displayedRounds}
          </div>
        </div>
        {timerState === 'work' ? (
          <div className="flex w-full min-w-0 flex-col items-center gap-2">
            {logRoundError ? (
              <p className="text-center text-sm text-red-400 sm:text-[1.0625rem]">{logRoundError}</p>
            ) : null}
            <button
              type="button"
              onClick={handleLogRound}
              disabled={isCooldown || isSubmitting}
              aria-busy={isSubmitting}
              className={embedButtonClass}
            >
              {logRoundLabel}
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
        <div className="mb-4 text-[3.375rem] font-bold text-white">{displayedRounds}</div>
      </div>
      {children}
    </div>
  );
}
