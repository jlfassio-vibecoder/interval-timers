import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/supabase-instance';

export type TrainerLiveSessionMessageRow = {
  id: string;
  session_id: string;
  participant_id: string;
  body: string;
  created_at: string;
  author_display_name: string;
};

const POLL_MS = 4000;

export function useTrainerLiveSessionMessages(
  sessionId: string | undefined,
  participantId: string | null
) {
  const [messages, setMessages] = useState<TrainerLiveSessionMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendError, setSendError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!sessionId || !participantId) return;
    const { data, error } = await supabase.rpc('trainer_live_list_session_messages', {
      p_session_id: sessionId,
      p_caller_participant_id: participantId,
    });
    if (error) {
      setLoadError(error.message);
      return;
    }
    setLoadError(null);
    const raw = data as unknown;
    setMessages(Array.isArray(raw) ? (raw as TrainerLiveSessionMessageRow[]) : []);
  }, [sessionId, participantId]);

  useEffect(() => {
    if (!sessionId || !participantId) {
      setLoading(false);
      setMessages([]);
      setLoadError(null);
      return;
    }
    setLoading(true);
    void fetchMessages().finally(() => setLoading(false));
  }, [sessionId, participantId, fetchMessages]);

  useEffect(() => {
    if (!sessionId || !participantId) return;
    const id = window.setInterval(() => {
      void fetchMessages();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [sessionId, participantId, fetchMessages]);

  const sendMessage = useCallback(
    async (body: string) => {
      if (!sessionId || !participantId) return;
      setSendError(null);
      const trimmed = body.trim();
      if (!trimmed) return;
      const { error } = await supabase.rpc('trainer_live_post_session_message', {
        p_session_id: sessionId,
        p_participant_id: participantId,
        p_body: trimmed,
      });
      if (error) {
        setSendError(error.message);
        return;
      }
      await fetchMessages();
    },
    [sessionId, participantId, fetchMessages]
  );

  const hasUserPosted =
    participantId != null && messages.some((m) => m.participant_id === participantId);

  return { messages, loading, loadError, sendError, sendMessage, hasUserPosted };
}
