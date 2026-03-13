import { useState, useEffect, useCallback } from 'react';
import { fetchScheduledSessions } from '@/lib/fetchScheduledSessions';
import type { ScheduledSession } from '@/lib/fetchScheduledSessions';

export type { ScheduledSession } from '@/lib/fetchScheduledSessions';

export function useScheduledSessions(weekStart: Date, weekEnd: Date) {
  const [sessions, setSessions] = useState<ScheduledSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const { data, error: e } = await fetchScheduledSessions(
        weekStart,
        weekEnd,
        controller.signal
      );
      if (e) {
        setError(e);
        setSessions([]);
        return;
      }
      setSessions(data);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  // Stable primitive deps so fetch isn't recreated when caller passes new Date refs (avoids unnecessary re-fetch).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- weekStart.getTime() / weekEnd.getTime() are intentional
  }, [weekStart.getTime(), weekEnd.getTime()]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { sessions, loading, error, refetch: fetch };
}
