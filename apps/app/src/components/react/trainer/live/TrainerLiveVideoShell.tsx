import { useCallback, useEffect, useState } from 'react';
import { useTrainerLiveAgoraChannel } from '@/hooks/useTrainerLiveAgoraChannel';
import { supabase } from '@/lib/supabase/supabase-instance';
import { TrainerLiveLocalTile, TrainerLiveRemoteTile } from './TrainerLiveVideoTiles';

export type TrainerLiveRole = 'trainer' | 'client';

export interface ParticipantMeta {
  id: string;
  role: TrainerLiveRole;
  display_name: string;
}

function labelForUid(uid: string | number, map: Map<string, ParticipantMeta>): string {
  const meta = map.get(String(uid));
  if (meta?.display_name) return meta.display_name;
  return `Participant ${String(uid).slice(0, 8)}`;
}

export default function TrainerLiveVideoShell({
  sessionId,
  participantId,
  role,
  localLabel,
  onLeaveRoom,
}: {
  sessionId: string;
  participantId: string;
  role: TrainerLiveRole;
  localLabel: string;
  onLeaveRoom: () => void;
}) {
  const [participantMap, setParticipantMap] = useState<Map<string, ParticipantMeta>>(new Map());
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const { joined, localVideoTrack, remoteUsers, leave, muteVideo, muteAudio, error } =
    useTrainerLiveAgoraChannel(sessionId, participantId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: qErr } = await supabase.rpc('trainer_live_list_participants', {
        p_session_id: sessionId,
      });
      if (cancelled) return;
      if (qErr) {
        setLoadErr(qErr.message);
        return;
      }
      const m = new Map<string, ParticipantMeta>();
      for (const row of (data ?? []) as {
        id: string;
        role: TrainerLiveRole;
        display_name: string;
      }[]) {
        m.set(row.id, { id: row.id, role: row.role, display_name: row.display_name });
      }
      setParticipantMap(m);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const [videoMuted, setVideoMuted] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);

  const handleLeave = useCallback(async () => {
    await leave();
    onLeaveRoom();
  }, [leave, onLeaveRoom]);

  const trainerRemote = remoteUsers.find(
    (u) => participantMap.get(String(u.uid))?.role === 'trainer'
  );
  const otherRemotes = remoteUsers.filter(
    (u) => participantMap.get(String(u.uid))?.role !== 'trainer'
  );

  const banner = error || loadErr;

  return (
    <div className="flex min-h-[70vh] flex-col gap-4 text-white">
      {banner ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
          {banner}
        </div>
      ) : null}

      {!joined && !banner ? (
        <div className="flex flex-1 items-center justify-center text-white/60">
          Connecting to room…
        </div>
      ) : null}

      {role === 'trainer' ? (
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <TrainerLiveLocalTile videoTrack={localVideoTrack} label={localLabel} />
          {remoteUsers.map((u) => (
            <TrainerLiveRemoteTile
              key={String(u.uid)}
              user={u}
              label={labelForUid(u.uid, participantMap)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3">
          {trainerRemote ? (
            <div className="min-h-0 flex-1">
              <TrainerLiveRemoteTile
                user={trainerRemote}
                label={labelForUid(trainerRemote.uid, participantMap)}
              />
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-white/10 bg-zinc-900/50 text-white/50">
              Waiting for trainer…
            </div>
          )}
          <div className="flex shrink-0 gap-3 overflow-x-auto pb-1">
            <div className="w-44 shrink-0 sm:w-52">
              <TrainerLiveLocalTile videoTrack={localVideoTrack} label={localLabel} />
            </div>
            {otherRemotes.map((u) => (
              <div key={String(u.uid)} className="w-44 shrink-0 sm:w-52">
                <TrainerLiveRemoteTile user={u} label={labelForUid(u.uid, participantMap)} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
        <button
          type="button"
          onClick={() => {
            const next = !videoMuted;
            muteVideo(next);
            setVideoMuted(next);
          }}
          className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
        >
          {videoMuted ? 'Camera off' : 'Camera on'}
        </button>
        <button
          type="button"
          onClick={() => {
            const next = !audioMuted;
            muteAudio(next);
            setAudioMuted(next);
          }}
          className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
        >
          {audioMuted ? 'Mic muted' : 'Mic on'}
        </button>
        <button
          type="button"
          onClick={() => void handleLeave()}
          className="rounded-lg bg-red-600/80 px-4 py-2 text-sm font-medium hover:bg-red-600"
        >
          Leave room
        </button>
      </div>
    </div>
  );
}
