/**
 * Client-side workout logs (summary logs: effort, rating, notes).
 * Replaces firebaseService.saveWorkoutLog / fetchWorkoutLogs.
 */

import { supabase } from '../supabase-instance';
import { getAmrapSessionDisplayTitle } from '@/lib/amrap-preset-name';
import { getAmrapSessionResults } from './amrap-session-results';
import type { WorkoutLog } from '@/types';

export async function saveWorkoutLog(log: Omit<WorkoutLog, 'id'>): Promise<string> {
  const payload: Record<string, unknown> = {
    user_id: log.userId,
    workout_id: log.workoutId ?? null,
    workout_name: log.workoutName,
    date: log.date,
    effort: log.effort,
    rating: log.rating,
    notes: log.notes ?? '',
  };
  if (log.workoutType !== undefined) payload.workout_type = log.workoutType;
  if (log.workoutFormat !== undefined) payload.workout_format = log.workoutFormat;
  if (log.intensity !== undefined) payload.intensity = log.intensity;
  if (log.focusArea !== undefined) payload.focus_area = log.focusArea;
  if (log.isActiveRest !== undefined) payload.is_active_rest = log.isActiveRest;
  if (log.source !== undefined) payload.source = log.source;
  if (log.goalSnapshot !== undefined) {
    const snap = log.goalSnapshot;
    payload.goal_snapshot = snap != null && snap.length > 0 ? snap : null;
  }

  const { data, error } = await supabase.from('workout_logs').insert(payload).select('id').single();

  if (error) throw error;
  return data.id;
}

export async function updateWorkoutLog(
  id: string,
  updates: { effort?: number; rating?: number; notes?: string }
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (updates.effort !== undefined) payload.effort = updates.effort;
  if (updates.rating !== undefined) payload.rating = updates.rating;
  if (updates.notes !== undefined) payload.notes = updates.notes;
  if (Object.keys(payload).length === 0) return;
  const { error } = await supabase.from('workout_logs').update(payload).eq('id', id);
  if (error) throw error;
}

export async function fetchWorkoutLogs(uid: string): Promise<WorkoutLog[]> {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('*')
    .eq('user_id', uid)
    .order('date', { ascending: false });

  if (error) {
    if (import.meta.env.DEV) console.error('[fetchWorkoutLogs]', error);
    return [];
  }

  return (data ?? []).map((row) => mapRowToWorkoutLog(row)) as WorkoutLog[];
}

/** Display label for a program session row (HUD WorkoutPlayer → user_workout_logs). */
function formatProgramSessionWorkoutName(weekId: string, workoutId: string): string {
  const w = weekId.replace(/^week-/i, '').trim() || '?';
  const idx = parseInt(workoutId, 10);
  const slot = Number.isFinite(idx) && idx >= 0 ? ` · Workout ${idx + 1}` : '';
  return `Program · Week ${w}${slot}`;
}

function mapUserWorkoutLogRowToWorkoutLog(row: Record<string, unknown>): WorkoutLog {
  const weekId = String(row.week_id ?? '');
  const workoutId = String(row.workout_id ?? '');
  const displayName = row.workout_display_name as string | null | undefined;
  return {
    id: `uwl:${row.id as string}`,
    userId: row.user_id as string,
    workoutId: workoutId || undefined,
    workoutName: displayName?.trim()
      ? displayName
      : formatProgramSessionWorkoutName(weekId, workoutId),
    date: row.date as string,
    effort: 5,
    rating: 3,
    notes: '',
    durationSeconds: (row.duration_seconds as number | null) ?? undefined,
    source: 'program',
  };
}

/**
 * Program completions from user_workout_logs (same source as HUD History Zone).
 * Mapped to WorkoutLog so Training Log can show them alongside timer/handoff rows.
 */
export async function fetchUserWorkoutLogsForTraining(uid: string): Promise<WorkoutLog[]> {
  const { data, error } = await supabase
    .from('user_workout_logs')
    // Omit exercises (large JSONB) and workout_display_name (column may not exist until migration 20250330000000)
    .select('id, user_id, program_id, week_id, workout_id, date, duration_seconds')
    .eq('user_id', uid)
    .order('date', { ascending: false });

  if (error) {
    if (import.meta.env.DEV) console.error('[fetchUserWorkoutLogsForTraining]', error);
    return [];
  }

  return (data ?? []).map((row) =>
    mapUserWorkoutLogRowToWorkoutLog(row as Record<string, unknown>)
  );
}

/**
 * All sessions shown in Training Log: summary/timer rows (workout_logs) + program sessions (user_workout_logs).
 * Defensive: also fetches AMRAP results and merges any missing (e.g. if workout_logs sync failed or backfill missed).
 */
