/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Slide-out notifications panel from the HUD header bell. Notifications are derived client-side.
 */

import React, { useEffect } from 'react';
import { X, Trophy, Calendar, Moon, Flame } from 'lucide-react';
import type {
  DerivedNotification,
  NotificationType,
} from '@/lib/notifications/derive-notifications';

export interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: DerivedNotification[];
}

function iconForType(type: NotificationType): React.ReactNode {
  switch (type) {
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
}) => {
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
        <div className="flex-1 overflow-y-auto p-4">
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
