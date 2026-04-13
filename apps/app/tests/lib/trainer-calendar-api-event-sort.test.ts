/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  compareTrainerCalendarApiEvents,
  trainerCalendarApiEventKindRank,
  type TrainerCalendarApiEvent,
} from '@/lib/supabase/admin/trainer-client-calendar';

function prog(date: string, workoutIndex: number): TrainerCalendarApiEvent {
  return {
    kind: 'program',
    draggable: false,
    type: 'program',
    date,
    programId: 'p1',
    weekId: 'w1',
    workoutIndex,
    workoutTitle: 'W',
    status: 'planned',
  };
}

function coach(date: string, at: string): TrainerCalendarApiEvent {
  return {
    kind: 'coach_instance',
    draggable: true,
    instanceId: 'i1',
    assignmentId: 'a1',
    assignmentType: 'workout',
    title: 'Coach',
    scheduledAt: at,
    date,
  };
}

function sw(date: string, at: string): TrainerCalendarApiEvent {
  return {
    kind: 'scheduled_workout',
    draggable: false,
    sourceId: 's1',
    scheduledAt: at,
    date,
    title: 'Tabata',
    sourceApp: 'tabata',
  };
}

describe('trainerCalendarApiEventKindRank', () => {
  it('orders program before client-originated before coach', () => {
    expect(trainerCalendarApiEventKindRank(prog('2026-04-01', 0))).toBe(0);
    expect(trainerCalendarApiEventKindRank(sw('2026-04-01', '2026-04-01T10:00:00.000Z'))).toBe(1);
    expect(
      trainerCalendarApiEventKindRank({
        kind: 'amrap_scheduled',
        draggable: false,
        sourceId: 'x',
        scheduledAt: '2026-04-01T11:00:00.000Z',
        date: '2026-04-01',
        title: 'AMRAP',
        durationMinutes: 12,
      })
    ).toBe(1);
    expect(trainerCalendarApiEventKindRank(coach('2026-04-01', '2026-04-01T12:00:00.000Z'))).toBe(
      2
    );
  });
});

describe('compareTrainerCalendarApiEvents', () => {
  it('sorts same day by kind rank then time', () => {
    const a = [
      coach('2026-04-01', '2026-04-01T18:00:00.000Z'),
      sw('2026-04-01', '2026-04-01T09:00:00.000Z'),
      prog('2026-04-01', 1),
      prog('2026-04-01', 0),
    ];
    const sorted = [...a].sort(compareTrainerCalendarApiEvents);
    expect(sorted[0]?.kind).toBe('program');
    expect(sorted[1]?.kind).toBe('program');
    expect(sorted[2]?.kind).toBe('scheduled_workout');
    expect(sorted[3]?.kind).toBe('coach_instance');
  });
});