export async function fetchWorkoutLogsForTraining(uid: string): Promise<WorkoutLog[]> {
  const [fromLogs, fromPrograms, amrapResults] = await Promise.all([
    fetchWorkoutLogs(uid),
    fetchUserWorkoutLogsForTraining(uid),
    getAmrapSessionResults(uid, 100).catch((err) => {
      if (import.meta.env.DEV) console.error('[fetchWorkoutLogsForTraining] AMRAP fallback', err);
      return [];
    }),
  ]);

  const existingDedupeKeys = new Set(
    fromLogs.map((l) => l.handoffDedupeKey).filter(Boolean) as string[]
  );

  const amrapResultsByDedupeKey = new Map(
    amrapResults.map((r) => [`amrap_with_friends:${uid}:${r.session_id}:${r.segment_index}`, r])
  );
  const amrapResultsByDateDuration = new Map<string, typeof amrapResults>();
  for (const r of amrapResults) {
    const key = `${r.completed_at.slice(0, 10)}:${Math.max(0, r.duration_minutes ?? 0)}`;
    const arr = amrapResultsByDateDuration.get(key) ?? [];
    arr.push(r);
    amrapResultsByDateDuration.set(key, arr);
  }

  // workout_logs can persist AMRAP workout_name as first exercise; normalize from canonical
  // AMRAP results when we can match via handoff_dedupe_key.
  // Fallback (legacy rows): if key is missing, match a unique AMRAP row by date+duration.
  const normalizedFromLogs = fromLogs.map((log) => {
    const key = log.handoffDedupeKey;
    let match = key ? amrapResultsByDedupeKey.get(key) : undefined;
    if (!match && log.source === 'amrap_with_friends') {
      const date = log.date;
      const durationMinutes = Math.max(0, Math.round((log.durationSeconds ?? 0) / 60));
      const fallbackMatches = amrapResultsByDateDuration.get(`${date}:${durationMinutes}`) ?? [];
      if (fallbackMatches.length === 1) {
        match = fallbackMatches[0];
      }
    }
    if (!match) return log;
    return {
      ...log,
      workoutName: getAmrapSessionDisplayTitle(match.workout_name, match.workout_list),
    };
  });

  const amrapLogs: WorkoutLog[] = amrapResults
    .filter((r) => {
      const key = `amrap_with_friends:${uid}:${r.session_id}:${r.segment_index}`;
      return !existingDedupeKeys.has(key);
    })
    .map((r) => {
      const dateStr = r.completed_at.slice(0, 10);
      const durationSeconds = (r.duration_minutes ?? 0) * 60;
      return {
        id: `amrap:${r.session_id}:${r.segment_index}`,
        userId: uid,
        workoutName: getAmrapSessionDisplayTitle(r.workout_name, r.workout_list),
        date: dateStr,
        effort: 5,
        rating: 3,
        notes: '',
        durationSeconds,
        rounds: r.total_rounds ?? undefined,
        source: 'amrap_with_friends',
      } as WorkoutLog;
    });

  const merged = [...normalizedFromLogs, ...amrapLogs, ...fromPrograms];
  merged.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });
  return merged;
}

function mapRowToWorkoutLog(row: Record<string, unknown>): WorkoutLog {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    handoffDedupeKey: (row.handoff_dedupe_key as string) ?? undefined,
    workoutId: (row.workout_id as string | null) ?? undefined,
    workoutName: row.workout_name as string,
    date: row.date as string,
    effort: row.effort as number,
    rating: row.rating as number,
    notes: (row.notes as string) ?? '',
    durationSeconds: (row.duration_seconds as number | null) ?? undefined,
    calories: (row.calories as number | null) ?? undefined,
    rounds: (row.rounds as number | null) ?? undefined,
    source: (row.source as string | null) ?? undefined,
    workoutType: (row.workout_type as string | null) ?? undefined,
    workoutFormat: (row.workout_format as string | null) ?? undefined,
    intensity: (row.intensity as string | null) ?? undefined,
    focusArea: (row.focus_area as string | null) ?? undefined,
    isActiveRest: (row.is_active_rest as boolean | null) ?? undefined,
    goalSnapshot: (() => {
      const g = row.goal_snapshot as string[] | null | undefined;
      if (g == null || !Array.isArray(g) || g.length === 0) return null;
      return g;
    })(),
  };
}

/**
 * Fetch workout_logs rows from handoff (Tabata, AMRAP, Daily Warm-Up) for activity feed.
 */
export async function fetchHandoffLogs(uid: string, limit = 15): Promise<WorkoutLog[]> {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('*')
    .eq('user_id', uid)
    .not('source', 'is', null)
    .order('date', { ascending: false })
    .limit(limit);

  if (error) {
    if (import.meta.env.DEV) console.error('[fetchHandoffLogs]', error);
    return [];
  }

  return (data ?? []).map((row) => mapRowToWorkoutLog(row)) as WorkoutLog[];
}
