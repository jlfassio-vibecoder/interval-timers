import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { ScheduledSession } from '@/lib/fetchScheduledSessions';

export type { ScheduledSession } from '@/lib/fetchScheduledSessions';

const SCHEDULE_FETCH_TIMEOUT_MS = 20000;

export function useScheduledSessions(weekStart: Date, weekEnd: Date) {
  const [sessions, setSessions] = useState<ScheduledSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const startISO = weekStart.toISOString();
    const endISO = weekEnd.toISOString();

    const query = supabase
      .from('amrap_sessions')
      .select('id, duration_minutes, workout_list, scheduled_start_at')
      .not('scheduled_start_at', 'is', null)
      .gte('scheduled_start_at', startISO)
      .lt('scheduled_start_at', endISO)
      .order('scheduled_start_at', { ascending: true });

    const timeoutPromise = new Promise<{ data: ScheduledSession[]; error: string }>((_, reject) => {
      timeoutRef.current = setTimeout(() => {
        reject(new Error('Request timed out. Check your connection and try again.'));
      }, SCHEDULE_FETCH_TIMEOUT_MS);
    });

    const queryPromise = query.then(({ data, error: e }) => {
      if (e) return { data: [] as ScheduledSession[], error: e.message };
      return { data: (data ?? []) as ScheduledSession[], error: null };
    });

    try {
      const result = await Promise.race([queryPromise, timeoutPromise]);
      if (!isMountedRef.current) return;
      if (result.error) {
        setError(result.error);
        setSessions([]);
        return;
      }
      setSessions(result.data);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSessions([]);
    } finally {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (isMountedRef.current) setLoading(false);
    }
  // Stable primitive deps so fetch isn't recreated when caller passes new Date refs (avoids unnecessary re-fetch).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- weekStart.getTime() / weekEnd.getTime() are intentional
  }, [weekStart.getTime(), weekEnd.getTime()]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { sessions, loading, error, refetch: fetch };
}
