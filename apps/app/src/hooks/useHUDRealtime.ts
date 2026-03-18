/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Supabase Realtime subscriptions for HUD ScheduleZone and HistoryZone.
 * When data changes (workout logs, AMRAP results, AMRAP sessions), invokes
 * callbacks so the parent can bump refresh keys and refetch.
 */

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/supabase-instance';

export interface UseHUDRealtimeCallbacks {
  onUserWorkoutLogsChange?: () => void;
  onAmrapResultsChange?: () => void;
  onAmrapSessionsChange?: () => void;
  /** Timer app handoff (workout_logs with source); calendar + history. */
  onWorkoutLogsChange?: () => void;
}

/**
 * Subscribe to postgres_changes for tables that affect HUD calendar and history.
 * Only active when enabled and userId is present. Cleans up on unmount or when disabled.
 * Callbacks are read from a ref so subscription does not churn when parent re-renders.
 */
export function useHUDRealtime(
  userId: string | null,
  enabled: boolean,
  callbacks: UseHUDRealtimeCallbacks
): void {
  const ref = useRef(callbacks);
  ref.current = callbacks;

  useEffect(() => {
    if (!enabled || !userId) return;

    const channels: ReturnType<typeof supabase.channel>[] = [];

    // user_workout_logs: program session completion, calendar + history
    const uwlChannel = supabase
      .channel(`hud_uwl_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_workout_logs',
          filter: `user_id=eq.${userId}`,
        },
        () => ref.current.onUserWorkoutLogsChange?.()
      )
      .subscribe();
    channels.push(uwlChannel);

    // shared.amrap_session_results: AMRAP results for HistoryZone
    const asrChannel = supabase
      .channel(`hud_asr_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'shared',
          table: 'amrap_session_results',
          filter: `user_id=eq.${userId}`,
        },
        () => ref.current.onAmrapResultsChange?.()
      )
      .subscribe();
    channels.push(asrChannel);

    // amrap_sessions: new session created by user (ScheduleZone)
    const amsChannel = supabase
      .channel(`hud_ams_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'amrap_sessions',
          filter: `created_by_user_id=eq.${userId}`,
        },
        () => ref.current.onAmrapSessionsChange?.()
      )
      .subscribe();
    channels.push(amsChannel);

    // amrap_participants: user joined a session (ScheduleZone)
    const apChannel = supabase
      .channel(`hud_ap_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'amrap_participants',
          filter: `user_id=eq.${userId}`,
        },
        () => ref.current.onAmrapSessionsChange?.()
      )
      .subscribe();
    channels.push(apChannel);

    // workout_logs: timer app handoff (Tabata, Daily Warm-Up, etc.), calendar + history
    const wlChannel = supabase
      .channel(`hud_wl_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'workout_logs',
          filter: `user_id=eq.${userId}`,
        },
        () => ref.current.onWorkoutLogsChange?.()
      )
      .subscribe();
    channels.push(wlChannel);

    return () => {
      for (const ch of channels) {
        supabase.removeChannel(ch);
      }
    };
  }, [enabled, userId]);
}
