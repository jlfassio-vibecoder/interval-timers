import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/supabase-instance';
import {
  computeTrainerLiveDisplayElapsedSec,
  parseTrainerLiveActivityState,
  type TrainerLiveActivityState,
} from '@/lib/trainer-live/activity-types';

/** Guest join links use anon Supabase; activity Realtime often does not fire — poll to stay in sync. */
const GUEST_ACTIVITY_POLL_MS = 10_000;

export interface UseTrainerLiveActivitySessionOptions {
  trainerLiveSessionId: string | undefined;
  participantId: string | null;
  /** When set, uses authenticated `trainer_live_activity_get_state`; otherwise join-link RPC. */
  authUserId: string | null;
}

export function useTrainerLiveActivitySession({
  trainerLiveSessionId,
  participantId,
  authUserId,
}: UseTrainerLiveActivitySessionOptions) {
  const [state, setState] = useState<TrainerLiveActivityState>({ has_activity: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Re-render once per second while active so `computeTrainerLiveDisplayElapsedSec` ticks without RPC load. */
  const [activeTick, setActiveTick] = useState(0);

  const fetchState = useCallback(async () => {
    if (!trainerLiveSessionId) return;
    setError(null);
    try {
      let data: unknown;
      if (authUserId) {
        const res = await supabase.rpc('trainer_live_activity_get_state', {
          p_trainer_live_session_id: trainerLiveSessionId,
        });
        if (res.error) throw res.error;
        data = res.data;
      } else if (participantId) {
        const res = await supabase.rpc('trainer_live_activity_get_state_for_participant', {
          p_trainer_live_session_id: trainerLiveSessionId,
          p_participant_id: participantId,
        });
        if (res.error) throw res.error;
        data = res.data;
      } else {
        setState({ has_activity: false });
        setLoading(false);
        return;
      }
      setState(parseTrainerLiveActivityState(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load activity timer');
      setState({ has_activity: false });
    } finally {
      setLoading(false);
    }
  }, [trainerLiveSessionId, participantId, authUserId]);

  useEffect(() => {
    setLoading(true);
    void fetchState();
  }, [fetchState]);

  const activitySessionId = state.has_activity ? state.activity_session_id : undefined;

  useEffect(() => {
    if (!trainerLiveSessionId || !activitySessionId || !authUserId) return;
    const aid = activitySessionId;
    const channel = supabase
      .channel(`trainer-live-activity-${trainerLiveSessionId}-${aid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trainer_live_activity_sessions',
          filter: `id=eq.${aid}`,
        },
        () => {
          void fetchState();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trainer_live_activity_segments',
          filter: `activity_session_id=eq.${aid}`,
        },
        () => {
          void fetchState();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [trainerLiveSessionId, activitySessionId, authUserId, fetchState]);

  useEffect(() => {
    if (!trainerLiveSessionId || !participantId || authUserId) return;
    const id = window.setInterval(() => {
      void fetchState();
    }, GUEST_ACTIVITY_POLL_MS);
    return () => window.clearInterval(id);
  }, [trainerLiveSessionId, participantId, authUserId, fetchState]);

  useEffect(() => {
    if (state.status !== 'active') return;
    const id = window.setInterval(() => {
      setActiveTick((t) => t + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [state.status]);

  const displayElapsedSec = useMemo(
    () => computeTrainerLiveDisplayElapsedSec(state),
    [state, activeTick]
  );

  return {
    state,
    loading,
    error,
    refresh: fetchState,
    displayElapsedSec,
  };
}
