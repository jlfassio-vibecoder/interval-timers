import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/supabase-instance';
import { parseLiveSessionSummary, type LiveSessionSummary } from '@/types/live-session-summary';

export type UseLiveSessionSummaryResult = {
  data: LiveSessionSummary | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export function useLiveSessionSummary(sessionId: string | undefined): UseLiveSessionSummaryResult {
  const [data, setData] = useState<LiveSessionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refetchKey, setRefetchKey] = useState(0);

  const refetch = useCallback(() => {
    setRefetchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    const id = sessionId?.trim();
    if (!id) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      const { data: raw, error: rpcErr } = await supabase.rpc('get_live_session_summary', {
        p_session_id: id,
      });
      if (cancelled) return;
      if (rpcErr) {
        setError(rpcErr.message);
        setData(null);
      } else {
        const parsed = parseLiveSessionSummary(raw);
        if (parsed == null) {
          setData(null);
          setError('Unexpected response from summary');
        } else {
          setData(parsed);
          setError(null);
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, refetchKey]);

  return { data, loading, error, refetch };
}
