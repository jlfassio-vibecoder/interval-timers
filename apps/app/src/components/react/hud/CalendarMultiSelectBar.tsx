/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Bottom action bar for calendar multi-select (Phase 5.7).
 * Mark as rest, Copy week, Clear scheduled, Cancel.
 */

import React from 'react';
import { Moon, Copy, Trash2, X } from 'lucide-react';

export interface CalendarMultiSelectBarProps {
  selectedCount: number;
  onMarkRest: () => void;
  onCopyWeek: () => void;
  onClearScheduled: () => void;
  onCancel: () => void;
}

const CalendarMultiSelectBar: React.FC<CalendarMultiSelectBarProps> = ({
  selectedCount,
  onMarkRest,
  onCopyWeek,
  onClearScheduled,
  onCancel,
}) => {
  return (
    <div
      className="bg-bg-dark/95 fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-2 border-t border-white/10 px-4 py-3 backdrop-blur-sm"
      role="toolbar"
      aria-label="Multi-select actions"
    >
      <span className="font-mono text-[10px] uppercase text-white/60">
        {selectedCount} selected
      </span>
      <div className="flex flex-1 items-center justify-end gap-2">
        <button
          type="button"
          onClick={onMarkRest}
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-white transition-colors hover:bg-white/10"
          aria-label="Mark as rest"
        >
          <Moon className="h-3.5 w-3.5" />
          Rest
        </button>
        <button
          type="button"
          onClick={onCopyWeek}
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-white transition-colors hover:bg-white/10"
          aria-label="Copy week"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy week
        </button>
        <button
          type="button"
          onClick={onClearScheduled}
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-white transition-colors hover:bg-white/10"
          aria-label="Clear scheduled"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Cancel selection"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default CalendarMultiSelectBar;
