import type { AmrapRoundRow, AmrapParticipantRow } from '@/lib/supabase';
import type { AmrapSplitRecord } from '@/lib/amrapSplitTypes';
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

/**
 * Cumulative seconds into the AMRAP work segment for `log_round`.
 * Uses `totalTime - timeLeft` (pause-aware when the local clock is synced). For a participant’s
 * **first** round in the segment, also compares wall time since `session.started_at` so clients
 * who briefly show a full clock (local `timeLeft ≈ totalTime` while work has actually started)
 * do not log ~0 for round 1.
 */
export function computeElapsedSecForLogRound(input: {
  totalTime: number;
  timeLeft: number;
  timerState: SessionTimerState;
  isPaused: boolean;
  session: {
    started_at?: string | null;
    timer_segment?: 'amrap' | 'free_workout' | null;
  } | null;
  /** Count of this participant’s rounds already in the current segment (`useAmrapSession` scope). */
  participantRoundCountInSegment: number;
  nowMs?: number;
}): number {
  const {
    totalTime,
    timeLeft,
    timerState,
    isPaused,
    session,
    participantRoundCountInSegment,
    nowMs = Date.now(),
  } = input;

  const fromTimer = Math.max(0, Math.min(totalTime, totalTime - timeLeft));

  if (
    timerState !== 'work' ||
    isPaused ||
    session?.timer_segment !== 'amrap' ||
    !session?.started_at ||
    participantRoundCountInSegment > 0
  ) {
    return fromTimer;
  }

  const startedMs = new Date(session.started_at).getTime();
  if (!Number.isFinite(startedMs)) {
    return fromTimer;
  }

  const wallElapsed = Math.floor((nowMs - startedMs) / 1000);
  const clampedWall = Math.max(0, Math.min(totalTime, wallElapsed));

  return Math.max(fromTimer, clampedWall);
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

/** Flat list of every logged round in a segment with per-round split times (for shared grids). */
export function buildSplitRecordsForSegment(
  participants: AmrapParticipantRow[],
  rounds: AmrapRoundRow[],
  segmentIndex: number
): AmrapSplitRecord[] {
  const nick = new Map(participants.map((p) => [p.id, p.nickname]));
  const userByParticipant = new Map(
    participants.map((p) => [p.id, p.user_id ?? null] as const)
  );
  const scoped = rounds.filter((r) => (r.segment_index ?? 0) === segmentIndex);
  const byParticipant = new Map<string, AmrapRoundRow[]>();
  for (const r of scoped) {
    const list = byParticipant.get(r.participant_id) ?? [];
    list.push(r);
    byParticipant.set(r.participant_id, list);
  }
  for (const list of byParticipant.values()) {
    list.sort((a, b) => a.round_index - b.round_index);
  }

  const out: AmrapSplitRecord[] = [];
  for (const list of byParticipant.values()) {
    let prevElapsedSecAtRound: number | undefined;
    for (const r of list) {
      const split =
        prevElapsedSecAtRound != null
          ? r.elapsed_sec_at_round - prevElapsedSecAtRound
          : r.elapsed_sec_at_round;
      const uid = userByParticipant.get(r.participant_id);
      out.push({
        id: r.id,
        session_id: r.session_id,
        participant_id: r.participant_id,
        round_number: r.round_index,
        split_time_sec: split,
        segment_index: r.segment_index ?? 0,
        nickname: nick.get(r.participant_id) ?? 'Unknown',
        user_id: uid ?? undefined,
      });
      prevElapsedSecAtRound = r.elapsed_sec_at_round;
    }
  }
  const elapsedByRoundId = new Map(scoped.map((x) => [x.id, x.elapsed_sec_at_round]));
  out.sort(
    (a, b) => (elapsedByRoundId.get(b.id) ?? 0) - (elapsedByRoundId.get(a.id) ?? 0)
  );
  return out;
}
