import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ICameraVideoTrack, IRemoteVideoTrack } from 'agora-rtc-sdk-ng';
import { useTrainerLiveAgora } from '@/contexts/TrainerLiveAgoraContext';
import { useTrainerLiveTimerBackground } from '@/contexts/TrainerLiveTimerBackgroundContext';
import { supabase } from '@/lib/supabase/supabase-instance';

/**
 * 16:9 Agora video behind the Tabata embed. Trainer: local camera or any client (spotlight);
 * client: trainer feed.
 */
export default function TrainerLiveTabataTimerBackground({
  trainerLiveSessionId,
  participantId,
  role,
  videoTileExcludeUid,
  videoBottomOverlay,
}: {
  trainerLiveSessionId: string;
  participantId: string;
  role: 'trainer' | 'client';
  videoTileExcludeUid?: string | null;
  videoBottomOverlay?: ReactNode;
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
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 aspect-video w-full overflow-hidden rounded-b-2xl">
        <div
          ref={containerRef}
          className="h-full w-full [&>video]:h-full [&>video]:w-full [&>video]:object-cover"
        />
        <div className="absolute inset-0 bg-black/50" aria-hidden />
        {videoBottomOverlay != null ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 top-auto z-[2] flex max-h-[min(55%,15rem)] min-h-0 flex-col justify-end sm:max-h-[58%]">
            <div className="pointer-events-auto max-h-full min-h-0 overflow-y-auto overflow-x-hidden rounded-b-2xl bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2 pb-2 pt-8 sm:px-3 sm:pb-3 sm:pt-10">
              {videoBottomOverlay}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
