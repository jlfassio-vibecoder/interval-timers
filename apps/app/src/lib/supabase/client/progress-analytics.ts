/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Progress analytics for Zone 3 (Quick Stats) and Zone 4.
 * Uses user_workout_logs, workout_logs (excluding readiness rows), and AMRAP results.
 */

import { supabase } from '../supabase-instance';
import { computeTrainingLogQuickStats } from '@/lib/training-log-quick-stats';
import { getAmrapSessionDisplayTitle } from '@/lib/amrap-preset-name';
import { getAmrapSessionResults } from './amrap-session-results';
import { getTrainingLogLocalTodayISO } from './training-log';

/** YYYY-MM-DD in the user's local calendar (matches Training Log / quick-stats). */
function localDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface TodaysWorkoutLogResult {
  id: string;
  programId: string;
  weekId: string;
  workoutId: string;
  durationSeconds: number;
}

/**
 * Get today's workout log if the user has logged a session today.
 */
export async function getTodaysWorkoutLog(userId: string): Promise<TodaysWorkoutLogResult | null> {
  const today = getTrainingLogLocalTodayISO();
  const { data, error } = await supabase
    .from('user_workout_logs')
    .select('id, program_id, week_id, workout_id, duration_seconds')
    .eq('user_id', userId)
    .eq('date', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id,
    programId: data.program_id,
    weekId: data.week_id,
    workoutId: data.workout_id,
    durationSeconds: data.duration_seconds ?? 0,
  };
}

/** Max days back for streak + monthly count to avoid unbounded query as table grows. */
const STREAK_QUERY_DAYS = 370;

/**
 * Get week streak (consecutive weeks with >= 1 workout) and workouts this month.
 */
export async function getStreakData(userId: string): Promise<{
  weekStreak: number;
  monthlyCount: number;
}> {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - STREAK_QUERY_DAYS);
  const startStr = localDateISO(start);

  const [workoutLogsRes, userWorkoutLogsRes, amrapResults] = await Promise.all([
    supabase
      .from('workout_logs')
      .select('date')
      .eq('user_id', userId)
      .neq('workout_name', 'Readiness')
      .gte('date', startStr)
      .order('date', { ascending: false }),
    supabase
      .from('user_workout_logs')
      .select('date')
      .eq('user_id', userId)
      .gte('date', startStr)
      .order('date', { ascending: false }),
    getAmrapSessionResults(userId, 100).catch(() => []),
  ]);

  if (workoutLogsRes.error || userWorkoutLogsRes.error) return { weekStreak: 0, monthlyCount: 0 };

  const logsLike = [
    ...((workoutLogsRes.data ?? []) as Array<{ date: string }>),
    ...((userWorkoutLogsRes.data ?? []) as Array<{ date: string }>),
    ...amrapResults
      .map((r) => ({ date: (r.completed_at ?? '').slice(0, 10) }))
      .filter((r) => r.date >= startStr),
  ];

  const stats = computeTrainingLogQuickStats(logsLike);
  return { weekStreak: stats.weekStreak, monthlyCount: stats.sessionsThisMonth };
}

export interface WeeklyVolume {
  weekKey: string;
  minutes: number;
}

interface MinuteRow {
  date: string;
  durationSeconds: number;
}

