import { describe, expect, it } from 'vitest';
import { addMinutesToWeekBuckets, mergeWorkoutDates } from './progress-analytics';

describe('mergeWorkoutDates', () => {
  it('dedupes by date and preserves first title per day', () => {
    const out = mergeWorkoutDates([
      { date: '2025-03-10', workoutTitle: 'Program A' },
      { date: '2025-03-10', workoutTitle: 'Timer B' },
      { date: '2025-03-11', workoutTitle: 'AMRAP' },
    ]);

    expect(out).toEqual([
      { date: '2025-03-10', workoutTitle: 'Program A' },
      { date: '2025-03-11', workoutTitle: 'AMRAP' },
    ]);
  });
});

describe('addMinutesToWeekBuckets', () => {
  it('accumulates rounded minutes into existing week buckets', () => {
    const buckets: Record<string, number> = { '2025-W01': 0 };
    const out = addMinutesToWeekBuckets(
      [
        { date: '2025-01-01', durationSeconds: 1800 },
        { date: '2025-01-02', durationSeconds: 600 },
      ],
      buckets
    );
    expect(out['2025-W01']).toBe(40);
  });
});
