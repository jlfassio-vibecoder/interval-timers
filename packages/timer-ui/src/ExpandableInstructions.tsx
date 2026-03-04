/**
 * Reusable expandable section that shows a list of step-by-step instructions.
 * Manages its own expanded/collapsed state. Returns null when steps are empty.
 */
import React, { useState } from 'react';
import type { InstructionStep } from '@interval-timers/types';

export interface ExpandableInstructionsProps {
  /** Ordered list of steps (title + body). Renders nothing if empty. */
  steps: InstructionStep[];
  /** Heading shown on the toggle button. Default: "Step-by-Step Execution" */
  title?: string;
  /** Initial expanded state. Default: false */
  defaultExpanded?: boolean;
  /** Optional extra class for the wrapper (e.g. flex-1 for sidebar layout). */
  className?: string;
  /** Optional class for the scrollable content area. When set (e.g. "min-h-0 flex-1 overflow-y-auto"), fills available height instead of using max-h-64. */
  contentClassName?: string;
}

const ExpandableInstructions: React.FC<ExpandableInstructionsProps> = ({
  steps,
  title = 'Step-by-Step Execution',
  defaultExpanded = false,
  className = '',
  contentClassName,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (steps.length === 0) return null;

  const scrollContentClass =
    contentClassName ?? 'max-h-64 overflow-y-auto pt-2';

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
        <div className={scrollContentClass}>
          <ol className="list-none space-y-3 pl-0">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 font-mono text-sm font-bold text-[#ffbf00]">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <span className="block font-bold text-white">{step.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-white/80">
                    {step.body}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

export default ExpandableInstructions;
