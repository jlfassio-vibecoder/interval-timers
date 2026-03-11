/**
 * Client-side user program access and program schedule. Replaces firebase/client/user-programs.
 */

import { supabase } from '../supabase-instance';
import type { UserProgramAccess } from '@/types/user-program';
import type { ProgramSchedule } from '@/types/ai-program';

/** Week/progress from start_date and duration; for Active Program Card. */
export function getCurrentWeek(
  startDate: string | null | undefined,
  durationWeeks: number
): { current: number; total: number; status: 'not_started' | 'in_progress' | 'complete' } {
  const total = Math.max(1, durationWeeks);
  if (!startDate) {
    return { current: 0, total, status: 'not_started' };
  }
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (today < start) {
    return { current: 0, total, status: 'not_started' };
  }
  const diffMs = today.getTime() - start.getTime();
  const daysSinceStart = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const current = Math.min(Math.floor(daysSinceStart / 7) + 1, total);
  // Complete only after the last day of the program (final week stays in_progress until then)
  const status = daysSinceStart >= total * 7 ? 'complete' : 'in_progress';
  return { current, total, status };
}

export interface ProgramWithSchedule {
  programId: string;
  title: string;
  schedule: ProgramSchedule[];
}

export async function fetchUserPrograms(
  uid: string
): Promise<(UserProgramAccess & { programId: string })[]> {
  const { data, error } = await supabase
    .from('user_programs')
    .select(
      'program_id, purchased_at, status, start_date, source, programs(duration_weeks, trainer_id, title)'
    )
    .eq('user_id', uid);

  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => {
    const programsRow = row.programs as
      | { duration_weeks?: number; trainer_id?: string; title?: string }
      | { duration_weeks?: number; trainer_id?: string; title?: string }[]
      | null;
    const programs = Array.isArray(programsRow) ? programsRow[0] : programsRow;
    const title = typeof programs?.title === 'string' ? programs.title : undefined;
    return {
      programId: row.program_id as string,
      purchasedAt: row.purchased_at ? new Date(row.purchased_at as string) : new Date(),
      status: row.status === 'completed' ? 'completed' : 'active',
      startDate: (row.start_date as string) ?? undefined,
      source: (row.source as UserProgramAccess['source']) ?? undefined,
      durationWeeks: programs?.duration_weeks ?? undefined,
      trainerId: programs?.trainer_id ?? undefined,
      title,
    };
  });
}

export async function setProgramStartDate(
  uid: string,
  programId: string,
  startDate: string | null
): Promise<void> {
  const { error } = await supabase
    .from('user_programs')
    .update({ start_date: startDate })
    .eq('user_id', uid)
    .eq('program_id', programId);

  if (error) throw error;
}

export async function getProgramTitle(programId: string): Promise<string> {
  const { data, error } = await supabase
    .from('programs')
    .select('title')
    .eq('id', programId)
    .single();

  if (error || !data) return 'Program';
  return typeof data.title === 'string' ? data.title : 'Program';
}

export async function getProgramWithSchedule(
  programId: string
): Promise<ProgramWithSchedule | null> {
  const { data: program, error: programError } = await supabase
    .from('programs')
    .select('title')
    .eq('id', programId)
    .single();

  if (programError || !program) return null;
  const title = typeof program.title === 'string' ? program.title : 'Program';

  const { data: weeks, error: weeksError } = await supabase
    .from('program_weeks')
    .select('week_number, content')
    .eq('program_id', programId)
    .order('week_number', { ascending: true });

  if (weeksError) return { programId, title, schedule: [] };

  interface WeekRow {
    week_number: number;
    content?: { weekNumber?: number; workouts?: ProgramSchedule['workouts'] } | null;
  }
  const schedule: ProgramSchedule[] = (weeks ?? []).map((row: WeekRow) => ({
    weekNumber: row.content?.weekNumber ?? row.week_number ?? 0,
    workouts: (row.content?.workouts ?? []) as ProgramSchedule['workouts'],
  }));

  return { programId, title, schedule };
}
