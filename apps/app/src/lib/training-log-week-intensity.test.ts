import { describe, expect, it } from 'vitest';
import type { WorkoutLog } from '@/types';
import type { ProfileBaseline } from '@/lib/met';
import type { TrainingLogWeek } from '@/lib/supabase/client/training-log';
import {
  buildWeekIntensitySeries,
  MAX_WEEK_INTENSITY_SESSIONS,
} from './training-log-week-intensity';

const baseline: ProfileBaseline = {
  dateOfBirth: '1991-05-06',
  biologicalSex: 'female',
  weightKg: 70,
  heightCm: 168,
};

function makeLog(
  dayDate: string,
  id: string,
  effort: number,
  durationMinutes: number,
  source = 'hiit'
): WorkoutLog {
  return {
    id,
    userId: 'u1',
    workoutName: `Workout ${id}`,
    date: dayDate,
    effort,
    rating: 3,
    notes: '',
    durationSeconds: durationMinutes * 60,
    source,
  };
}

function makeEmptyWeek(): TrainingLogWeek {
  const dates = [
    '2026-03-23',
    '2026-03-24',
    '2026-03-25',
    '2026-03-26',
    '2026-03-27',
    '2026-03-28',
    '2026-03-29',
  ];
  return {
    weekMonday: '2026-03-23',
    range: 'Mar 23 - Mar 29',
    totalMinutes: 0,
    plannedWeekMinutes: 0,
    logsByDate: {},
    days: dates.map((dateISO) => ({
      count: 0,
      minutes: 0,
      isEmpty: true,
      logs: [],
      dateISO,
      plannedMinutes: 0,
    })),
  };
}

describe('buildWeekIntensitySeries', () => {
  it('builds daily duration-weighted intensity', () => {
    const week = makeEmptyWeek();
    week.days[0].logs = [
      makeLog('2026-03-23', 'a', 10, 30, 'tabata'),
      makeLog('2026-03-23', 'b', 1, 10, 'walk'),
    ];
    week.days[3].logs = [makeLog('2026-03-26', 'c', 6, 20, 'strength')];

    const series = buildWeekIntensitySeries(week, undefined, baseline);

    expect(series.sessions).toHaveLength(3);
    expect(series.dailyIntensityPercent[0]).toBeGreaterThan(series.dailyIntensityPercent[3]);
    expect(series.dailyIntensityPercent[1]).toBe(0);
    expect(series.dailyIntensityPercent[6]).toBe(0);
  });

  it('caps visible sessions at 50 and reports truncation', () => {
    const week = makeEmptyWeek();
    for (let i = 0; i < MAX_WEEK_INTENSITY_SESSIONS + 7; i++) {
      week.days[i % 7].logs.push(makeLog(week.days[i % 7].dateISO, `id-${i}`, 5, 10, 'hiit'));
    }
    const series = buildWeekIntensitySeries(week, undefined, baseline);
    expect(series.truncated).toBe(true);
    expect(series.sessions).toHaveLength(MAX_WEEK_INTENSITY_SESSIONS);
    expect(series.hiddenSessions).toBe(7);
  });
});
