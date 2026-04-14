import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ICameraVideoTrack, IRemoteVideoTrack } from 'agora-rtc-sdk-ng';
import { useTrainerLiveAgora } from '@/contexts/TrainerLiveAgoraContext';
import { useTrainerLiveTimerBackground } from '@/contexts/TrainerLiveTimerBackgroundContext';
import { supabase } from '@/lib/supabase/supabase-instance';

/**
 * 16:9 Agora video for EMOM: same source rules as Tabata (Me / spotlight client; client sees trainer).
 * Host + clock: {@link videoTopLeftOverlay}; rounds / task complete: {@link videoTopRightOverlay}; rail: weight + spotlight.
 */
export default function TrainerLiveEmomTimerBackground({
  trainerLiveSessionId,
  participantId,
  role,
  videoTileExcludeUid,
  videoTopLeftOverlay,
  videoTopRightOverlay,
}: {
  trainerLiveSessionId: string;
  participantId: string;
  role: 'trainer' | 'client';
  videoTileExcludeUid?: string | null;
  videoTopLeftOverlay?: ReactNode;
  videoTopRightOverlay?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { localVideoTrack, remoteUsers } = useTrainerLiveAgora();
  const { timerBackgroundSpotlightParticipantId } = useTrainerLiveTimerBackground();

  const [trainerParticipantId, setTrainerParticipantId] = useState<string | null>(null);

  useEffect(() => {
    if (role !== 'client') {
      setTrainerParticipantId(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error: qErr } = await supabase.rpc('trainer_live_list_participants', {
        p_session_id: trainerLiveSessionId,
      });
      if (cancelled || qErr) return;
      const rows = (data ?? []) as { id: string; role: string }[];
      const trainer = rows.find((r) => r.role === 'trainer');
      if (!cancelled) setTrainerParticipantId(trainer?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [role, trainerLiveSessionId]);

  const trainerRemoteForClient =
    role === 'client' && trainerParticipantId != null
      ? remoteUsers.find((u) => String(u.uid) === String(trainerParticipantId))
      : undefined;

  const clientTrainerBackgroundRemote =
    role === 'client' && trainerRemoteForClient == null
      ? remoteUsers.find((u) => String(u.uid) !== String(participantId))
      : undefined;

  const spotlightId = timerBackgroundSpotlightParticipantId;
  const trainerActiveTrack: ICameraVideoTrack | IRemoteVideoTrack | null = (() => {
    if (spotlightId == null || spotlightId === participantId) {
      return localVideoTrack;
    }
    const remote = remoteUsers.find((u) => String(u.uid) === String(spotlightId));
    return remote?.videoTrack ?? null;
  })();

  const activeTrack: ICameraVideoTrack | IRemoteVideoTrack | null =
    role === 'client'
      ? ((trainerRemoteForClient ?? clientTrainerBackgroundRemote)?.videoTrack ?? null)
      : trainerActiveTrack;

  useEffect(() => {
    const el = containerRef.current;
    if (!activeTrack || !el) return;
    activeTrack.play(el, { fit: 'cover' });
  }, [activeTrack, videoTileExcludeUid]);

  return (
    <div
      className="relative aspect-video w-full shrink-0 overflow-hidden rounded-b-2xl"
      data-region="trainer-live-emom-timer-video"
    >
      <div
        ref={containerRef}
        className="h-full w-full [&>video]:h-full [&>video]:w-full [&>video]:object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-black/50" aria-hidden />
      {videoTopLeftOverlay != null ? (
        <div className="pointer-events-none absolute left-0 top-0 z-[3] flex max-w-[min(92%,18rem)] p-2 sm:p-3">
          <div className="pointer-events-auto w-full min-w-0">{videoTopLeftOverlay}</div>
        </div>
      ) : null}
      {videoTopRightOverlay != null ? (
        <div className="pointer-events-none absolute right-0 top-0 z-[3] flex max-w-[min(92%,18rem)] justify-end p-2 sm:p-3">
          <div className="pointer-events-auto w-full min-w-0 max-w-[13rem]">
            {videoTopRightOverlay}
          </div>
        </div>
      ) : null}
    </div>
  );
}
