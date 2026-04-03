/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Derive notification items client-side from existing data (no backend table).
 */

import { supabase } from '@/lib/supabase/supabase-instance';
import { getCurrentWeek, getProgramTitle } from '@/lib/supabase/client/user-programs';
import { getTodaysWorkoutOrRest } from '@/lib/supabase/client/schedule-resolver';
import { getTodaysWorkoutLog, getStreakData } from '@/lib/supabase/client/progress-analytics';

export type NotificationType =
  | 'coach_assignment'
  | 'new_workout_available'
  | 'rest_day_reminder'
  | 'streak_at_risk'
  | 'program_complete';

export interface DerivedNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  /** Coach assignment (from /api/me/coach-assignments). */
  assignmentId?: string;
  coachAction?: 'set_program' | 'open_workout' | 'open_exercise';
  coachHref?: string;
  coachProgramId?: string;
}

const LAST_WEEK_KEY_PREFIX = 'ai-fit-last-week-';

function getLastSeenWeek(programId: string): number | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(`${LAST_WEEK_KEY_PREFIX}${programId}`);
  if (raw === null) return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

function setLastSeenWeek(programId: string, week: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${LAST_WEEK_KEY_PREFIX}${programId}`, String(week));
}

/**
 * Derive notifications: coach assignments first, then program_complete, new_workout_available,
 * rest_day_reminder, streak_at_risk. Requires userId; activeProgramId optional (streak_at_risk still applies).
 */
export async function deriveNotifications(
  userId: string,
  activeProgramId: string | null
): Promise<DerivedNotification[]> {
  const out: DerivedNotification[] = [];
  const coachOut: DerivedNotification[] = [];
  const id = () => `n-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  if (!userId) return [];

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/me/coach-assignments', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { assignments?: unknown[] };
        const list = Array.isArray(data.assignments) ? data.assignments : [];
        for (const raw of list.slice(0, 5)) {
          const a = raw as {
            id?: string;
            assignmentType?: string;
            titleSnapshot?: string;
            action?: string;
            programId?: string;
            href?: string;
          };
          if (typeof a.id !== 'string' || !a.id) continue;
          const title =
            a.action === 'set_program'
              ? 'Program from your coach'
              : a.action === 'open_exercise'
                ? 'Exercise from your coach'
                : 'Workout from your coach';
          const message =
            typeof a.titleSnapshot === 'string' && a.titleSnapshot.trim()
              ? a.titleSnapshot.trim()
              : 'Open to view';
          coachOut.push({
            id: `coach-${a.id}`,
            type: 'coach_assignment',
            title,
            message,
            assignmentId: a.id,
            coachAction:
              a.action === 'set_program'
                ? 'set_program'
                : a.action === 'open_exercise'
                  ? 'open_exercise'
                  : 'open_workout',
            coachProgramId: typeof a.programId === 'string' ? a.programId : undefined,
            coachHref: typeof a.href === 'string' ? a.href : undefined,
          });
        }
      }
    } catch {
      /* ignore coach assignment fetch errors */
    }
  }

  let startDate: string | null = null;
  let durationWeeks = 4;
  let programTitle: string | null = null;

  if (activeProgramId) {
    const [upResult, progResult] = await Promise.all([
      supabase
        .from('user_programs')
        .select('start_date')
        .eq('user_id', userId)
        .eq('program_id', activeProgramId)
        .maybeSingle(),
      supabase.from('programs').select('duration_weeks, title').eq('id', activeProgramId).single(),
    ]);

    if (!upResult.error && upResult.data) {
      startDate = (upResult.data as { start_date?: string }).start_date ?? null;
    }
    if (!progResult.error && progResult.data) {
      const row = progResult.data as { duration_weeks?: number; title?: string };
      durationWeeks = row.duration_weeks ?? 4;
      programTitle = typeof row.title === 'string' ? row.title : null;
    }
    if (!programTitle && activeProgramId) {
      programTitle = await getProgramTitle(activeProgramId);
    }
  }

  const { current: currentWeek, status } = getCurrentWeek(startDate, durationWeeks);

  // 1. program_complete
  if (activeProgramId && status === 'complete') {
    const title = programTitle ?? 'Program';
    out.push({
      id: id(),
      type: 'program_complete',
      title: 'Program complete',
      message: `You've finished ${title}. Great work!`,
    });
  }

  // 2. new_workout_available (currentWeek > lastSeenWeek; then update stored)
  if (activeProgramId && status === 'in_progress' && currentWeek >= 1) {
    const lastSeen = getLastSeenWeek(activeProgramId);
    if (currentWeek > (lastSeen ?? 0)) {
      out.push({
        id: id(),
        type: 'new_workout_available',
        title: 'New week',
        message: `Week ${currentWeek} is here. New workouts are available.`,
      });
      setLastSeenWeek(activeProgramId, currentWeek);
    }
  }

  // 3. rest_day_reminder
  if (activeProgramId && status === 'in_progress') {
    const todays = await getTodaysWorkoutOrRest(userId, activeProgramId);
    if (todays?.type === 'rest') {
      out.push({
        id: id(),
        type: 'rest_day_reminder',
        title: 'Rest day',
        message: 'Today is a rest day. Focus on recovery.',
      });
    }
  }

  // 4. streak_at_risk (Sunday, no log today, weekStreak > 0)
  const isSunday = new Date().getDay() === 0;
  if (isSunday) {
    const [log, streakData] = await Promise.all([
      getTodaysWorkoutLog(userId),
      getStreakData(userId),
    ]);
    if (log === null && streakData.weekStreak > 0) {
      out.push({
        id: id(),
        type: 'streak_at_risk',
        title: 'Streak at risk',
        message: `Log a workout today to keep your ${streakData.weekStreak}-week streak.`,
      });
    }
  }

  return [...coachOut, ...out].slice(0, 8);
}
