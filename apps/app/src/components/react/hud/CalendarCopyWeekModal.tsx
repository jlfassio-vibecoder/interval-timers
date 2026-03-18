/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Modal to confirm copying one week's pattern to another (Phase 5.7).
 */

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

function formatWeekLabel(startIso: string): string {
  const d = new Date(startIso + 'T12:00:00Z');
  return d.toLocaleDateString('default', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export interface CalendarCopyWeekModalProps {
  sourceWeekStart: string;
  targetWeekStart: string;
  onConfirm: () => void;
  onClose: () => void;
}

const CalendarCopyWeekModal: React.FC<CalendarCopyWeekModalProps> = ({
  sourceWeekStart,
  targetWeekStart,
  onConfirm,
  onClose,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sourceLabel = formatWeekLabel(sourceWeekStart);
  const targetLabel = formatWeekLabel(targetWeekStart);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-bg-dark p-6 shadow-2xl"
        role="dialog"
        aria-labelledby="copy-week-modal-title"
      >
        <div className="flex items-center justify-between">
          <h2
            id="copy-week-modal-title"
            className="font-heading text-lg font-black uppercase text-white"
          >
            Copy week
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-4 font-mono text-sm text-white/80">
          Copy week of <strong>{sourceLabel}</strong> to <strong>{targetLabel}</strong>?
        </p>
        <p className="mt-2 font-mono text-[10px] text-white/50">
          Rest days and scheduled workouts (timer + AMRAP) will be copied. Program workouts are not
          copied.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/20 bg-white/5 px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-white/80 transition-colors hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="bg-orange-light/20 hover:bg-orange-light/30 flex-1 rounded-xl border border-orange-light px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-white transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </>
  );
};

export default CalendarCopyWeekModal;
