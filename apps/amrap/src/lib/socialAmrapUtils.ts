import type { AmrapRoundRow, AmrapParticipantRow } from '@/lib/supabase';
import type { SessionTimerState } from '@/hooks/useSessionState';

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function formatScheduledAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function getTimerStyles(timerState: SessionTimerState) {
  switch (timerState) {
    case 'setup':
      return { text: 'Setup', sub: 'Get into position' };
    case 'work':
      return { text: 'AMRAP', sub: 'Accumulate Volume' };
    case 'finished':
      return { text: 'Time Cap', sub: 'Work Complete' };
    default:
      return { text: 'Ready', sub: '' };
  }
}

export function buildLeaderboard(
  participants: AmrapParticipantRow[],
  rounds: AmrapRoundRow[]
): { participantId: string; nickname: string; totalRounds: number; splits: number[] }[] {
  const byParticipant = new Map<
    string,
    { nickname: string; elapsed: number[] }
  >();
  for (const p of participants) {
    byParticipant.set(p.id, { nickname: p.nickname, elapsed: [] });
  }
  for (const r of rounds) {
    const entry = byParticipant.get(r.participant_id);
    if (entry) {
      entry.elapsed.push(r.elapsed_sec_at_round);
    }
  }
  return Array.from(byParticipant.entries())
    .map(([participantId, { nickname, elapsed }]) => {
      elapsed.sort((a, b) => a - b);
      const splits: number[] = [];
      for (let i = 0; i < elapsed.length; i++) {
        splits.push(i === 0 ? elapsed[0]! : elapsed[i]! - elapsed[i - 1]!);
      }
      return {
        participantId,
        nickname,
        totalRounds: elapsed.length,
        splits,
      };
    })
    .sort((a, b) => b.totalRounds - a.totalRounds);
}
