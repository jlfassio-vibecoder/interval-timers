import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ICameraVideoTrack, IRemoteVideoTrack } from 'agora-rtc-sdk-ng';
import { useTrainerLiveAgora } from '@/contexts/TrainerLiveAgoraContext';
import { useTrainerLiveTimerBackground } from '@/contexts/TrainerLiveTimerBackgroundContext';
import { supabase } from '@/lib/supabase/supabase-instance';
import type { AmrapSessionEngine } from 'amrap/embed';

/**
 * Full-width 16:9 video behind the AMRAP embed. Single play() target — drawer tiles
 * exclude the same uid via TrainerLiveSessionRoom. Trainer: Me/Leader source; client: trainer’s camera.
 */
export default function TrainerLiveAmrapTimerBackground({
  engine,
  trainerLiveSessionId,
  participantId,
  role,
  videoTileExcludeUid,
  videoBottomOverlay,
}: {
  engine: AmrapSessionEngine;
  trainerLiveSessionId: string;
  participantId: string;
  role: 'trainer' | 'client';
  /** Mirrors `TrainerLiveVideoShell` tile exclusion — include so we re-`play()` after tile `track.stop()`. */
  videoTileExcludeUid?: string | null;
  /** e.g. `AmrapEmbedExerciseSection` — pinned to the bottom of the 16:9 video area. */
  videoBottomOverlay?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { localVideoTrack, remoteUsers } = useTrainerLiveAgora();
  const { mode, leaderTrainerLiveParticipantId, setLeaderTrainerLiveParticipantId } =
    useTrainerLiveTimerBackground();

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

  const sortedParticipants = [...engine.participants].sort((a, b) => {
    if (b.rounds !== a.rounds) return b.rounds - a.rounds;
    return a.name.localeCompare(b.name);
  });
  const leaderRow = sortedParticipants[0];
  const participantsLeaderKey = leaderRow?.id ? `${leaderRow.id}:${leaderRow.rounds}` : '';

  useEffect(() => {
    if (role === 'client') {
      setLeaderTrainerLiveParticipantId(null);
      return;
    }
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
  }, [role, participantsLeaderKey, trainerLiveSessionId, setLeaderTrainerLiveParticipantId]);

  const effectiveLeaderUid = leaderTrainerLiveParticipantId;
  const leaderIsSelf =
    effectiveLeaderUid != null && String(effectiveLeaderUid) === String(participantId);
  const remoteForLeader =
    effectiveLeaderUid != null && !leaderIsSelf
      ? remoteUsers.find((u) => String(u.uid) === String(effectiveLeaderUid))
      : undefined;
  const leaderRemoteTrack = remoteForLeader?.videoTrack;

  const trainerRemoteForClient =
    role === 'client' && trainerParticipantId != null
      ? remoteUsers.find((u) => String(u.uid) === String(trainerParticipantId))
      : undefined;

  /** While trainer row id is still loading, or if uid matching fails, prefer any remote that isn’t self (usually the coach). */
  const clientTrainerBackgroundRemote =
    role === 'client' && trainerRemoteForClient == null
      ? remoteUsers.find((u) => String(u.uid) !== String(participantId))
      : undefined;

  const activeTrack: ICameraVideoTrack | IRemoteVideoTrack | null =
    role === 'client'
      ? ((trainerRemoteForClient ?? clientTrainerBackgroundRemote)?.videoTrack ?? null)
      : mode === 'self'
        ? localVideoTrack
        : leaderIsSelf
          ? localVideoTrack
          : (leaderRemoteTrack ?? null);

  useEffect(() => {
    const el = containerRef.current;
    if (!activeTrack || !el) return;
    activeTrack.play(el, { fit: 'cover' });
    // Do not call track.stop() on cleanup — same track is used in drawer tiles when not excluded;
    // switching Me/Leader only moves play() target (see VideoSourcePlayer in amrap).
    // `videoTileExcludeUid` is a dep so when tiles swap to placeholder and call `track.stop()`, we attach again.
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