function getISOWeek(dateStr: string): string {
  // T12:00:00 avoids UTC/local day skew from parsing YYYY-MM-DD alone (same as training-log.ts).
  const d = new Date(dateStr + 'T12:00:00');
  d.setHours(0, 0, 0, 0);
  const thursday = new Date(d);
  thursday.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const jan1 = new Date(thursday.getFullYear(), 0, 1);
  const weekNo = Math.ceil(
    ((thursday.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7
  );
  return `${thursday.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Get total workout minutes per week for the last N weeks (Zone 4 Volume chart).
 */
export async function getVolumeByWeek(userId: string, weeks: number = 8): Promise<WeeklyVolume[]> {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - weeks * 7);
  const startStr = localDateISO(start);
  const endStr = getTrainingLogLocalTodayISO();

  const [workoutLogsRes, userWorkoutLogsRes, amrapResults] = await Promise.all([
    supabase
      .from('workout_logs')
      .select('date, duration_seconds, workout_name')
      .eq('user_id', userId)
      .neq('workout_name', 'Readiness')
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true }),
    supabase
      .from('user_workout_logs')
      .select('date, duration_seconds')
      .eq('user_id', userId)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true }),
    // RPC caps at 100; larger requests do not fetch more rows (see amrap-session-results.ts).
    getAmrapSessionResults(userId, 100).catch(() => []),
  ]);

  if (workoutLogsRes.error) throw workoutLogsRes.error;
  if (userWorkoutLogsRes.error) throw userWorkoutLogsRes.error;

  const weekKeys: string[] = [];
  const byWeek: Record<string, number> = {};
  for (let i = 0; i < weeks; i++) {
    const w = new Date(now);
    w.setDate(w.getDate() - (weeks - 1 - i) * 7);
    const key = getISOWeek(localDateISO(w));
    weekKeys.push(key);
    byWeek[key] = 0;
  }

  const minuteRows: MinuteRow[] = [
    ...((workoutLogsRes.data ?? []).map((row) => ({
      date: row.date as string,
      durationSeconds: (row.duration_seconds as number | null) ?? 0,
    })) as MinuteRow[]),
    ...((userWorkoutLogsRes.data ?? []).map((row) => ({
      date: row.date as string,
      durationSeconds: (row.duration_seconds as number | null) ?? 0,
    })) as MinuteRow[]),
  ];

  for (const row of amrapResults) {
    const completedAt = row.completed_at ?? '';
    const date = completedAt.slice(0, 10);
    if (!date || date < startStr || date > endStr) continue;
    minuteRows.push({
      date,
      durationSeconds: Math.round(((row.duration_minutes ?? 0) as number) * 60),
    });
  }

  addMinutesToWeekBuckets(minuteRows, byWeek);

  return weekKeys.map((weekKey) => ({
    weekKey,
    minutes: byWeek[weekKey] ?? 0,
  }));
}

export interface WorkoutDateEntry {
  date: string;
  workoutTitle?: string;
}

async function getMergedWorkoutDateEntries(
  userId: string,
  startStr: string,
  endStr: string
): Promise<WorkoutDateEntry[]> {
  const [workoutLogsRes, userWorkoutLogsRes, amrapResults] = await Promise.all([
    supabase
      .from('workout_logs')
      .select('date, workout_name')
      .eq('user_id', userId)
      .neq('workout_name', 'Readiness')
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true }),
    supabase
      .from('user_workout_logs')
      .select('date, exercises')
      .eq('user_id', userId)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true }),
    getAmrapSessionResults(userId, 100).catch(() => []),
  ]);

  if (workoutLogsRes.error) throw workoutLogsRes.error;
  if (userWorkoutLogsRes.error) throw userWorkoutLogsRes.error;

  const entries: WorkoutDateEntry[] = [
    ...((workoutLogsRes.data ?? []).map((row) => ({
      date: row.date as string,
      workoutTitle: ((row.workout_name as string | null) ?? 'Workout').trim() || 'Workout',
    })) as WorkoutDateEntry[]),
    ...((userWorkoutLogsRes.data ?? []).map((row) => {
      const exercises = (row.exercises as { exerciseName?: string }[]) ?? [];
      return {
        date: row.date as string,
        workoutTitle: exercises[0]?.exerciseName ?? 'Workout',
      };
    }) as WorkoutDateEntry[]),
  ];

  for (const row of amrapResults) {
    const completedAt = row.completed_at ?? '';
    const date = completedAt.slice(0, 10);
    if (!date || date < startStr || date > endStr) continue;
    entries.push({
      date,
      workoutTitle: getAmrapSessionDisplayTitle(row.workout_name, row.workout_list),
    });
  }

  return mergeWorkoutDates(entries);
}

/**
 * Get dates with logged workouts for the past N days (Zone 4 heatmap).
 */
export async function getWorkoutDates(
  userId: string,
  daysBack: number = 365
): Promise<WorkoutDateEntry[]> {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - daysBack);
  const startStr = localDateISO(start);
  const endStr = localDateISO(end);

  return getMergedWorkoutDateEntries(userId, startStr, endStr);
}

export interface PersonalRecordEntry {
  exerciseName: string;
  weight: number;
  date: string;
  previousWeight?: number;
}

/**
 * Get recent personal records (new max weight per exercise) from set-level logs.
 */
export async function getPersonalRecords(
  userId: string,
  limit: number = 10
): Promise<PersonalRecordEntry[]> {
  const { data: rows, error } = await supabase
    .from('user_workout_logs')
    .select('date, exercises')
    .eq('user_id', userId)
    .order('date', { ascending: true });

  if (error) throw error;

  type DateWeight = { date: string; weight: number };
  const byExercise = new Map<string, DateWeight[]>();

  for (const row of rows ?? []) {
    const date = row.date as string;
    const exercises =
      (row.exercises as {
        exerciseName?: string;
        sets?: { actualWeight?: number; completed?: boolean }[];
      }[]) ?? [];
    for (const ex of exercises) {
      const name = ex.exerciseName ?? 'Unknown';
      const sets = ex.sets ?? [];
      let maxWeight = 0;
      for (const s of sets) {
        if (s.completed && typeof s.actualWeight === 'number' && s.actualWeight > 0) {
          maxWeight = Math.max(maxWeight, s.actualWeight);
        }
      }
      if (maxWeight <= 0) continue;
      if (!byExercise.has(name)) byExercise.set(name, []);
      byExercise.get(name)!.push({ date, weight: maxWeight });
    }
  }

  const prs: PersonalRecordEntry[] = [];
  for (const [exerciseName, dateWeights] of byExercise) {
    let prevMax = 0;
    for (const { date, weight } of dateWeights) {
      if (weight > prevMax) {
        prs.push({
          exerciseName,
          weight,
          date,
          previousWeight: prevMax > 0 ? prevMax : undefined,
        });
        prevMax = weight;
      }
    }
  }
  prs.sort((a, b) => b.date.localeCompare(a.date));
  return prs.slice(0, limit);
}

export function mergeWorkoutDates(entries: WorkoutDateEntry[]): WorkoutDateEntry[] {
  const byDate = new Map<string, string>();
  for (const entry of entries) {
    const date = entry.date;
    if (!date) continue;
    const title = entry.workoutTitle?.trim() || 'Workout';
    if (!byDate.has(date)) byDate.set(date, title);
  }
  return Array.from(byDate.entries()).map(([date, workoutTitle]) => ({
    date,
    workoutTitle,
  }));
}

export function addMinutesToWeekBuckets(
  rows: MinuteRow[],
  byWeek: Record<string, number>
): Record<string, number> {
  for (const row of rows) {
    const weekKey = getISOWeek(row.date);
    if (!(weekKey in byWeek)) continue;
    const minutes = Math.max(0, Math.round((row.durationSeconds ?? 0) / 60));
    byWeek[weekKey] = (byWeek[weekKey] ?? 0) + minutes;
  }
  return byWeek;
}
