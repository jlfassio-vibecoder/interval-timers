import { useEffect, useRef } from 'react';
import type { ICameraVideoTrack, IRemoteVideoTrack } from 'agora-rtc-sdk-ng';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export interface LeaderboardRowProps {
  nickname: string;
  totalRounds: number;
  splits: number[];
  rank?: number;
  videoTrack?: ICameraVideoTrack | IRemoteVideoTrack | null;
}

function RoundSplitCard({ roundIndex, timeSec }: { roundIndex: number; timeSec: number }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="text-sm font-medium text-white/70">R{roundIndex}</div>
      <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-white">
        {formatTime(timeSec)}
      </div>
    </div>
  );
}

function VideoBackground({ videoTrack }: { videoTrack: ICameraVideoTrack | IRemoteVideoTrack }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!videoTrack || !containerRef.current) return;
    videoTrack.play(containerRef.current);
    return () => {
      try {
        videoTrack.stop();
      } catch {
        /* already stopped */
      }
    };
  }, [videoTrack]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full object-cover"
      aria-hidden
    />
  );
}

export default function LeaderboardRow({ nickname, totalRounds, splits, rank, videoTrack }: LeaderboardRowProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-6 sm:p-8">
      {videoTrack && (
        <>
          <VideoBackground videoTrack={videoTrack} />
          <div className="pointer-events-none absolute inset-0 bg-black/40" aria-hidden />
        </>
      )}
      <div className="relative z-10">
      <div className="mb-4 flex flex-wrap items-baseline gap-2">
        {rank != null && (
          <span className="rounded-lg bg-white/10 px-2 py-0.5 text-lg font-bold text-white/90">
            #{rank}
          </span>
        )}
        <span className="text-2xl font-bold text-white">{nickname}</span>
        <span className="text-xl text-white/80">
          {totalRounds} round{totalRounds !== 1 ? 's' : ''}
        </span>
      </div>
      {splits.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {splits.map((timeSec, i) => (
            <RoundSplitCard key={i} roundIndex={i + 1} timeSec={timeSec} />
          ))}
        </div>
      ) : (
        <p className="text-base text-white/50">No rounds logged yet.</p>
      )}
      </div>
    </div>
  );
}
