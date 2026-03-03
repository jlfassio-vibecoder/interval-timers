/**
 * Reusable expandable section that shows a table of common mistakes and corrections.
 * Manages its own expanded/collapsed state. Returns null when rows are empty.
 */
import React, { useState } from 'react';
import type { MistakeCorrectionRow } from '@interval-timers/types';

export type { MistakeCorrectionRow };

export interface ExpandableMistakesCorrectionsProps {
  /** Table rows: mistake, why it happens, the fix. Renders nothing if empty. */
  rows: MistakeCorrectionRow[];
  /** Heading shown on the toggle button. Default: "Common Mistakes & Corrections" */
  title?: string;
  /** Initial expanded state. Default: false */
  defaultExpanded?: boolean;
  /** Optional extra class for the wrapper (e.g. flex-1 for sidebar layout). */
  className?: string;
}

const COLUMN_HEADERS: { key: keyof MistakeCorrectionRow; label: string }[] = [
  { key: 'mistake', label: 'The Mistake' },
  { key: 'whyItHappens', label: 'Why It Happens' },
  { key: 'theFix', label: 'The Fix' },
];

const ExpandableMistakesCorrections: React.FC<ExpandableMistakesCorrectionsProps> = ({
  rows,
  title = 'Common Mistakes & Corrections',
  defaultExpanded = false,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (rows.length === 0) return null;

  return (
    <div
      className={`flex shrink-0 flex-col border-t border-white/10 pt-2 ${className}`.trim()}
    >
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 text-left text-sm font-bold text-white/90 hover:text-white"
        aria-expanded={isExpanded}
      >
        <span>{title}</span>
        <span
          className={`shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          aria-hidden
        >
          &#9660;
        </span>
      </button>
      {isExpanded && (
        <div className="max-h-64 overflow-y-auto pt-2">
          <div className="grid gap-x-3 gap-y-1 text-xs" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr) minmax(0,1.2fr)' }}>
            {COLUMN_HEADERS.map(({ label }) => (
              <div
                key={label}
                className="shrink-0 font-bold uppercase tracking-wide text-white/70"
              >
                {label}
              </div>
            ))}
            {rows.map((row, i) => (
              <React.Fragment key={i}>
                <div className="min-w-0 font-bold text-[#ffbf00]">{row.mistake}</div>
                <div className="min-w-0 leading-relaxed text-white/80">{row.whyItHappens}</div>
                <div className="min-w-0 leading-relaxed text-white/90">{row.theFix}</div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpandableMistakesCorrections;
