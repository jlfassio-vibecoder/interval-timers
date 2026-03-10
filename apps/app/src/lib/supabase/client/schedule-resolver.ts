/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Resolve today's workout from user's program and start date.
 */

import { supabase } from '../client';
import { getCurrentWeek } from './user-programs';
import type { ProgramSchedule } from '@/types/ai-program';

export type WorkoutFromSchedule = ProgramSchedule['workouts'][number];

export interface TodaysWorkoutResult {
  workout: WorkoutFromSchedule;
  weekNumber: number;
  workoutIndex: number;
}

/**
 * Get the workout scheduled for today for the given user and program.
 * Uses user_programs.start_date and program_weeks content; matches by today's weekday (0=Mon .. 6=Sun).
 * Returns null if no start date, not started, program past end, or no matching workout.
 */
export async function getTodaysWorkout(
  userId: string,
  programId: string
): Promise<TodaysWorkoutResult | null> {
  const { data: up, error: upError } = await supabase
    .from('user_programs')
    .select('start_date')
    .eq('user_id', userId)
    .eq('program_id', programId)
    .maybeSingle();

  if (upError || !up) return null;
  const startDate = up.start_date ?? null;

  const { data: program, error: progError } = await supabase
    .from('programs')
    .select('duration_weeks')
    .eq('id', programId)
    .single();

  if (progError || !program) return null;
  const durationWeeks = program.duration_weeks ?? 4;

  const { current: currentWeek, status } = getCurrentWeek(startDate, durationWeeks);
  if (status === 'not_started' || currentWeek < 1) return null;
  if (status === 'complete') return null;

  const { data: weekRows, error: weekError } = await supabase
    .from('program_weeks')
    .select('week_number, content')
    .eq('program_id', programId)
    .eq('week_number', currentWeek)
    .maybeSingle();

  if (weekError || !weekRows?.content) return null;

  const content = weekRows.content as {
    weekNumber?: number;
    workouts?: Array<ProgramSchedule['workouts'][number] & { scheduled_day?: number }>;
  } | null;
  const workouts = content?.workouts ?? [];
  if (workouts.length === 0) return null;

  // Monday = 0, Sunday = 6 (match ScheduleBuilder WeekView)
  const dayIndex = (new Date().getDay() + 6) % 7;
  const withDay = workouts.map((w, i) => ({
    w,
    i,
    day: (w as { scheduled_day?: number }).scheduled_day,
  }));
  const match = withDay.find((x) => x.day === dayIndex) ?? withDay[0];

  return {
    workout: match.w as WorkoutFromSchedule,
    weekNumber: currentWeek,
    workoutIndex: match.i,
  };
}

export type TodaysWorkoutOrRestResult =
  | { type: 'workout'; workout: WorkoutFromSchedule; weekNumber: number; workoutIndex: number }
  | { type: 'rest' };

/**
 * Get today's schedule: workout or rest day. Returns { type: 'rest' } when the week has
 * workouts but none scheduled for today's weekday.
 */
export async function getTodaysWorkoutOrRest(
  userId: string,
  programId: string
): Promise<TodaysWorkoutOrRestResult | null> {
  const { data: up, error: upError } = await supabase
    .from('user_programs')
    .select('start_date')
    .eq('user_id', userId)
    .eq('program_id', programId)
    .maybeSingle();

  if (upError || !up) return null;
  const startDate = up.start_date ?? null;

  const { data: program, error: progError } = await supabase
    .from('programs')
    .select('duration_weeks')
    .eq('id', programId)
    .single();

  if (progError || !program) return null;
  const durationWeeks = program.duration_weeks ?? 4;

  const { current: currentWeek, status } = getCurrentWeek(startDate, durationWeeks);
  if (status === 'not_started' || currentWeek < 1) return null;
  if (status === 'complete') return null;

  const { data: weekRows, error: weekError } = await supabase
    .from('program_weeks')
    .select('week_number, content')
    .eq('program_id', programId)
    .eq('week_number', currentWeek)
    .maybeSingle();

  if (weekError || !weekRows?.content) return null;

  const content = weekRows.content as {
    weekNumber?: number;
    workouts?: Array<ProgramSchedule['workouts'][number] & { scheduled_day?: number }>;
  } | null;
  const workouts = content?.workouts ?? [];
  if (workouts.length === 0) return null;

  const dayIndex = (new Date().getDay() + 6) % 7;
  const withDay = workouts.map((w, i) => ({
    w,
    i,
    day: (w as { scheduled_day?: number }).scheduled_day,
  }));
  const match = withDay.find((x) => x.day === dayIndex);

  if (match) {
    return {
      type: 'workout',
      workout: match.w as WorkoutFromSchedule,
      weekNumber: currentWeek,
      workoutIndex: match.i,
    };
  }
  return { type: 'rest' };
}
