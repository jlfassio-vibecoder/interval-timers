import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface ScheduledSession {
  id: string;
  duration_minutes: number;
  workout_list: string[];
  scheduled_start_at: string;
}

export function useScheduledSessions(weekStart: Date, weekEnd: Date) {
  const [sessions, setSessions] = useState<ScheduledSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const { data, error: e } = await supabase
        .from('amrap_sessions')
        .select('id, duration_minutes, workout_list, scheduled_start_at')
        .not('scheduled_start_at', 'is', null)
        .gte('scheduled_start_at', weekStart.toISOString())
        .lt('scheduled_start_at', weekEnd.toISOString())
        .order('scheduled_start_at', { ascending: true })
        .abortSignal(controller.signal);

      if (e) {
        setError(
          e.message === 'The operation was aborted.'
            ? 'Request timed out. Check your connection and try again.'
            : e.message
        );
        setSessions([]);
        return;
      }
      setSessions((data as ScheduledSession[]) ?? []);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  // Stable primitive deps so fetchSessions isn't recreated when caller passes new Date refs (avoids unnecessary re-fetch).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- weekStart.getTime() / weekEnd.getTime() are intentional
  }, [weekStart.getTime(), weekEnd.getTime()]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return { sessions, loading, error, refetch: fetchSessions };
}
