import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { AmrapSessionRow, AmrapParticipantRow, AmrapRoundRow } from '@/lib/supabase';

const SESSION_STORAGE_KEYS = {
  hostToken: 'amrap_friends_host_token',
  participantId: 'amrap_friends_participant_id',
} as const;

export function getStoredHostToken(sessionId: string): string | null {
  try {
    const key = `${SESSION_STORAGE_KEYS.hostToken}_${sessionId}`;
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setStoredHostToken(sessionId: string, token: string): void {
  try {
    const key = `${SESSION_STORAGE_KEYS.hostToken}_${sessionId}`;
    sessionStorage.setItem(key, token);
  } catch {
    // ignore
  }
}

export function getStoredParticipantId(sessionId: string): string | null {
  try {
    const key = `${SESSION_STORAGE_KEYS.participantId}_${sessionId}`;
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setStoredParticipantId(sessionId: string, participantId: string): void {
  try {
    const key = `${SESSION_STORAGE_KEYS.participantId}_${sessionId}`;
    sessionStorage.setItem(key, participantId);
  } catch {
    // ignore
  }
}

export interface AmrapSessionData {
  session: AmrapSessionRow | null;
  participants: AmrapParticipantRow[];
  rounds: AmrapRoundRow[];
  isHost: boolean;
  participantId: string | null;
  error: string | null;
  loading: boolean;
}

export function useAmrapSession(sessionId: string | undefined): AmrapSessionData {
  const [session, setSession] = useState<AmrapSessionRow | null>(null);
  const [participants, setParticipants] = useState<AmrapParticipantRow[]>([]);
  const [rounds, setRounds] = useState<AmrapRoundRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const hostToken = sessionId ? getStoredHostToken(sessionId) : null;
  const participantId = sessionId ? getStoredParticipantId(sessionId) : null;
  const isHost = Boolean(hostToken);

  const fetchSession = useCallback(async (id: string) => {
    const { data, error: e } = await supabase
      .from('amrap_sessions')
      .select('*')
      .eq('id', id)
      .single();
    if (e) {
      setError(e.message);
      setSession(null);
      return;
    }
    setSession(data as AmrapSessionRow);
    setError(null);
  }, []);

  const fetchParticipants = useCallback(async (id: string) => {
    const { data, error: e } = await supabase
      .from('amrap_participants')
      .select('*')
      .eq('session_id', id)
      .order('joined_at', { ascending: true });
    if (e) return;
    setParticipants((data as AmrapParticipantRow[]) ?? []);
  }, []);

  const fetchRounds = useCallback(async (id: string) => {
    const { data, error: e } = await supabase
      .from('amrap_rounds')
      .select('*')
      .eq('session_id', id)
      .order('round_index', { ascending: true });
    if (e) return;
    setRounds((data as AmrapRoundRow[]) ?? []);
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      setError('No session ID');
      return;
    }

    setLoading(true);
    Promise.all([
      fetchSession(sessionId),
      fetchParticipants(sessionId),
      fetchRounds(sessionId),
    ]).finally(() => setLoading(false));
  }, [sessionId, fetchSession, fetchParticipants, fetchRounds]);

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`amrap_session_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'amrap_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.new) setSession(payload.new as AmrapSessionRow);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`amrap_participants_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'amrap_participants',
          filter: `session_id=eq.${sessionId}`,
        },
        () => fetchParticipants(sessionId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, fetchParticipants]);

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`amrap_rounds_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'amrap_rounds',
          filter: `session_id=eq.${sessionId}`,
        },
        () => fetchRounds(sessionId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, fetchRounds]);

  return {
    session,
    participants,
    rounds,
    isHost,
    participantId,
    error,
    loading,
  };
}
