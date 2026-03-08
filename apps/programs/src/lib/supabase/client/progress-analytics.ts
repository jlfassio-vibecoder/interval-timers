/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Progress analytics for Zone 3 (Quick Stats) and Zone 4.
 * Uses user_workout_logs (set-level logs from WorkoutPlayer).
 */

import { supabase } from '../client';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
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
  const today = todayISO();
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
  const startStr = start.toISOString().slice(0, 10);

  const { data: rows, error } = await supabase
    .from('user_workout_logs')
    .select('date')
    .eq('user_id', userId)
    .gte('date', startStr)
    .order('date', { ascending: false });

  if (error) return { weekStreak: 0, monthlyCount: 0 };

  const dates = (rows ?? []).map((r) => r.date as string);
  const uniqueDates = [...new Set(dates)];

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyCount = dates.filter((d) => new Date(d) >= thisMonthStart).length;

  const weeksWithWork = new Set<string>();
  for (const d of uniqueDates) {
    weeksWithWork.add(getISOWeek(d));
  }

  const currentWeekKey = getISOWeek(now.toISOString().slice(0, 10));
  let weekStreak = 0;
  let check = currentWeekKey;
  while (weeksWithWork.has(check)) {
    weekStreak++;
    check = getPrevWeek(check);
  }

  return { weekStreak, monthlyCount };
}

/** Return ISO week key (YYYY-Www) for the week containing the given UTC date. */
function getISOWeekKeyFromUTCDate(d: Date): string {
  const thu = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = thu.getUTCDay();
  const thuOffset = (4 - day + 7) % 7;
  thu.setUTCDate(thu.getUTCDate() + thuOffset);
  const y = thu.getUTCFullYear();
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const week1Thu = new Date(jan4);
  week1Thu.setUTCDate(jan4.getUTCDate() + ((4 - jan4.getUTCDay() + 7) % 7));
  const weekNo = 1 + Math.floor((thu.getTime() - week1Thu.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${y}-W${String(weekNo).padStart(2, '0')}`;
}

/** Previous ISO week by subtracting 7 days (handles 53-week years). */
function getPrevWeek(weekKey: string): string {
  const [y, w] = weekKey.split('-W').map((s) => parseInt(s, 10));
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const week1Mon = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  const mondayOfWeek = new Date(week1Mon);
  mondayOfWeek.setUTCDate(week1Mon.getUTCDate() + (w - 1) * 7);
  const prevMonday = new Date(mondayOfWeek);
  prevMonday.setUTCDate(mondayOfWeek.getUTCDate() - 7);
  return getISOWeekKeyFromUTCDate(prevMonday);
}

function getISOWeek(dateStr: string): string {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const thursday = new Date(d);
  thursday.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const jan1 = new Date(thursday.getFullYear(), 0, 1);
  const weekNo = Math.ceil(
    ((thursday.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7
  );
  return `${thursday.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export interface WeeklyVolume {
  weekKey: string;
  setsCount: number;
}

/**
 * Get total sets completed per week for the last N weeks (Zone 4 Volume chart).
 */
export async function getVolumeByWeek(userId: string, weeks: number = 8): Promise<WeeklyVolume[]> {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - weeks * 7);
  const startStr = start.toISOString().slice(0, 10);

  const { data: rows, error } = await supabase
    .from('user_workout_logs')
    .select('date, exercises')
    .eq('user_id', userId)
    .gte('date', startStr)
    .lte('date', todayISO())
    .order('date', { ascending: true });

  if (error) return [];

  const weekKeys: string[] = [];
  const byWeek: Record<string, number> = {};
  for (let i = 0; i < weeks; i++) {
    const w = new Date(now);
    w.setDate(w.getDate() - (weeks - 1 - i) * 7);
    const key = getISOWeek(w.toISOString().slice(0, 10));
    weekKeys.push(key);
    byWeek[key] = 0;
  }

  for (const row of rows ?? []) {
    const weekKey = getISOWeek(row.date as string);
    if (!(weekKey in byWeek)) continue;
    const exercises = (row.exercises as { sets?: { completed?: boolean }[] }[]) ?? [];
    let count = 0;
    for (const ex of exercises) {
      const sets = ex.sets ?? [];
      for (const s of sets) {
        if (s.completed) count++;
      }
    }
    byWeek[weekKey] = (byWeek[weekKey] ?? 0) + count;
  }

  return weekKeys.map((weekKey) => ({
    weekKey,
    setsCount: byWeek[weekKey] ?? 0,
  }));
}

export interface WorkoutDateEntry {
  date: string;
  workoutTitle?: string;
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
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const { data: rows, error } = await supabase
    .from('user_workout_logs')
    .select('date, exercises')
    .eq('user_id', userId)
    .gte('date', startStr)
    .lte('date', endStr)
    .order('date', { ascending: true });

  if (error) return [];

  const byDate = new Map<string, string>();
  for (const row of rows ?? []) {
    const date = row.date as string;
    const exercises = (row.exercises as { exerciseName?: string }[]) ?? [];
    const title = exercises[0]?.exerciseName ?? 'Workout';
    if (!byDate.has(date)) byDate.set(date, title);
  }

  return Array.from(byDate.entries()).map(([date, workoutTitle]) => ({
    date,
    workoutTitle,
  }));
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

  if (error) return [];

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
