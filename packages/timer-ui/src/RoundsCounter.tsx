/**
 * Reusable rounds counter (e.g. 0/28, 1/28). For use in timer sidebars or custom layouts.
 */
import React from 'react';

export interface RoundsCounterProps {
  /** Current round (0-based unless valueIsOneBased). */
  current: number;
  /** Total rounds. */
  total: number;
  /** Optional label above the numbers (e.g. "Round"). */
  label?: string;
  /** Optional class for the wrapper (e.g. mt-auto for sidebar bottom). */
  className?: string;
  /** When true, current is already 1-based (e.g. 1..28); display and aria use it as-is. */
  valueIsOneBased?: boolean;
}

const RoundsCounter: React.FC<RoundsCounterProps> = ({
  current,
  total,
  label,
  className = '',
  valueIsOneBased = false,
}) => {
  if (total <= 0) {
    return (
      <div
        className={`font-mono tabular-nums text-white/80 ${className}`.trim()}
        style={{ fontSize: 'clamp(1.75rem, 6vw, 3.5rem)' }}
        aria-label="Round 0 of 0"
      >
        0 / 0
      </div>
    );
  }

  const displayCurrent = Math.max(0, Math.min(current, total));
  // When 0-based, show 1-based in UI so visible text matches aria (e.g. "1 / N" not "0 / N").
  const displayValue = valueIsOneBased
    ? displayCurrent
    : Math.min(displayCurrent + 1, total);
  const ariaCurrent = displayValue;
  const ariaLabel = label
    ? `${label} ${ariaCurrent} of ${total}`
    : `Round ${ariaCurrent} of ${total}`;

  return (
    <div
      className={`flex flex-col ${className}`.trim()}
      role="status"
      aria-label={ariaLabel}
    >
      {label ? (
        <span className="text-xs font-medium uppercase tracking-wider text-white/60">
          {label}
        </span>
      ) : null}
      <span
        className="font-mono font-bold tabular-nums leading-none text-white"
        style={{ fontSize: 'clamp(1.75rem, 6vw, 3.5rem)' }}
      >
        {displayValue} / {total}
      </span>
    </div>
  );
};

export default RoundsCounter;
