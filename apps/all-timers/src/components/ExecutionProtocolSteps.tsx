/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Reusable display component for Execution Protocol (or step-by-step instructions).
 * Accepts already-parsed steps; strips label prefixes before rendering.
 * Supports compact (header) and default (full-page) variants and scrollable container.
 */

import React from 'react';

const LABEL_PREFIX = /^(?:Point \d+:|Common Mistakes:|Performance Cues:)\s*/i;

function stripLabelPrefix(s: string): string {
  return s.replace(LABEL_PREFIX, '').trim();
}

export interface ExecutionProtocolStepsProps {
  steps: string[];
  maxHeight?: string;
  className?: string;
  variant?: 'compact' | 'default';
}

/**
 * Renders a numbered list of Execution Protocol steps with optional scroll.
 * Use variant="compact" for headers/sidebars; variant="default" for full-page.
 */
const ExecutionProtocolSteps: React.FC<ExecutionProtocolStepsProps> = ({
  steps,
  maxHeight,
  className = '',
  variant = 'default',
}) => {
  const cleaned = steps.map(stripLabelPrefix).filter(Boolean);
  if (cleaned.length === 0) return null;

  const isCompact = variant === 'compact';
  const list = (
    <ul
      className={
        isCompact
          ? 'list-inside list-disc space-y-0.5 text-left text-xs text-white/90'
          : 'list-none space-y-4 pl-0'
      }
    >
      {cleaned.map((step, i) =>
        isCompact ? (
          <li key={i} className="leading-snug">
            {step}
          </li>
        ) : (
          <li key={i} className="flex items-start gap-6 text-slate-300">
            <span className="shrink-0 font-mono text-lg font-bold text-emerald-400 opacity-80">
              {(i + 1).toString().padStart(cleaned.length.toString().length, '0')}
            </span>
            <span>{step}</span>
          </li>
        )
      )}
    </ul>
  );

  if (maxHeight) {
    return (
      <div className={`min-h-0 overflow-y-auto ${className}`.trim()} style={{ maxHeight }}>
        {list}
      </div>
    );
  }

  return <div className={className || undefined}>{list}</div>;
};

export default ExecutionProtocolSteps;
