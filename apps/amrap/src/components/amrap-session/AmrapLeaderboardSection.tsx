import type { AmrapParticipantEngine } from '@/types/amrap-session';
import LeaderboardRow from '@/components/LeaderboardRow';

export type AmrapLeaderboardVariant = 'default' | 'embed' | 'chatDrawer';

export default function AmrapLeaderboardSection({
  participants,
  variant = 'default',
}: {
  participants: AmrapParticipantEngine[];
  variant?: AmrapLeaderboardVariant;
}) {
  const embed = variant === 'embed';
  const chatDrawer = variant === 'chatDrawer';

  const sectionClass = chatDrawer
    ? 'rounded-xl border border-white/10 bg-black/30 p-3'
    : 'rounded-2xl border border-white/10 bg-black/30 p-4 lg:max-h-[56rem] lg:overflow-y-auto';

  const titleClass = chatDrawer ? 'mb-1 text-base font-bold text-white' : 'mb-2 text-lg font-bold text-white sm:text-xl';
  const descClass = chatDrawer ? 'mb-2 text-[11px] leading-snug text-white/70' : 'mb-4 text-sm text-white/80';

  const listClass = embed
    ? 'grid w-full grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4'
    : chatDrawer
      ? 'flex flex-col gap-2'
      : 'space-y-4';

  return (
    <section className={sectionClass}>
      <h3 className={titleClass}>Leaderboard</h3>
      <p className={descClass}>
        Round counts and split times once the workout has started.
      </p>
      {participants.length === 0 ? (
        <p className="text-xs text-white/50 sm:text-sm">No rounds logged yet.</p>
      ) : (
        <ul className={listClass}>
          {participants.map((p, index) => (
            <li key={p.id} className={embed || chatDrawer ? 'min-w-0' : undefined}>
              <LeaderboardRow
                nickname={p.name}
                totalRounds={p.rounds}
                splits={p.splits}
                rank={index + 1}
                videoTrack={p.videoTrack ?? undefined}
                compact={chatDrawer}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
