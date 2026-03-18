/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Drawer for a scheduled timer/interval workout (timer_scheduled). Do → app path, Remove → delete + refresh.
 */

import React, { useEffect, useState } from 'react';
import { X, ExternalLink, Trash2 } from 'lucide-react';
import type { CalendarEvent } from '@/lib/calendar-events';
import { getAppById } from '@/lib/app-registry';
import { deleteScheduledWorkout } from '@/lib/supabase/client/scheduled-workouts';

export interface ScheduledTimerDrawerProps {
  event: CalendarEvent;
  onClose: () => void;
  onRemoved?: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('default', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('default', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const ScheduledTimerDrawer: React.FC<ScheduledTimerDrawerProps> = ({
  event,
  onClose,
  onRemoved,
}) => {
  const [removing, setRemoving] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const app = event.sourceApp ? getAppById(event.sourceApp) : null;
  const timeLabel = event.metadata?.scheduledAt
    ? formatDateTime(event.metadata.scheduledAt)
    : formatDate(event.date);

  const handleRemove = async () => {
    if (!event.sessionId) return;
    setRemoving(true);
    try {
      await deleteScheduledWorkout(event.sessionId);
      onRemoved?.();
      onClose();
    } catch {
      setRemoving(false);
    }
  };

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
        aria-labelledby="scheduled-timer-drawer-title"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-bg-dark px-6 py-4">
          <h2
            id="scheduled-timer-drawer-title"
            className="font-heading text-lg font-black uppercase text-white"
          >
            Scheduled
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
        <div className="p-6">
          <p className="font-heading text-xl font-black text-white">{event.workoutTitle}</p>
          <p className="mt-0.5 font-mono text-[10px] text-white/40">{timeLabel}</p>
          {app && <p className="mt-1 font-mono text-[10px] uppercase text-white/50">{app.name}</p>}
          <div className="mt-6 flex flex-col gap-3">
            {app && (
              <a
                href={app.path}
                className="border-orange-light/50 bg-orange-light/20 hover:bg-orange-light/30 flex items-center justify-center gap-2 rounded-2xl border py-3 font-heading text-sm font-black uppercase text-orange-light transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Do — {app.name}
              </a>
            )}
            <button
              type="button"
              onClick={handleRemove}
              disabled={removing}
              className="flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 py-3 font-mono text-[10px] uppercase text-white/70 transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ScheduledTimerDrawer;
