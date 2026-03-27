/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Build week intensity chart series for Training Log cards.
 */

import type { WorkoutLog } from '@/types';
import type { TrainingLogFilters } from '@/lib/training-log-filters';
import type { ProfileBaseline } from '@/lib/met';
import type { TrainingLogWeek } from '@/lib/supabase/client/training-log';
import { trainingLogLogMatchesFilters } from '@/lib/supabase/client/training-log';
import { estimateSessionIntensity } from '@/lib/training-log-session-intensity';

export const MAX_WEEK_INTENSITY_SESSIONS = 50;

export interface WeekIntensitySession {
  id: string;
  dateISO: string;
  dayIndex: number;
  workoutName: string;
  effort: number;
  durationMinutes: number;
  intensityPercent: number;
  metValue: number | null;
}

export interface WeekIntensitySeries {
  sessions: WeekIntensitySession[];
  totalSessions: number;
  truncated: boolean;
  hiddenSessions: number;
  dailyIntensityPercent: number[]; // Mon..Sun, duration-weighted
}

function getStableSessionId(log: WorkoutLog): string {
  return log.id ?? `${log.date}:${log.workoutName}`;
}

function compareChronological(a: WorkoutLog, b: WorkoutLog): number {
  if (a.date < b.date) return -1;
  if (a.date > b.date) return 1;
  const aId = getStableSessionId(a);
  const bId = getStableSessionId(b);
  return aId.localeCompare(bId);
}

export function buildWeekIntensitySeries(
  week: TrainingLogWeek,
  filters: TrainingLogFilters | undefined,
  profileBaseline: ProfileBaseline | null
): WeekIntensitySeries {
  const allLogs = week.days.flatMap((day) => day.logs);
  const filtered = allLogs.filter((log) => trainingLogLogMatchesFilters(log, filters));
  filtered.sort(compareChronological);

  const totalSessions = filtered.length;
  const truncated = totalSessions > MAX_WEEK_INTENSITY_SESSIONS;
  const visibleLogs = truncated ? filtered.slice(0, MAX_WEEK_INTENSITY_SESSIONS) : filtered;

  const sessions: WeekIntensitySession[] = visibleLogs.map((log) => {
    const dayIndex = week.days.findIndex((day) => day.logs.some((item) => item.id === log.id));
    const intensity = estimateSessionIntensity(log, { profileBaseline });
    const durationMinutes = Math.max(0, Math.round((log.durationSeconds ?? 0) / 60));
    return {
      id: getStableSessionId(log),
      dateISO: log.date,
      dayIndex: dayIndex >= 0 ? dayIndex : 0,
      workoutName: log.workoutName,
      effort: log.effort ?? 5,
      durationMinutes,
      intensityPercent: intensity.percent,
      metValue: intensity.metValue,
    };
  });

  const dailyWeightedSum = Array.from({ length: 7 }, () => 0);
  const dailyMinutes = Array.from({ length: 7 }, () => 0);
  for (const session of sessions) {
    if (session.durationMinutes <= 0) continue;
    const d = Math.max(0, Math.min(6, session.dayIndex));
    dailyWeightedSum[d] += session.intensityPercent * session.durationMinutes;
    dailyMinutes[d] += session.durationMinutes;
  }
  const dailyIntensityPercent = dailyMinutes.map((mins, index) =>
    mins > 0 ? Math.round(dailyWeightedSum[index] / mins) : 0
  );

  return {
    sessions,
    totalSessions,
    truncated,
    hiddenSessions: Math.max(0, totalSessions - sessions.length),
    dailyIntensityPercent,
  };
}
