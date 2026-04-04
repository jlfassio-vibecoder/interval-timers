import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mocks.from,
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
  },
}));

import { computeTabataRemainingSec, useTabataEmbedded } from './useTabataEmbedded';
import { SETUP_DURATION_SECONDS } from '@interval-timers/timer-core';

describe('computeTabataRemainingSec', () => {
  it('uses SETUP_DURATION_SECONDS for setup phase', () => {
    const t0 = Date.now();
    const row = {
      id: 'x',
      trainer_live_session_id: 'y',
      work_seconds: 20,
      rest_seconds: 10,
      round_count: 8,
      workout_list: [],
      state: { phase: 'idle' as const, version: 1 },
    };
    const rem = computeTabataRemainingSec(
      row,
      {
        phase: 'setup',
        version: 2,
        phase_started_at: new Date(t0).toISOString(),
        current_interval: 0,
      },
      t0 + 3000
    );
    expect(rem).not.toBeNull();
    expect(rem).toBeGreaterThan(6.5);
    expect(rem).toBeLessThan(7.5);
    expect(SETUP_DURATION_SECONDS).toBe(10);
  });
});

describe('useTabataEmbedded', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: 't1',
              trainer_live_session_id: 'tl1',
              work_seconds: 20,
              rest_seconds: 10,
              round_count: 8,
              workout_list: [],
              state: { phase: 'idle', version: 1 },
            },
            error: null,
          }),
        }),
      }),
    });
    mocks.channel.mockReturnValue({
      on: () => ({ subscribe: () => ({}) }),
    });
  });

  it('throws when embedVideo is not trainer_live', () => {
    expect(() =>
      renderHook(() =>
        useTabataEmbedded({
          tabataSessionId: '550e8400-e29b-41d4-a716-446655440000',
          embedVideo: 'other' as 'trainer_live',
        })
      )
    ).toThrow(/useTabataEmbedded: unsupported embedVideo/);
  });

  it('loads tabata_sessions via Supabase (no Agora)', async () => {
    const { result } = renderHook(() =>
      useTabataEmbedded({
        tabataSessionId: '550e8400-e29b-41d4-a716-446655440000',
        embedVideo: 'trainer_live',
        isTrainer: false,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mocks.from).toHaveBeenCalledWith('tabata_sessions');
    expect(mocks.channel).toHaveBeenCalled();
  });
});
