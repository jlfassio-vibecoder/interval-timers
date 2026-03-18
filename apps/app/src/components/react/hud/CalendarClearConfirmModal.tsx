/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Confirmation modal for clearing scheduled workouts from selected days (Phase 5.7).
 */

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface CalendarClearConfirmModalProps {
  scheduledCount: number;
  dayCount: number;
  onConfirm: () => void;
  onClose: () => void;
}

const CalendarClearConfirmModal: React.FC<CalendarClearConfirmModalProps> = ({
  scheduledCount,
  dayCount,
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
        aria-labelledby="clear-confirm-modal-title"
      >
        <div className="flex items-center justify-between">
          <h2
            id="clear-confirm-modal-title"
            className="font-heading text-lg font-black uppercase text-white"
          >
            Clear scheduled
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
          {scheduledCount === 0
            ? 'No scheduled workouts on selected days.'
            : `Remove ${scheduledCount} scheduled workout${scheduledCount === 1 ? '' : 's'} from ${dayCount} day${dayCount === 1 ? '' : 's'}?`}
        </p>
        {scheduledCount > 0 && (
          <p className="mt-2 font-mono text-[10px] text-white/50">
            Only scheduled (timer and AMRAP) events are removed. Program workouts and completed
            activities are not changed.
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/20 bg-white/5 px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-white/80 transition-colors hover:bg-white/10"
          >
            Cancel
          </button>
          {scheduledCount > 0 && (
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="flex-1 rounded-xl border border-red-500/50 bg-red-500/20 px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-white transition-colors hover:bg-red-500/30"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default CalendarClearConfirmModal;
