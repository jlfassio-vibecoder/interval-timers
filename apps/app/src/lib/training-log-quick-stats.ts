import type { WorkoutLog } from '@/types';
import {
  getTrainingLogLocalTodayISO,
  getTrainingLogWeekMonday,
} from '@/lib/supabase/client/training-log';

export interface TrainingLogQuickStats {
  weekStreak: number;
  sessionsThisMonth: number;
  dayStreak: number;
  minutesThisMonth: number;
}

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthPrefix(iso: string): string {
  return iso.slice(0, 7);
}

function uniqueLogDates(logs: Pick<WorkoutLog, 'date'>[]): Set<string> {
  return new Set(logs.map((log) => log.date).filter(Boolean));
}

function weekStreakFromDates(dates: Set<string>, todayISO: string): number {
  const weeksWithWork = new Set(
    Array.from(dates.values()).map((date) => getTrainingLogWeekMonday(date))
  );
  let streak = 0;
  let checkMonday = getTrainingLogWeekMonday(todayISO);
  while (weeksWithWork.has(checkMonday)) {
    streak += 1;
    checkMonday = addDays(checkMonday, -7);
  }
  return streak;
}

function dayStreakFromDates(dates: Set<string>, todayISO: string): number {
  // Forgiving rule: if no session yet today, start from yesterday.
  let checkDay = dates.has(todayISO) ? todayISO : addDays(todayISO, -1);
  let streak = 0;
  while (dates.has(checkDay)) {
    streak += 1;
    checkDay = addDays(checkDay, -1);
  }
  return streak;
}

function weekMinutesByMonday(
  logs: Pick<WorkoutLog, 'date' | 'durationSeconds'>[]
): Map<string, number> {
  const byMonday = new Map<string, number>();
  for (const log of logs) {
    if (!log.date) continue;
    const monday = getTrainingLogWeekMonday(log.date);
    const addMinutes = Math.max(0, (log.durationSeconds ?? 0) / 60);
    byMonday.set(monday, (byMonday.get(monday) ?? 0) + addMinutes);
  }
  return byMonday;
}

export function computeTimeStreakWeeks(
  logs: Pick<WorkoutLog, 'date' | 'durationSeconds'>[],
  weeklyTargetMinutes: number,
  todayISO: string = getTrainingLogLocalTodayISO()
): number {
  const target = Math.max(1, Math.round(weeklyTargetMinutes));
  const byMonday = weekMinutesByMonday(logs);
  let streak = 0;
  let checkMonday = getTrainingLogWeekMonday(todayISO);
  while ((byMonday.get(checkMonday) ?? 0) >= target) {
    streak += 1;
    checkMonday = addDays(checkMonday, -7);
  }
  return streak;
}

export function computeTrainingLogQuickStats(
  logs: Pick<WorkoutLog, 'date' | 'durationSeconds'>[],
  todayISO: string = getTrainingLogLocalTodayISO()
): TrainingLogQuickStats {
  const dates = uniqueLogDates(logs);
  const month = monthPrefix(todayISO);
  let sessionsThisMonth = 0;
  let minutesThisMonth = 0;

  for (const log of logs) {
    if (!log.date || monthPrefix(log.date) !== month) continue;
    sessionsThisMonth += 1;
    const durationSeconds = log.durationSeconds ?? 0;
    if (durationSeconds > 0) minutesThisMonth += durationSeconds / 60;
  }

  return {
    weekStreak: weekStreakFromDates(dates, todayISO),
    sessionsThisMonth,
    dayStreak: dayStreakFromDates(dates, todayISO),
    minutesThisMonth: Math.round(minutesThisMonth),
  };
}
