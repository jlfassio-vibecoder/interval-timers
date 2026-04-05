import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/supabase-instance';

export type TrainerLiveSessionParticipantRow = {
  id: string;
  role: string;
  display_name: string;
};

const POLL_MS = 4000;

export function useTrainerLiveSessionParticipants(sessionId: string | undefined) {
  const [participants, setParticipants] = useState<TrainerLiveSessionParticipantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchParticipants = useCallback(async () => {
    if (!sessionId) return;
    const { data, error: qErr } = await supabase.rpc('trainer_live_list_participants', {
      p_session_id: sessionId,
    });
    if (qErr) {
      setError(qErr.message);
      return;
    }
    setError(null);
    const raw = data as unknown;
    setParticipants(Array.isArray(raw) ? (raw as TrainerLiveSessionParticipantRow[]) : []);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      setParticipants([]);
      setError(null);
      return;
    }
    setLoading(true);
    void fetchParticipants().finally(() => setLoading(false));
  }, [sessionId, fetchParticipants]);

  useEffect(() => {
    if (!sessionId) return;
    const id = window.setInterval(() => {
      void fetchParticipants();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [sessionId, fetchParticipants]);

  return { participants, loading, error, refetch: fetchParticipants };
}
