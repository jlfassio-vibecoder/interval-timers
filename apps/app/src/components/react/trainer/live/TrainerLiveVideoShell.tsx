import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTrainerLiveAgora } from '@/contexts/TrainerLiveAgoraContext';
import { supabase } from '@/lib/supabase/supabase-instance';
import {
  TrainerLiveLocalTile,
  TrainerLiveRemoteTile,
  TrainerLiveVideoPlaceholderTile,
} from './TrainerLiveVideoTiles';

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
  compact = false,
  /** When set, that Agora uid's tile is replaced with a placeholder (video shown on timer background). */
  excludeUidForTiles,
  /** When set with trainer + compact, primary feed + controls port into this DOM id (SESSION column). */
  trainerMainPortalRootId,
  /** When set with client + compact, trainer feed + controls port into SESSION; self + peers stay in the drawer. */
  clientMainPortalRootId,
}: {
  sessionId: string;
  participantId: string;
  localLabel: string;
  role: TrainerLiveRole;
  onLeaveRoom: () => void;
  /** Narrow layout for the collapsible video drawer (avoid forcing tall min-height). */
  compact?: boolean;
  excludeUidForTiles?: string | null;
  trainerMainPortalRootId?: string;
  clientMainPortalRootId?: string;
}) {
  const [participantMap, setParticipantMap] = useState<Map<string, ParticipantMeta>>(new Map());
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const { joined, localVideoTrack, remoteUsers, leave, muteVideo, muteAudio, error } =
    useTrainerLiveAgora();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
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

  const exclude = excludeUidForTiles != null ? String(excludeUidForTiles) : null;
  const excludeLocal = exclude != null && exclude === String(participantId);
  const trainerRemoteExcluded =
    trainerRemote != null && exclude != null && String(trainerRemote.uid) === exclude;

  const banner = error || loadErr;

  const root = compact
    ? 'flex h-full min-h-0 flex-col gap-3 text-white'
    : 'flex min-h-[70vh] flex-col gap-4 text-white';

  const shouldSplitTrainerMain =
    role === 'trainer' &&
    compact &&
    typeof trainerMainPortalRootId === 'string' &&
    trainerMainPortalRootId.length > 0;

  const shouldSplitClientMain =
    role === 'client' &&
    compact &&
    typeof clientMainPortalRootId === 'string' &&
    clientMainPortalRootId.length > 0;

  const portalMount =
    typeof document !== 'undefined' && shouldSplitTrainerMain
      ? document.getElementById(trainerMainPortalRootId)
      : null;

  const clientPortalMount =
    typeof document !== 'undefined' && shouldSplitClientMain
      ? document.getElementById(clientMainPortalRootId)
      : null;

  const controlBar = (
    <div
      className={`flex flex-wrap items-center ${compact ? 'gap-2 pt-2' : 'gap-3 pt-4'}`}
    >
      <button
        type="button"
        onClick={() => {
          const next = !videoMuted;
          muteVideo(next);
          setVideoMuted(next);
        }}
        className={
          compact
            ? 'rounded-lg border border-white/20 px-2 py-1.5 text-xs hover:bg-white/10'
            : 'rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10'
        }
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
        className={
          compact
            ? 'rounded-lg border border-white/20 px-2 py-1.5 text-xs hover:bg-white/10'
            : 'rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10'
        }
      >
        {audioMuted ? 'Mic muted' : 'Mic on'}
      </button>
      <button
        type="button"
        onClick={() => void handleLeave()}
        className={
          compact
            ? 'rounded-lg bg-red-600/80 px-2 py-1.5 text-xs font-medium hover:bg-red-600'
            : 'rounded-lg bg-red-600/80 px-4 py-2 text-sm font-medium hover:bg-red-600'
        }
      >
        Leave room
      </button>
    </div>
  );

  /**
   * SESSION column: stack banner → video → controls. Video uses shrink-0 + aspect-video height
   * (do not wrap the tile in flex-1 + overflow-hidden or a wide tile gets vertically clipped).
   */
  const trainerPortalColumn = (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-y-auto text-white">
      {banner ? (
        <div className="shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100 sm:text-sm">
          {banner}
        </div>
      ) : null}
      {!joined && !banner ? (
        <div className="flex min-h-[6rem] shrink-0 items-center justify-center text-xs text-white/60 sm:text-sm">
          Connecting to room…
        </div>
      ) : null}
      {joined || banner ? (
        excludeLocal ? (
          <div className="w-full shrink-0">
            <TrainerLiveVideoPlaceholderTile
              label={localLabel}
              hint="Video on timer background"
            />
          </div>
        ) : (
          <div className="w-full shrink-0">
            <TrainerLiveLocalTile videoTrack={localVideoTrack} label={localLabel} />
          </div>
        )
      ) : null}
      <div className="shrink-0">{controlBar}</div>
    </div>
  );

  const trainerRemoteTiles = remoteUsers.map((u) =>
    exclude != null && String(u.uid) === exclude ? (
      <TrainerLiveVideoPlaceholderTile
        key={String(u.uid)}
        label={labelForUid(u.uid, participantMap)}
        hint="Video on timer background"
      />
    ) : (
      <TrainerLiveRemoteTile
        key={String(u.uid)}
        user={u}
        label={labelForUid(u.uid, participantMap)}
      />
    )
  );

  /** Client split drawer: self + non-trainer peers (trainer is portaled to SESSION column). */
  const clientPeersDrawerGrid = (
    <div className="grid flex-1 grid-cols-1 gap-2">
      {excludeLocal ? (
        <TrainerLiveVideoPlaceholderTile
          label={localLabel}
          hint="Video on timer background"
        />
      ) : (
        <TrainerLiveLocalTile videoTrack={localVideoTrack} label={localLabel} />
      )}
      {otherRemotes.map((u) =>
        exclude != null && String(u.uid) === exclude ? (
          <TrainerLiveVideoPlaceholderTile
            key={String(u.uid)}
            label={labelForUid(u.uid, participantMap)}
            hint="Video on timer background"
          />
        ) : (
          <TrainerLiveRemoteTile
            key={String(u.uid)}
            user={u}
            label={labelForUid(u.uid, participantMap)}
          />
        )
      )}
    </div>
  );

  const clientPortalColumn = (
    <div className="flex h-full min-h-0 w-full flex-col gap-2 overflow-y-auto text-white">
      {banner ? (
        <div className="shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100 sm:text-sm">
          {banner}
        </div>
      ) : null}
      {!joined && !banner ? (
        <div className="flex min-h-[6rem] shrink-0 items-center justify-center text-xs text-white/60 sm:text-sm">
          Connecting to room…
        </div>
      ) : null}
      {joined || banner ? (
        trainerRemoteExcluded && trainerRemote ? (
          <div className="min-h-0 shrink-0">
            <TrainerLiveVideoPlaceholderTile
              label={labelForUid(trainerRemote.uid, participantMap)}
              hint="Video on timer background"
            />
          </div>
        ) : trainerRemote ? (
          <div className="min-h-0 w-full shrink-0">
            <TrainerLiveRemoteTile
              user={trainerRemote}
              label={labelForUid(trainerRemote.uid, participantMap)}
            />
          </div>
        ) : (
          <div className="flex min-h-[6rem] shrink-0 items-center justify-center rounded-xl border border-white/10 bg-zinc-900/50 text-sm text-white/50">
            Waiting for trainer…
          </div>
        )
      ) : null}
      <div className="shrink-0">{controlBar}</div>
    </div>
  );

  if (role === 'trainer' && shouldSplitTrainerMain && portalMount) {
    return (
      <>
        {createPortal(trainerPortalColumn, portalMount)}
        <div className={root}>
          {remoteUsers.length === 0 ? (
            <p className="py-4 text-center text-xs text-white/45">No participants yet</p>
          ) : (
            <div className="grid flex-1 grid-cols-1 gap-2">{trainerRemoteTiles}</div>
          )}
        </div>
      </>
    );
  }

  if (role === 'client' && shouldSplitClientMain && clientPortalMount) {
    return (
      <>
        {createPortal(clientPortalColumn, clientPortalMount)}
        <div className={root}>{clientPeersDrawerGrid}</div>
      </>
    );
  }

  return (
    <div className={root}>
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
        <div
          className={
            compact
              ? 'grid flex-1 grid-cols-1 gap-2'
              : 'grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'
          }
        >
          {excludeLocal ? (
            <TrainerLiveVideoPlaceholderTile
              label={localLabel}
              hint="Video on timer background"
            />
          ) : (
            <TrainerLiveLocalTile videoTrack={localVideoTrack} label={localLabel} />
          )}
          {trainerRemoteTiles}
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3">
          {trainerRemoteExcluded && trainerRemote ? (
            <div className="min-h-0 flex-1">
              <TrainerLiveVideoPlaceholderTile
                label={labelForUid(trainerRemote.uid, participantMap)}
                hint="Video on timer background"
              />
            </div>
          ) : trainerRemote ? (
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
          <div className={`flex shrink-0 overflow-x-auto pb-1 ${compact ? 'gap-2' : 'gap-3'}`}>
            <div className={compact ? 'w-36 shrink-0' : 'w-44 shrink-0 sm:w-52'}>
              {excludeLocal ? (
                <TrainerLiveVideoPlaceholderTile
                  label={localLabel}
                  hint="Video on timer background"
                />
              ) : (
                <TrainerLiveLocalTile videoTrack={localVideoTrack} label={localLabel} />
              )}
            </div>
            {otherRemotes.map((u) => (
              <div
                key={String(u.uid)}
                className={compact ? 'w-36 shrink-0' : 'w-44 shrink-0 sm:w-52'}
              >
                {exclude != null && String(u.uid) === exclude ? (
                  <TrainerLiveVideoPlaceholderTile
                    label={labelForUid(u.uid, participantMap)}
                    hint="Video on timer background"
                  />
                ) : (
                  <TrainerLiveRemoteTile user={u} label={labelForUid(u.uid, participantMap)} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {controlBar}
    </div>
  );
}
