import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchScheduledSessions } from '@/lib/fetchScheduledSessions';
import type { ScheduledSession } from '@/lib/fetchScheduledSessions';

export type { ScheduledSession } from '@/lib/fetchScheduledSessions';

export function useScheduledSessions(weekStart: Date, weekEnd: Date) {
  const [sessions, setSessions] = useState<ScheduledSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const { data, error: e } = await fetchScheduledSessions(
        weekStart,
        weekEnd,
        controller.signal
      );
      if (!isMountedRef.current) return;
      if (e) {
        setError(e);
        setSessions([]);
        return;
      }
      setSessions(data);
    } finally {
      clearTimeout(timeoutId);
      controllerRef.current = null;
      if (isMountedRef.current) setLoading(false);
    }
  // Stable primitive deps so fetch isn't recreated when caller passes new Date refs (avoids unnecessary re-fetch).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- weekStart.getTime() / weekEnd.getTime() are intentional
  }, [weekStart.getTime(), weekEnd.getTime()]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { sessions, loading, error, refetch: fetch };
}
