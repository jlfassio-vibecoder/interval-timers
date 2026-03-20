import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parsePastedWorkoutViaApi } from './parseViaApi';

const mockWorkoutSet = {
  title: 'Test Workout',
  description: 'A sample workout',
  difficulty: 'intermediate' as const,
  workouts: [
    {
      title: 'Day 1',
      description: '',
      exerciseBlocks: [
        {
          exercises: [
            {
              order: 1,
              exerciseName: 'Push-ups',
              sets: 3,
              reps: '10',
              restSeconds: 60,
            },
          ],
        },
      ],
    },
  ],
};

describe('parsePastedWorkoutViaApi', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        return Promise.resolve(new Response(JSON.stringify({ workoutSet: mockWorkoutSet })));
      })
    );
  });

  afterEach(() => {
    vi.stubGlobal('fetch', originalFetch);
    vi.restoreAllMocks();
  });

  it('returns WorkoutSetTemplate on success', async () => {
    const result = await parsePastedWorkoutViaApi('3x10 push-ups');
    expect(result).toEqual(mockWorkoutSet);
    expect(result.title).toBe('Test Workout');
    expect(result.workouts).toHaveLength(1);
  });

  it('throws on API error response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: 'Model unavailable' }), { status: 500 })
        )
      )
    );
    await expect(parsePastedWorkoutViaApi('test')).rejects.toThrow('Model unavailable');
  });

  it('throws on invalid response (missing workoutSet)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({}), { status: 200 })
        )
      )
    );
    await expect(parsePastedWorkoutViaApi('test')).rejects.toThrow('Invalid response: missing workoutSet');
  });

  it('passes AbortSignal to fetch when provided', async () => {
    const controller = new AbortController();
    const fetchSpy = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ workoutSet: mockWorkoutSet })))
    );
    vi.stubGlobal('fetch', fetchSpy);
    await parsePastedWorkoutViaApi('test', controller.signal);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal })
    );
  });
});
