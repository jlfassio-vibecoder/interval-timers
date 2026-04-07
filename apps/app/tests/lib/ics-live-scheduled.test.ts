/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { buildIcsFromEvents } from '@/lib/ics-export';
import type { CalendarEvent } from '@/lib/calendar-events';

describe('buildIcsFromEvents live_scheduled', () => {
  it('emits timed VEVENT with DTSTART, DTEND, and stable UID from occurrence id', () => {
    const ev: CalendarEvent = {
      type: 'live_scheduled',
      date: '2026-04-10',
      workoutTitle: 'Live session',
      status: 'scheduled',
      metadata: {
        scheduledAt: '2026-04-10T15:00:00.000Z',
        scheduledEndAt: '2026-04-10T16:30:00.000Z',
        occurrenceId: 'occ-test-1',
        liveInviteId: 'inv-99',
        inviteStatus: 'accepted',
      },
    };
    const ics = buildIcsFromEvents([ev]);
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('DTSTART:20260410T150000Z');
    expect(ics).toContain('DTEND:20260410T163000Z');
    expect(ics).toMatch(/UID:live_scheduled-2026-04-10-live-occ-occ-test-1@interval-timers/);
    expect(ics).not.toContain('DTSTART;VALUE=DATE:20260410');
  });
});
