import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { AmrapSessionMessageRow } from '@/lib/supabase';

const MAX_MESSAGE_LENGTH = 500;

export interface UseSessionMessagesResult {
  messages: AmrapSessionMessageRow[];
  loading: boolean;
  sendError: string | null;
  sendMessage: (body: string) => Promise<void>;
  hasUserPosted: boolean;
}

export function useSessionMessages(
  sessionId: string | undefined,
  participantId: string | null
): UseSessionMessagesResult {
  const [messages, setMessages] = useState<AmrapSessionMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendError, setSendError] = useState<string | null>(null);

  const fetchMessages = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('amrap_session_messages')
      .select('*')
      .eq('session_id', id)
      .order('created_at', { ascending: true });
    if (error) return;
    setMessages((data as AmrapSessionMessageRow[]) ?? []);
  }, []);

  useEffect(() => {
    if (!sessionId) {
      /* eslint-disable react-hooks/set-state-in-effect -- initial state when no sessionId */
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchMessages(sessionId).finally(() => setLoading(false));
  }, [sessionId, fetchMessages]);

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`amrap_messages_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'amrap_session_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as AmrapSessionMessageRow;
          setMessages((prev) => [...prev, row]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const sendMessage = useCallback(
    async (body: string) => {
      const trimmed = body.trim();
      if (!trimmed || !sessionId || !participantId) return;
      if (trimmed.length > MAX_MESSAGE_LENGTH) {
        setSendError(`Message must be ${MAX_MESSAGE_LENGTH} characters or less`);
        return;
      }
      setSendError(null);
      const { error } = await supabase.from('amrap_session_messages').insert({
        session_id: sessionId,
        participant_id: participantId,
        body: trimmed,
      });
      if (error) setSendError(error.message);
    },
    [sessionId, participantId]
  );

  const hasUserPosted = Boolean(
    participantId && messages.some((m) => m.participant_id === participantId)
  );

  return {
    messages,
    loading,
    sendError,
    sendMessage,
    hasUserPosted,
  };
}
