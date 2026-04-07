/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  unifiedCalendarItemSortKey,
  type UnifiedCalendarItem,
} from '@/lib/supabase/admin/trainer-unified-calendar';

function sortItems(items: UnifiedCalendarItem[]): UnifiedCalendarItem[] {
  return [...items].sort((a, b) =>
    unifiedCalendarItemSortKey(a).localeCompare(unifiedCalendarItemSortKey(b))
  );
}

describe('unifiedCalendarItemSortKey', () => {
  it('orders scheduled live by scheduledStartAt among live_session', () => {
    const items: UnifiedCalendarItem[] = [
      {
        kind: 'live_session',
        sessionId: 's1',
        startAt: '2026-04-10T15:00:00.000Z',
        endAt: '2026-04-10T16:00:00.000Z',
        shell: 'video',
        status: 'active',
        participantSummaries: [],
      },
      {
        kind: 'scheduled_live_occurrence',
        occurrenceId: 'o1',
        seriesId: null,
        recurrenceSummary: null,
        scheduledStartAt: '2026-04-10T14:00:00.000Z',
        scheduledEndAt: '2026-04-10T15:00:00.000Z',
        status: 'scheduled',
        liveSessionId: null,
        pendingCount: 1,
        acceptedCount: 0,
        waitlistedCount: 0,
        declinedCount: 0,
        inviteSummaries: [],
      },
    ];
    const sorted = sortItems(items);
    expect(sorted[0]?.kind).toBe('scheduled_live_occurrence');
    expect(sorted[1]?.kind).toBe('live_session');
  });

  it('uses midnight UTC for program rows', () => {
    const prog: UnifiedCalendarItem = {
      kind: 'program',
      draggable: false,
      type: 'program',
      date: '2026-04-08',
      programId: 'p',
      weekId: 'w',
      workoutIndex: 0,
      workoutTitle: 'A',
      status: 'planned',
      clientUserId: 'u1',
      clientLabel: 'C',
    };
    expect(unifiedCalendarItemSortKey(prog)).toBe('2026-04-08T00:00:00.000Z');
  });
});
