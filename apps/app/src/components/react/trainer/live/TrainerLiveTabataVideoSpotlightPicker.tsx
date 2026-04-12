import { useEffect, useState } from 'react';
import { useTrainerLiveTimerBackground } from '@/contexts/TrainerLiveTimerBackgroundContext';
import { supabase } from '@/lib/supabase/supabase-instance';

/**
 * Trainer-only: choose whose video fills the Tabata timer background (Me or any connected client).
 */
export default function TrainerLiveTabataVideoSpotlightPicker({
  sessionId,
  trainerParticipantId,
}: {
  sessionId: string;
  trainerParticipantId: string;
}) {
  const { timerBackgroundSpotlightParticipantId, setTimerBackgroundSpotlightParticipantId } =
    useTrainerLiveTimerBackground();
  const [clients, setClients] = useState<{ id: string; display_name: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.rpc('trainer_live_list_participants', {
        p_session_id: sessionId,
      });
      if (cancelled || error) return;
      const rows = (data ?? []) as { id: string; role: string; display_name: string }[];
      if (!cancelled) {
        setClients(rows.filter((r) => r.role === 'client'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    const sid = timerBackgroundSpotlightParticipantId;
    if (sid == null || sid === trainerParticipantId) return;
    if (!clients.some((c) => c.id === sid)) {
      setTimerBackgroundSpotlightParticipantId(null);
    }
  }, [
    clients,
    timerBackgroundSpotlightParticipantId,
    trainerParticipantId,
    setTimerBackgroundSpotlightParticipantId,
  ]);

  const selectValue =
    timerBackgroundSpotlightParticipantId == null ||
    timerBackgroundSpotlightParticipantId === trainerParticipantId
      ? '__me__'
      : timerBackgroundSpotlightParticipantId;

  return (
    <label className="pointer-events-auto flex min-w-0 max-w-full flex-col gap-0.5 sm:max-w-[min(100%,20rem)]">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-white/55">
        Main video
      </span>
      <select
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '__me__') setTimerBackgroundSpotlightParticipantId(null);
          else setTimerBackgroundSpotlightParticipantId(v);
        }}
        className="w-full max-w-full rounded-lg border border-white/15 bg-black/55 py-1.5 pl-2 pr-7 text-xs font-medium text-white shadow-lg sm:text-sm"
        data-testid="trainer-live-tabata-video-spotlight"
      >
        <option value="__me__">Me (my camera)</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.display_name?.trim() || 'Client'}
          </option>
        ))}
      </select>
    </label>
  );
}
