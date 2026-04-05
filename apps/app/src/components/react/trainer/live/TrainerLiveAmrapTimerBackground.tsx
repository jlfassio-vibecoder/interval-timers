import { useEffect, useRef } from 'react';
import type { ICameraVideoTrack, IRemoteVideoTrack } from 'agora-rtc-sdk-ng';
import { useTrainerLiveAgora } from '@/contexts/TrainerLiveAgoraContext';
import { useTrainerLiveTimerBackground } from '@/contexts/TrainerLiveTimerBackgroundContext';
import { supabase } from '@/lib/supabase/supabase-instance';
import type { AmrapSessionEngine } from 'amrap/embed';

/**
 * Full-width 16:9 video behind the AMRAP embed (host). Single play() target — drawer tiles
 * exclude the same uid via TrainerLiveSessionRoom.
 */
export default function TrainerLiveAmrapTimerBackground({
  engine,
  trainerLiveSessionId,
  participantId,
}: {
  engine: AmrapSessionEngine;
  trainerLiveSessionId: string;
  participantId: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { localVideoTrack, remoteUsers } = useTrainerLiveAgora();
  const { mode, leaderTrainerLiveParticipantId, setLeaderTrainerLiveParticipantId } =
    useTrainerLiveTimerBackground();

  const sortedParticipants = [...engine.participants].sort((a, b) => {
    if (b.rounds !== a.rounds) return b.rounds - a.rounds;
    return a.name.localeCompare(b.name);
  });
  const leaderRow = sortedParticipants[0];
  const participantsLeaderKey = leaderRow?.id ? `${leaderRow.id}:${leaderRow.rounds}` : '';

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!participantsLeaderKey) {
        if (!cancelled) setLeaderTrainerLiveParticipantId(null);
        return;
      }
      const leaderId = participantsLeaderKey.split(':')[0];
      const { data: ap, error: apErr } = await supabase
        .from('amrap_participants')
        .select('user_id')
        .eq('id', leaderId)
        .maybeSingle();
      if (cancelled) return;
      if (apErr || !ap?.user_id) {
        setLeaderTrainerLiveParticipantId(null);
        return;
      }
      const { data: tl, error: tlErr } = await supabase
        .from('trainer_live_participants')
        .select('id')
        .eq('session_id', trainerLiveSessionId)
        .eq('user_id', ap.user_id)
        .maybeSingle();
      if (cancelled) return;
      if (tlErr || !tl?.id) {
        setLeaderTrainerLiveParticipantId(null);
        return;
      }
      setLeaderTrainerLiveParticipantId(tl.id);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [participantsLeaderKey, trainerLiveSessionId, setLeaderTrainerLiveParticipantId]);

  const effectiveLeaderUid = leaderTrainerLiveParticipantId;
  const leaderIsSelf =
    effectiveLeaderUid != null && String(effectiveLeaderUid) === String(participantId);
  const remoteForLeader =
    effectiveLeaderUid != null && !leaderIsSelf
      ? remoteUsers.find((u) => String(u.uid) === String(effectiveLeaderUid))
      : undefined;
  const leaderRemoteTrack = remoteForLeader?.videoTrack;

  const activeTrack: ICameraVideoTrack | IRemoteVideoTrack | null =
    mode === 'self'
      ? localVideoTrack
      : leaderIsSelf
        ? localVideoTrack
        : leaderRemoteTrack ?? null;

  useEffect(() => {
    const el = containerRef.current;
    if (!activeTrack || !el) return;
    activeTrack.play(el, { fit: 'cover' });
    // Do not call track.stop() on cleanup — same track is used in drawer tiles when not excluded;
    // switching Me/Leader only moves play() target (see VideoSourcePlayer in amrap).
  }, [activeTrack]);

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 aspect-video w-full overflow-hidden rounded-b-2xl">
        <div
          ref={containerRef}
          className="h-full w-full [&>video]:h-full [&>video]:w-full [&>video]:object-cover"
        />
        <div className="absolute inset-0 bg-black/50" aria-hidden />
      </div>
    </>
  );
}
