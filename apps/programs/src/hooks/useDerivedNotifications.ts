/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Hook to derive notifications for the HUD. Used by HUDShell to pass count to header and list to panel.
 */

import { useState, useEffect } from 'react';
import {
  deriveNotifications,
  type DerivedNotification,
} from '@/lib/notifications/derive-notifications';

export function useDerivedNotifications(
  userId: string | undefined,
  activeProgramId: string | null
): {
  notifications: DerivedNotification[];
  count: number;
  loading: boolean;
} {
  const [notifications, setNotifications] = useState<DerivedNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    deriveNotifications(userId, activeProgramId ?? null)
      .then((list) => {
        if (!cancelled) setNotifications(list);
      })
      .catch(() => {
        if (!cancelled) setNotifications([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, activeProgramId]);

  return {
    notifications,
    count: notifications.length,
    loading,
  };
}
