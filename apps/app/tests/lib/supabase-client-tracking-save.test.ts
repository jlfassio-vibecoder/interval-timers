/**
 * saveWorkoutLog insert payload (coach assignment columns).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveWorkoutLog } from '@/lib/supabase/client/tracking';

const insertMock = vi.fn();

vi.mock('@/lib/supabase/supabase-instance', () => ({
  supabase: {
    from: () => ({
      insert: (payload: unknown) => {
        insertMock(payload);
        return {
          select: () => ({
            single: async () => ({ data: { id: 'new-id' }, error: null }),
          }),
        };
      },
    }),
  },
}));

describe('saveWorkoutLog', () => {
  beforeEach(() => {
    insertMock.mockClear();
  });

  it('includes coach columns when present on WorkoutLog', async () => {
    const d = new Date('2026-01-15T12:00:00');
    await saveWorkoutLog('user-1', {
      programId: 'p',
      weekId: 'w',
      workoutId: 'wo',
      date: d,
      durationSeconds: 60,
      exercises: [],
      coachAssignmentId: '  ca-1  ',
      coachResourceId: 'res-1',
      coachAssignmentType: 'workout',
    });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        coach_assignment_id: 'ca-1',
        coach_resource_id: 'res-1',
        coach_assignment_type: 'workout',
      })
    );
  });
});
