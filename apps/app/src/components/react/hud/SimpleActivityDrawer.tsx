/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Drawer for non-program calendar events (AMRAP, timer apps, readiness).
 */

import React, { useEffect, useState, useMemo } from 'react';
import { X, ExternalLink } from 'lucide-react';
import type { CalendarEvent } from '@/lib/calendar-events';
import { getAmrapPresetName } from '@/lib/amrap-preset-name';
import { getAmrapSessionUrl } from '@/lib/amrap-urls';
import { getAppById } from '@/lib/app-registry';
import AmrapSessionActionModal, {
  type AmrapSessionData,
} from '@/components/react/hud/AmrapSessionActionModal';

export interface SimpleActivityDrawerProps {
  event: CalendarEvent;
  onClose: () => void;
  /** When provided and event is AMRAP, "View Results" opens the results drawer (caller shows AmrapResultDetailDrawer). */
  onViewResults?: () => void;
  /** Called when user deletes an AMRAP session from the modal (e.g. refetch calendar). */
  onSessionDeleted?: () => void;
  /** Called when user reschedules an AMRAP session from the modal (e.g. refetch calendar). */
  onSessionRescheduled?: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('default', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function typeLabel(type: CalendarEvent['type']): string {
  switch (type) {
    case 'amrap':
      return 'AMRAP With Friends';
    case 'amrap_scheduled':
      return 'AMRAP scheduled';
    case 'timer':
      return 'Timer';
    case 'readiness':
      return 'Readiness';
    default:
      return 'Activity';
  }
}

/** Ensure we have a string[]; exclude duration-like entries so "20 min" never shows as a list item. */
function getAmrapExerciseList(workoutList: unknown): string[] {
  const raw = Array.isArray(workoutList) ? workoutList : [];
  const asStrings = raw.map((e) => (typeof e === 'string' ? e.trim() : String(e))).filter(Boolean);
  return asStrings.filter((s) => !/^\d+\s*min$/i.test(s) && !/^\d+$/.test(s));
}

const SimpleActivityDrawer: React.FC<SimpleActivityDrawerProps> = ({
  event,
  onClose,
  onViewResults,
  onSessionDeleted,
  onSessionRescheduled,
}) => {
  const [showSessionModal, setShowSessionModal] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const dateLabel = formatDate(event.date);
  const meta = event.metadata;
  const app = event.sourceApp ? getAppById(event.sourceApp) : null;
  const isAmrap = event.type === 'amrap' || event.type === 'amrap_scheduled';
  const amrapExercises = isAmrap ? getAmrapExerciseList(meta?.workoutList) : [];
  const drawerTitle = isAmrap
    ? (getAmrapPresetName(meta?.workoutList) ?? event.workoutTitle)
    : event.workoutTitle;

  const amrapSessionData: AmrapSessionData | null = useMemo(() => {
    if (!event.sessionId || (event.type !== 'amrap' && event.type !== 'amrap_scheduled'))
      return null;
    const workoutList = Array.isArray(meta?.workoutList) ? (meta.workoutList as string[]) : [];
    return {
      id: event.sessionId,
      duration_minutes: meta?.durationMinutes ?? 20,
      workout_list: workoutList,
      scheduled_start_at: meta?.scheduledAt ?? `${event.date}T09:00`,
    };
  }, [
    event.sessionId,
    event.type,
    event.date,
    meta?.workoutList,
    meta?.durationMinutes,
    meta?.scheduledAt,
  ]);

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
        aria-labelledby="simple-drawer-title"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-bg-dark px-6 py-4">
          <h2
            id="simple-drawer-title"
            className="font-heading text-lg font-black uppercase text-white"
          >
            Activity
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
          <p className="font-heading text-xl font-black text-white">{drawerTitle}</p>
          <p className="mt-0.5 font-mono text-[10px] uppercase text-white/50">
            {typeLabel(event.type)}
          </p>
          <p className="mt-1 font-mono text-[10px] text-white/40">{dateLabel}</p>
          {(event.type === 'amrap' || event.type === 'amrap_scheduled') &&
            amrapExercises.length > 0 && (
              <ul className="mt-3 list-inside list-decimal space-y-1 font-mono text-sm text-white/80">
                {amrapExercises.map((exercise, i) => (
                  <li key={i}>{exercise || '\u00a0'}</li>
                ))}
              </ul>
            )}
          {meta &&
            (meta.durationMinutes != null ||
              meta.durationSeconds != null ||
              meta.rounds != null ||
              meta.effort != null ||
              meta.rating != null) && (
              <div className="mt-3 flex flex-wrap gap-2 font-mono text-xs text-white/70">
                {meta.durationMinutes != null && <span>{meta.durationMinutes} min</span>}
                {meta.durationSeconds != null && meta.durationMinutes == null && (
                  <span>{Math.round(meta.durationSeconds / 60)} min</span>
                )}
                {meta.rounds != null && <span>{meta.rounds} rounds</span>}
                {meta.effort != null && <span>Effort {meta.effort}/10</span>}
                {meta.rating != null && event.type === 'readiness' && (
                  <span>Score {meta.rating}/5</span>
                )}
                {meta.rating != null && event.type !== 'readiness' && (
                  <span>Rating {meta.rating}/5</span>
                )}
              </div>
            )}
          <div className="mt-6 flex flex-col gap-3">
            {(event.type === 'amrap' || event.type === 'amrap_scheduled') &&
              event.sessionId &&
              amrapSessionData && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowSessionModal(true)}
                    className="border-orange-500 bg-orange-600 hover:bg-orange-500 flex items-center justify-center gap-2 rounded-2xl border-2 py-3 font-bold text-white transition-colors"
                  >
                    Start workout
                  </button>
                  {event.type === 'amrap' && (
                    <>
                      {onViewResults && (
                        <button
                          type="button"
                          onClick={onViewResults}
                          className="border-orange-light/50 bg-orange-light/20 hover:bg-orange-light/30 flex items-center justify-center gap-2 rounded-2xl border py-3 font-mono text-[10px] uppercase text-orange-light transition-colors"
                        >
                          View Results
                        </button>
                      )}
                      <a
                        href={getAmrapSessionUrl(event.sessionId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 py-3 font-mono text-[10px] uppercase text-white/70 hover:bg-white/10"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View session
                      </a>
                    </>
                  )}
                </>
              )}
            {event.type === 'timer' && app && (
              <a
                href={app.path}
                className="border-orange-light/50 bg-orange-light/20 hover:bg-orange-light/30 flex items-center justify-center gap-2 rounded-2xl border py-3 font-heading text-sm font-black uppercase text-orange-light transition-colors"
              >
                Do again — {app.name}
              </a>
            )}
          </div>
        </div>
      </div>
      {amrapSessionData && (
        <AmrapSessionActionModal
          session={amrapSessionData}
          isOpen={showSessionModal}
          onClose={() => setShowSessionModal(false)}
          onDeleted={() => {
            setShowSessionModal(false);
            onSessionDeleted?.();
            onClose();
          }}
          onRescheduled={() => {
            setShowSessionModal(false);
            onSessionRescheduled?.();
          }}
        />
      )}
    </>
  );
};

export default SimpleActivityDrawer;
