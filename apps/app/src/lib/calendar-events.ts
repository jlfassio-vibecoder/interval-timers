/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Compute calendar events from program schedule + start date (MVP: consecutive days).
 */

import type { ProgramSchedule } from '@/types/ai-program';

export type CalendarEventStatus = 'scheduled' | 'completed' | 'missed';

export type CalendarEventType =
  | 'program'
  | 'amrap'
  | 'timer'
  | 'readiness'
  | 'amrap_scheduled'
  | 'timer_scheduled'
  | 'live_scheduled'
  /** 1:1 coach schedule instance with optional linked `trainer_live_sessions` row. */
  | 'coach_live';

export interface CalendarEvent {
  type: CalendarEventType;
  date: string;
  workoutTitle: string;
  status: CalendarEventStatus;
  /** Program events only. */
  programId?: string;
  programTitle?: string;
  weekNumber?: number;
  workoutIndex?: number;
  workoutId?: string;
  weekId?: string;
  /** AMRAP session id (amrap, amrap_scheduled). */
  sessionId?: string;
  /** Timer app source (timer): tabata, daily-warmup, etc. */
  sourceApp?: string;
  metadata?: {
    rounds?: number;
    durationSeconds?: number;
    durationMinutes?: number;
    effort?: number;
    rating?: number;
    /** Timer: workout_logs row id for edit. */
    logId?: string;
    /** Timer: notes from workout_logs. */
    notes?: string;
    /** timer_scheduled: full scheduled_at ISO string for display. */
    scheduledAt?: string;
    /** live_scheduled: invite + occurrence ids and wall times. */
    liveInviteId?: string;
    occurrenceId?: string;
    /** Set when trainer linked a native room (`trainer_live_session_occurrences.live_session_id`). */
    liveSessionId?: string;
    inviteStatus?: string;
    /** 1-based queue position among waitlisted invites for this occurrence (FIFO). */
    waitlistPosition?: number;
    trainerUserId?: string;
    scheduledEndAt?: string;
    /** AMRAP: full exercise list for display in drawer. */
    workoutList?: string[];
    /** When the event is backed by a coach assignment (e.g. merged weekly board). */
    coachAssignmentId?: string;
    coachResourceId?: string;
    coachAssignmentType?: 'workout' | 'wod';
    /** coach_live: `client_coach_schedule_instances.id`. */
    coachScheduleInstanceId?: string;
    /** coach_live: linked native room when trainer started session. */
    trainerLiveSessionId?: string;
  };
}

export interface ProgramForCalendar {
  programId: string;
  title: string;
  startDate: string;
  schedule: ProgramSchedule[];
}

/**
 * Parse ISO YYYY-MM-DD and add days.
 */
function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Composite key for completion lookup: programId:weekId:workoutId. Only valid for program events. */
export function eventCompletionKey(ev: CalendarEvent): string {
  if (ev.type !== 'program' || ev.programId == null || ev.weekId == null || ev.workoutId == null)
    return '';
  return `${ev.programId}:${ev.weekId}:${ev.workoutId}`;
}

const todayISO = (): string => new Date().toISOString().slice(0, 10);

/**
 * Generate all calendar events for the given programs (with startDate and schedule) that fall within [rangeStart, rangeEnd].
 * MVP mapping: Week 1 Day 1 = startDate, Week 1 Day 2 = startDate + 1, ... (consecutive calendar days).
 * When loggedDates is provided, sets status: completed if key in set, missed if date < today, else scheduled.
 */
export function getCalendarEventsForRange(
  rangeStart: string,
  rangeEnd: string,
  programs: ProgramForCalendar[],
  loggedDates?: Map<string, Set<string>>
): CalendarEvent[] {
  const today = todayISO();
  const events: CalendarEvent[] = [];
  for (const program of programs) {
    const { programId, title, startDate, schedule } = program;
    let globalDayOffset = 0;
    for (const week of [...schedule].sort((a, b) => a.weekNumber - b.weekNumber)) {
      for (let i = 0; i < week.workouts.length; i++) {
        const date = addDays(startDate, globalDayOffset);
        globalDayOffset += 1;
        if (date >= rangeStart && date <= rangeEnd) {
          const weekId = `week-${week.weekNumber}`;
          const workoutId = String(i);
          const key = `${programId}:${weekId}:${workoutId}`;
          let status: CalendarEventStatus = 'scheduled';
          if (loggedDates) {
            if (loggedDates.get(date)?.has(key)) status = 'completed';
            else if (date < today) status = 'missed';
          }
          events.push({
            type: 'program',
            date,
            programId,
            programTitle: title,
            weekNumber: week.weekNumber,
            workoutTitle: week.workouts[i]?.title ?? `Workout ${i + 1}`,
            workoutIndex: i,
            workoutId,
            weekId,
            status,
          });
        }
      }
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get start and end of month as ISO YYYY-MM-DD.
 */
export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}
