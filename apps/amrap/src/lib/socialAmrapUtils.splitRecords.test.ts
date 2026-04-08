import { describe, it, expect } from 'vitest';
import { buildSplitRecordsForSegment } from './socialAmrapUtils';
import type { AmrapParticipantRow, AmrapRoundRow } from './supabase';

describe('buildSplitRecordsForSegment', () => {
  it('derives per-round split from cumulative elapsed', () => {
    const participants: AmrapParticipantRow[] = [
      {
        id: 'p1',
        session_id: 's1',
        nickname: 'A',
        role: 'joiner',
        joined_at: 'x',
      },
    ];
    const rounds: AmrapRoundRow[] = [
      {
        id: 'r1',
        session_id: 's1',
        participant_id: 'p1',
        round_index: 1,
        elapsed_sec_at_round: 30,
        segment_index: 0,
      },
      {
        id: 'r2',
        session_id: 's1',
        participant_id: 'p1',
        round_index: 2,
        elapsed_sec_at_round: 55,
        segment_index: 0,
      },
    ];
    const out = buildSplitRecordsForSegment(participants, rounds, 0);
    expect(out).toHaveLength(2);
    const byId = Object.fromEntries(out.map((x) => [x.id, x]));
    expect(byId.r1?.split_time_sec).toBe(30);
    expect(byId.r2?.split_time_sec).toBe(25);
  });
});
