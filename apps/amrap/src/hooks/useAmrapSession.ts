import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  AmrapSessionRow,
  AmrapSessionPublic,
  AmrapParticipantRow,
  AmrapRoundRow,
} from '@/lib/supabase';

const SESSION_STORAGE_KEYS = {
  hostToken: 'amrap_friends_host_token',
  participantId: 'amrap_friends_participant_id',
  guestClaimToken: 'amrap_friends_guest_claim_token',
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
    /* sessionStorage unavailable */
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
    /* sessionStorage unavailable */
  }
}

export function getStoredGuestClaimToken(sessionId: string): string | null {
  try {
    const key = `${SESSION_STORAGE_KEYS.guestClaimToken}_${sessionId}`;
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setStoredGuestClaimToken(sessionId: string, claimToken: string): void {
  try {
    const key = `${SESSION_STORAGE_KEYS.guestClaimToken}_${sessionId}`;
    sessionStorage.setItem(key, claimToken);
  } catch {
    /* sessionStorage unavailable */
  }
}

export interface AmrapSessionData {
  session: AmrapSessionPublic | null;
  participants: AmrapParticipantRow[];
  rounds: AmrapRoundRow[];
  isHost: boolean;
  participantId: string | null;
  error: string | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

function toPublicSession(row: AmrapSessionRow): AmrapSessionPublic {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omit host_token from public session
  const { host_token: _tk, ...rest } = row;
  return rest as AmrapSessionPublic;
}

export interface UseAmrapSessionOptions {
  /** When false, defer initial fetch and realtime until true. Use to avoid Supabase auth lock contention when logged in (e.g. pass !authLoading). Default true. */
  startFetch?: boolean;
}

export function useAmrapSession(
  sessionId: string | undefined,
  options: UseAmrapSessionOptions = {}
): AmrapSessionData {
  const { startFetch = true } = options;
  const [session, setSession] = useState<AmrapSessionPublic | null>(null);
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
      .select('id, duration_minutes, workout_list, state, time_left_sec, is_paused, started_at, created_at, scheduled_start_at, show_new_workout_modal, show_warmup_overlay, warmup_started_at, timer_segment, segment_index')
      .eq('id', id)
      .single();
    if (e) {
      setError(e.message);
      setSession(null);
      return;
    }
    setSession(data as AmrapSessionPublic);
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
      /* eslint-disable react-hooks/set-state-in-effect -- initial state when no sessionId */
      setLoading(false);
      setError('No session ID');
      return;
    }
    if (!startFetch) {
      return;
    }
    setLoading(true);
    Promise.all([
      fetchSession(sessionId),
      fetchParticipants(sessionId),
      fetchRounds(sessionId),
    ]).finally(() => setLoading(false));
  }, [sessionId, startFetch, fetchSession, fetchParticipants, fetchRounds]);

  useEffect(() => {
    if (!sessionId || !startFetch) return;

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
          if (payload.new) setSession(toPublicSession(payload.new as AmrapSessionRow));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, startFetch]);

  useEffect(() => {
    if (!sessionId || !startFetch) return;

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
  }, [sessionId, startFetch, fetchParticipants]);

  useEffect(() => {
    if (!sessionId || !startFetch || session?.state !== 'waiting') return;
    const interval = setInterval(() => fetchParticipants(sessionId), 3000);
    return () => clearInterval(interval);
  }, [sessionId, startFetch, session?.state, fetchParticipants]);

  useEffect(() => {
    if (!sessionId || !startFetch) return;

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
  }, [sessionId, startFetch, fetchRounds]);

  const refetch = useCallback(async () => {
    if (!sessionId) return;
    await Promise.all([
      fetchSession(sessionId),
      fetchParticipants(sessionId),
      fetchRounds(sessionId),
    ]);
  }, [sessionId, fetchSession, fetchParticipants, fetchRounds]);

  /** Rounds scoped to current segment; during AMRAP shows only this workout's rounds */
  const roundsForSegment = useMemo(() => {
    const seg = session?.segment_index ?? 0;
    return rounds.filter((r) => (r.segment_index ?? 0) === seg);
  }, [rounds, session?.segment_index]);

  return {
    session,
    participants,
    rounds: roundsForSegment,
    isHost,
    participantId,
    error,
    loading,
    refetch,
  };
}
