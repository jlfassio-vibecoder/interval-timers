import { useEffect, useRef } from 'react';
import type { ICameraVideoTrack } from 'agora-rtc-sdk-ng';
import type { TrainerLiveRemoteUser } from '@/hooks/useTrainerLiveAgoraChannel';

export function TrainerLiveLocalTile({
  videoTrack,
  label,
}: {
  videoTrack: ICameraVideoTrack | null;
  label: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!videoTrack || !containerRef.current) return;
    videoTrack.play(containerRef.current);
    return () => {
      try {
        videoTrack.stop();
      } catch {
        /* ignore */
      }
    };
  }, [videoTrack]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-900/80">
      <div ref={containerRef} className="h-full w-full" />
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-xs font-medium text-white">
        {label}
      </div>
    </div>
  );
}

export function TrainerLiveRemoteTile({
  user,
  label,
}: {
  user: TrainerLiveRemoteUser;
  label: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const track = user.videoTrack;

  useEffect(() => {
    if (!track || !containerRef.current) return;
    track.play(containerRef.current);
    return () => {
      try {
        track.stop();
      } catch {
        /* ignore */
      }
    };
  }, [track]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-900/80">
      <div ref={containerRef} className="h-full w-full" />
      {!track && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-white/60">
          No video
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-xs font-medium text-white">
        {label}
      </div>
    </div>
  );
}

/** Shown when the live tile is pinned as the AMRAP timer background (single Agora play target). */
export function TrainerLiveVideoPlaceholderTile({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-dashed border-white/25 bg-zinc-900/80">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2 text-center">
        <p className="text-xs font-medium text-white/90">{label}</p>
        {hint ? <p className="text-[10px] text-white/50">{hint}</p> : null}
      </div>
    </div>
  );
}
