/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Slide-out notifications panel from the HUD header bell. Notifications are derived client-side.
 */

import React, { useEffect, useState } from 'react';
import { X, Trophy, Calendar, Moon, Flame, Dumbbell, MessageSquare } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import type {
  DerivedNotification,
  NotificationType,
} from '@/lib/notifications/derive-notifications';

export interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: DerivedNotification[];
  /** After coach assignment dismiss, bump to refetch derived notifications. */
  onCoachAssignmentsChanged?: () => void;
  /** When set with onOpenCoachMessages, shows P3 coach thread entry (does not affect bell count). */
  coachMessagesTrainerUserId?: string | null;
  coachMessagesCoachName?: string | null;
  onOpenCoachMessages?: () => void;
}

function iconForType(type: NotificationType): React.ReactNode {
  switch (type) {
    case 'coach_assignment':
      return <Dumbbell className="h-4 w-4 shrink-0 text-orange-light" />;
    case 'program_complete':
      return <Trophy className="h-4 w-4 shrink-0 text-orange-light" />;
    case 'new_workout_available':
      return <Calendar className="h-4 w-4 shrink-0 text-orange-light" />;
    case 'rest_day_reminder':
      return <Moon className="h-4 w-4 shrink-0 text-white/70" />;
    case 'streak_at_risk':
      return <Flame className="h-4 w-4 shrink-0 text-amber-400" />;
    default:
      return null;
  }
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen,
  onClose,
  notifications,
  onCoachAssignmentsChanged,
  coachMessagesTrainerUserId,
  coachMessagesCoachName,
  onOpenCoachMessages,
}) => {
  const { setActiveProgramId } = useAppContext();
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const handleOpenCoach = (n: DerivedNotification) => {
    if (n.coachAction === 'set_program' && n.coachProgramId) {
      setActiveProgramId(n.coachProgramId);
      onClose();
      window.location.hash = 'program-sidebar';
      return;
    }
    if (n.coachHref) {
      onClose();
      window.location.assign(n.coachHref);
    }
  };

  const handleDismissCoach = async (assignmentId: string) => {
    setDismissingId(assignmentId);
    try {
      const res = await fetch(`/api/me/coach-assignments/${encodeURIComponent(assignmentId)}`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (res.ok) onCoachAssignmentsChanged?.();
    } finally {
      setDismissingId(null);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-bg-dark shadow-2xl"
        role="dialog"
        aria-labelledby="notification-panel-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-4">
          <h2
            id="notification-panel-title"
            className="font-heading text-lg font-black uppercase text-white"
          >
            Notifications
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
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {coachMessagesTrainerUserId && onOpenCoachMessages ? (
            <div className="flex gap-3 rounded-lg border border-orange-light/30 bg-orange-light/10 p-3">
              <MessageSquare className="h-4 w-4 shrink-0 text-orange-light" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs font-semibold uppercase text-orange-light">
                  Coach messages
                </p>
                <p className="mt-0.5 text-sm text-white/80">
                  {coachMessagesCoachName?.trim()
                    ? `Chat with ${coachMessagesCoachName.trim()}.`
                    : 'Send and read messages with your coach.'}
                </p>
                <button
                  type="button"
                  onClick={() => onOpenCoachMessages()}
                  className="mt-2 rounded-md border border-orange-light/40 bg-orange-light/10 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-orange-light hover:bg-orange-light/20"
                >
                  Open
                </button>
              </div>
            </div>
          ) : null}
          {notifications.length === 0 ? (
            <p className="font-mono text-sm text-white/50">No notifications right now.</p>
          ) : (
            <ul className="space-y-3">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className="flex gap-3 rounded-lg border border-white/10 bg-white/5 p-3"
                >
                  {iconForType(n.type)}
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-semibold uppercase text-orange-light">
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-sm text-white/80">{n.message}</p>
                    {n.type === 'coach_assignment' && n.assignmentId ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenCoach(n)}
                          className="rounded-md border border-orange-light/40 bg-orange-light/10 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-orange-light hover:bg-orange-light/20"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          disabled={dismissingId === n.assignmentId}
                          onClick={() => void handleDismissCoach(n.assignmentId!)}
                          className="rounded-md border border-white/15 px-2 py-1 font-mono text-[10px] uppercase text-white/70 hover:bg-white/10 disabled:opacity-40"
                        >
                          {dismissingId === n.assignmentId ? '…' : 'Dismiss'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
};

export default NotificationPanel;
