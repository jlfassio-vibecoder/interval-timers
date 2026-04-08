import type { AmrapVideoSource } from '@/types/amrap-session';
import VideoSourcePlayer from '@/components/amrap-session/VideoSourcePlayer';

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
  /** Agora track (live) or MediaStream (solo recording) */
  videoTrack?: AmrapVideoSource | null;
  /** Dense row for Trainer Live chat drawer (latest split + round count). */
  compact?: boolean;
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

export default function LeaderboardRow({
  nickname,
  totalRounds,
  splits,
  rank,
  videoTrack,
  compact = false,
}: LeaderboardRowProps) {
  const lastSplit = splits.length > 0 ? splits[splits.length - 1]! : null;

  if (compact) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/20 p-3">
        {videoTrack && (
          <>
            <VideoSourcePlayer source={videoTrack} />
            <div className="pointer-events-none absolute inset-0 bg-black/40" aria-hidden />
          </>
        )}
        <div className="relative z-10 flex flex-wrap items-center gap-2">
          {rank != null && (
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs font-bold text-white/90">
              #{rank}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{nickname}</span>
          <span className="shrink-0 text-xs text-white/70">
            {totalRounds} rnd{totalRounds !== 1 ? 's' : ''}
          </span>
          {lastSplit != null ? (
            <span className="w-full font-mono text-sm font-semibold tabular-nums text-orange-300">
              Last split {formatTime(lastSplit)}
            </span>
          ) : (
            <span className="w-full text-xs text-white/45">No rounds yet</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-6 sm:p-8">
      {videoTrack && (
        <>
          <VideoSourcePlayer source={videoTrack} />
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
