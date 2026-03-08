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
    const { data, error: e } = await supabase
      .from('amrap_sessions')
      .select('id, duration_minutes, workout_list, scheduled_start_at')
      .not('scheduled_start_at', 'is', null)
      .gte('scheduled_start_at', weekStart.toISOString())
      .lt('scheduled_start_at', weekEnd.toISOString())
      .order('scheduled_start_at', { ascending: true });
    setLoading(false);
    if (e) {
      setError(e.message);
      setSessions([]);
      return;
    }
    setSessions((data as ScheduledSession[]) ?? []);
  }, [weekStart, weekEnd]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount / when range changes
    fetchSessions();
  }, [fetchSessions]);

  return { sessions, loading, error };
}
