/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Drawer for empty calendar days: Schedule workout and Mark as rest / Unmark rest (Phase 5.6).
 */

import React, { useEffect } from 'react';
import { X, CalendarPlus, Moon, Calendar } from 'lucide-react';

export interface EmptyDayActionDrawerProps {
  date: string;
  isRestDay: boolean;
  onClose: () => void;
  onMarkRest: () => void;
  onUnmarkRest: () => void;
  onScheduleWorkout: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('default', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

const EmptyDayActionDrawer: React.FC<EmptyDayActionDrawerProps> = ({
  date,
  isRestDay,
  onClose,
  onMarkRest,
  onUnmarkRest,
  onScheduleWorkout,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const dateLabel = formatDate(date);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-3xl border border-white/10 bg-bg-dark shadow-2xl"
        role="dialog"
        aria-labelledby="empty-day-drawer-title"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-bg-dark px-6 py-4">
          <h2
            id="empty-day-drawer-title"
            className="font-heading text-lg font-black uppercase text-white"
          >
            {dateLabel}
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
        <div className="flex flex-col gap-3 p-4">
          <button
            type="button"
            onClick={() => {
              onClose();
              onScheduleWorkout();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
          >
            <CalendarPlus className="h-4 w-4" />
            Schedule workout
          </button>
          {isRestDay ? (
            <button
              type="button"
              onClick={() => {
                onUnmarkRest();
                onClose();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Calendar className="h-4 w-4" />
              Unmark rest
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onMarkRest();
                onClose();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Moon className="h-4 w-4" />
              Mark as rest
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default EmptyDayActionDrawer;
