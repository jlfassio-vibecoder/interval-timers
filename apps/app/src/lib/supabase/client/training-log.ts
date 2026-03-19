/**
 * Training Log API client. Merges workout_logs (timers, handoff, readiness, etc.)
 * with user_workout_logs (program / WorkoutPlayer completions — same as HUD History).
 * Week grid includes contiguous past/future weeks and scheduled calendar minutes (outline only).
 */

import { HEALTH_GUIDELINE_WEEKLY_MINUTES } from '@/lib/training-log-constants';
import { fetchWorkoutLogsForTraining } from './workout-logs';
import { fetchUserPrograms, getProgramWithSchedule } from './user-programs';
import { getLoggedDatesForCalendar } from './calendar-completion';
import { getUnifiedCalendarEvents } from '@/lib/calendar-unified';
import type { CalendarEvent, ProgramForCalendar } from '@/lib/calendar-events';
import { getDurationRange } from '@/lib/training-log-filters';
import type { WorkoutLog } from '@/types';
import type { TrainingLogFilters } from '@/lib/training-log-filters';

/** Single day in a week: aggregate minutes and session count. */
export interface TrainingLogDay {
  count: number;
  minutes: number;
  isEmpty: boolean;
  logs: WorkoutLog[];
  /** Calendar date YYYY-MM-DD for this cell (Mon=0 … Sun=6). */
  dateISO: string;
  /** Sum of planned minutes from unified calendar (scheduled only). Filters do not apply. */
  plannedMinutes: number;
}

/** One week of aggregated data. days[0]=Mon, days[6]=Sun. */
export interface TrainingLogWeek {
  /** Monday of this week (YYYY-MM-DD). */
  weekMonday: string;
  range: string;
  totalMinutes: number;
  /** Sum of planned minutes for days in this week (Mon–Sun). */
  plannedWeekMinutes: number;
  days: TrainingLogDay[];
  /** date string -> logs for that day (for modal lookup) */
  logsByDate: Record<string, WorkoutLog[]>;
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Infer workout_format from source when null. Exported for CSV export. */
export function deriveWorkoutFormat(log: WorkoutLog): string | undefined {
  if (log.workoutFormat) return log.workoutFormat;
  const s = (log.source ?? '').toLowerCase();
  if (s.includes('tabata')) return 'Tabata';
  if (s.includes('amrap')) return 'AMRAP';
  if (s.includes('emom')) return 'EMOM';
  if (s.includes('warmup') || s.includes('warm-up')) return 'Mobility';
  if (s.includes('hiit')) return 'HIIT';
  if (s.includes('circuit')) return 'Circuit';
  if (s.includes('lactate')) return 'Steady State';
  return undefined;
}

/** Infer workout_type from source when null. Exported for insights. */
export function deriveWorkoutType(log: WorkoutLog): string {
  if (log.workoutType) return log.workoutType;
  const s = (log.source ?? '').toLowerCase();
  if (s.includes('program')) return 'Conditioning';
  if (s.includes('tabata') || s.includes('hiit')) return 'Cardiovascular Fitness';
  if (s.includes('amrap') || s.includes('emom') || s.includes('circuit')) return 'Conditioning';
  if (s.includes('warmup') || s.includes('warm-up')) return 'Mobility';
  if (s.includes('lactate')) return 'Endurance';
  return 'Other';
}

/** Apply filters to a single log. Returns true if log passes. */
function passesFilters(log: WorkoutLog, filters: TrainingLogFilters | undefined): boolean {
  if (!filters) return true;

  if (filters.excludeActiveRest && log.isActiveRest) return false;

  const format = log.workoutFormat ?? deriveWorkoutFormat(log);
  if (filters.workoutFormat && filters.workoutFormat !== 'All') {
    if (format !== filters.workoutFormat) return false;
  }

  if (filters.workoutType && filters.workoutType !== 'All') {
    if (deriveWorkoutType(log) !== filters.workoutType) return false;
  }

  if (filters.durationRange && filters.durationRange !== 'All') {
    const minutes = Math.round((log.durationSeconds ?? 0) / 60);
    const { min, max } = getDurationRange(filters.durationRange);
    if (minutes < min || minutes > max) return false;
  }

  return true;
}

/** Get Monday of the week containing the given date. */
function getWeekMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset);
  return d.toISOString().slice(0, 10);
}

/** Get day index 0=Mon, 6=Sun for a date. */
function getDayIndex(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  return (day + 6) % 7;
}

/** Format week range for display (e.g. "Dec 16 – 22"). */
function formatWeekRange(mondayStr: string): string {
  const mon = new Date(mondayStr + 'T12:00:00');
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(mon)} – ${fmt(sun)}`;
}

function localTodayISO(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function addCalendarDays(iso: string, delta: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Monday keys from firstMonday through lastMonday inclusive (ISO string order). */
function enumerateWeekMondays(firstMonday: string, lastMonday: string): string[] {
  const out: string[] = [];
  for (let m = firstMonday; m <= lastMonday; m = addCalendarDays(m, 7)) {
    out.push(m);
  }
  return out;
}

function eventPlannedMinutes(ev: CalendarEvent): number {
  if (ev.status !== 'scheduled') return 0;
  const dm = ev.metadata?.durationMinutes;
  if (typeof dm === 'number' && dm > 0) return dm;
  const ds = ev.metadata?.durationSeconds;
  if (typeof ds === 'number' && ds > 0) return Math.round(ds / 60);
  if (ev.type === 'amrap_scheduled') return 45;
  if (ev.type === 'timer_scheduled') return 20;
  if (ev.type === 'program') return 45;
  return 30;
}

async function loadProgramsForCalendar(uid: string): Promise<ProgramForCalendar[]> {
  const accessList = await fetchUserPrograms(uid);
  const withStart = accessList.filter((a) => a.startDate);
  const results = await Promise.all(
    withStart.map(async (a) => {
      const prog = await getProgramWithSchedule(a.programId);
      if (prog && a.startDate) {
        return {
          programId: prog.programId,
          title: prog.title,
          startDate: a.startDate,
          schedule: prog.schedule,
        } as ProgramForCalendar;
      }
      return null;
    })
  );
  return results.filter((p): p is ProgramForCalendar => p !== null);
}

/** Export for UI: Monday of the week containing local today. */
export function getCurrentWeekMondayISO(): string {
  return getWeekMonday(localTodayISO());
}

/**
 * Fetch and aggregate workout logs into a contiguous weekly timeline with optional planned minutes.
 * Returns weeks chronological (oldest first). Completed logs respect filters; planned does not.
 * days[0]=Monday, days[6]=Sunday.
 */
export async function getTrainingLogWeeks(
  uid: string,
  weeksBack = 52,
  filters?: TrainingLogFilters,
  weeksForward = 12
): Promise<{ weeks: TrainingLogWeek[]; logsByDate: Record<string, WorkoutLog[]> }> {
  const todayStr = localTodayISO();
  const tailAnchor = addCalendarDays(todayStr, weeksForward * 7);
  const headAnchor = addCalendarDays(todayStr, -weeksBack * 7);
  const firstMonday = getWeekMonday(headAnchor);
  const lastMonday = getWeekMonday(tailAnchor);
  const rangeStart = firstMonday;
  const rangeEnd = addCalendarDays(lastMonday, 6);

  const [logs, programs] = await Promise.all([
    fetchWorkoutLogsForTraining(uid),
    loadProgramsForCalendar(uid).catch((err) => {
      if (import.meta.env.DEV) console.error('[getTrainingLogWeeks] programs', err);
      return [] as ProgramForCalendar[];
    }),
  ]);

  const loggedMap = await getLoggedDatesForCalendar(uid, rangeStart, rangeEnd).catch((err) => {
    if (import.meta.env.DEV) console.error('[getTrainingLogWeeks] loggedMap', err);
    return new Map<string, Set<string>>();
  });

  let calendarEvents: CalendarEvent[] = [];
  try {
    calendarEvents = await getUnifiedCalendarEvents(uid, rangeStart, rangeEnd, {
      programs,
      loggedMap,
    });
  } catch (err) {
    if (import.meta.env.DEV) console.error('[getTrainingLogWeeks] calendar', err);
  }

  const plannedByDate = new Map<string, number>();
  for (const ev of calendarEvents) {
    if (ev.status !== 'scheduled') continue;
    const add = eventPlannedMinutes(ev);
    if (add <= 0) continue;
    plannedByDate.set(ev.date, (plannedByDate.get(ev.date) ?? 0) + add);
  }

  const filtered = logs.filter((log) => {
    if (log.date < rangeStart || log.date > rangeEnd) return false;
    return passesFilters(log, filters);
  });

  /** weekMonday -> dayIndex -> data */
  const weekMap = new Map<string, Map<number, { logs: WorkoutLog[]; minutes: number }>>();

  const logsByDate: Record<string, WorkoutLog[]> = {};

  for (const log of filtered) {
    const weekMon = getWeekMonday(log.date);
    const dayIdx = getDayIndex(log.date);
    const minutes = Math.round((log.durationSeconds ?? 0) / 60);

    if (!weekMap.has(weekMon)) {
      weekMap.set(
        weekMon,
        new Map([
          [0, { logs: [], minutes: 0 }],
          [1, { logs: [], minutes: 0 }],
          [2, { logs: [], minutes: 0 }],
          [3, { logs: [], minutes: 0 }],
          [4, { logs: [], minutes: 0 }],
          [5, { logs: [], minutes: 0 }],
          [6, { logs: [], minutes: 0 }],
        ])
      );
    }

    const dayMap = weekMap.get(weekMon)!;
    const dayData = dayMap.get(dayIdx)!;
    dayData.logs.push(log);
    dayData.minutes += minutes;

    if (!logsByDate[log.date]) logsByDate[log.date] = [];
    logsByDate[log.date].push(log);
  }

  const weekKeys = enumerateWeekMondays(firstMonday, lastMonday);
  const weeks: TrainingLogWeek[] = weekKeys.map((weekMon) => {
    if (!weekMap.has(weekMon)) {
      weekMap.set(
        weekMon,
        new Map([
          [0, { logs: [], minutes: 0 }],
          [1, { logs: [], minutes: 0 }],
          [2, { logs: [], minutes: 0 }],
          [3, { logs: [], minutes: 0 }],
          [4, { logs: [], minutes: 0 }],
          [5, { logs: [], minutes: 0 }],
          [6, { logs: [], minutes: 0 }],
        ])
      );
    }

    const dayMap = weekMap.get(weekMon)!;
    let totalMinutes = 0;
    let plannedWeekMinutes = 0;
    const days: TrainingLogDay[] = [];
    const logsByDateWeek: Record<string, WorkoutLog[]> = {};

    for (let i = 0; i < 7; i++) {
      const dateISO = addCalendarDays(weekMon, i);
      const d = dayMap.get(i)!;
      totalMinutes += d.minutes;
      const plannedMinutes = plannedByDate.get(dateISO) ?? 0;
      plannedWeekMinutes += plannedMinutes;
      days.push({
        count: d.logs.length,
        minutes: d.minutes,
        isEmpty: d.logs.length === 0 && plannedMinutes === 0,
        logs: d.logs,
        dateISO,
        plannedMinutes,
      });
      for (const log of d.logs) {
        if (!logsByDateWeek[log.date]) logsByDateWeek[log.date] = [];
        logsByDateWeek[log.date].push(log);
      }
    }

    return {
      weekMonday: weekMon,
      range: formatWeekRange(weekMon),
      totalMinutes,
      plannedWeekMinutes,
      days,
      logsByDate: logsByDateWeek,
    };
  });

  return { weeks, logsByDate };
}

/** Analytics aggregation result. */
export interface TrainingLogAnalytics {
  weeklyVolume: { weekKey: string; totalMinutes: number }[];
  byType: { type: string; minutes: number }[];
  byFormat: { format: string; minutes: number }[];
  byDayOfWeek: { day: number; dayName: string; minutes: number }[];
  thisWeek: { totalMinutes: number; sessionCount: number };
  thisMonth: { totalMinutes: number; sessionCount: number };
  streak: number;
  mostActiveDay: string;
}

const DEFAULT_GOAL_MINUTES = HEALTH_GUIDELINE_WEEKLY_MINUTES;

/**
 * Fetch and aggregate analytics for the Training Log dashboard.
 * @param goalMinutes - Weekly target minutes for streak calculation. Default 150.
 */
export async function getTrainingLogAnalytics(
  uid: string,
  weeksBack = 24,
  filters?: TrainingLogFilters,
  goalMinutes = DEFAULT_GOAL_MINUTES
): Promise<TrainingLogAnalytics> {
  const logs = await fetchWorkoutLogsForTraining(uid);
  const filtered = logs.filter((log) => passesFilters(log, filters));

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeksBack * 7);
  const y = cutoff.getFullYear();
  const m = String(cutoff.getMonth() + 1).padStart(2, '0');
  const d = String(cutoff.getDate()).padStart(2, '0');
  const cutoffStr = `${y}-${m}-${d}`;
  const inRange = filtered.filter((log) => log.date >= cutoffStr);

  const thisWeekMon = getWeekMonday(localTodayISO());
  const today = localTodayISO();
  const [thisYear, thisMonth] = today.split('-');
  const thisMonthStart = `${thisYear}-${thisMonth}-01`;

  const weekMinutes = new Map<string, number>();
  const typeMinutes = new Map<string, number>();
  const formatMinutes = new Map<string, number>();
  const dayMinutes = new Map<number, number>();
  let thisWeekMinutes = 0;
  let thisWeekSessions = 0;
  let thisMonthMinutes = 0;
  let thisMonthSessions = 0;

  for (const log of inRange) {
    const minutes = Math.round((log.durationSeconds ?? 0) / 60);
    const weekMon = getWeekMonday(log.date);
    const dayIdx = getDayIndex(log.date);
    const type = deriveWorkoutType(log);
    const format = deriveWorkoutFormat(log) ?? 'Other';

    weekMinutes.set(weekMon, (weekMinutes.get(weekMon) ?? 0) + minutes);
    typeMinutes.set(type, (typeMinutes.get(type) ?? 0) + minutes);
    formatMinutes.set(format, (formatMinutes.get(format) ?? 0) + minutes);
    dayMinutes.set(dayIdx, (dayMinutes.get(dayIdx) ?? 0) + minutes);

    if (weekMon === thisWeekMon) {
      thisWeekMinutes += minutes;
      thisWeekSessions += 1;
    }
    if (log.date >= thisMonthStart) {
      thisMonthMinutes += minutes;
      thisMonthSessions += 1;
    }
  }

  const weekKeys = Array.from(weekMinutes.keys()).sort();
  const weeklyVolume = weekKeys.map((weekKey) => ({
    weekKey,
    totalMinutes: weekMinutes.get(weekKey) ?? 0,
  }));

  const byType = Array.from(typeMinutes.entries())
    .map(([type, minutes]) => ({ type, minutes }))
    .sort((a, b) => b.minutes - a.minutes);

  const byFormat = Array.from(formatMinutes.entries())
    .map(([format, minutes]) => ({ format, minutes }))
    .sort((a, b) => b.minutes - a.minutes);

  const byDayOfWeek = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    dayName: DAY_NAMES[day],
    minutes: dayMinutes.get(day) ?? 0,
  }));

  // Enumerate calendar weeks backwards from current week; missing weeks = 0 minutes.
  let streak = 0;
  let checkMon = thisWeekMon;
  for (let i = 0; i < 52; i++) {
    const total = weekMinutes.get(checkMon) ?? 0;
    if (total >= goalMinutes) {
      streak++;
      checkMon = addCalendarDays(checkMon, -7);
    } else {
      break;
    }
  }

  let mostActiveDay = 'Monday';
  let maxMinutes = 0;
  for (const d of byDayOfWeek) {
    if (d.minutes > maxMinutes) {
      maxMinutes = d.minutes;
      mostActiveDay = d.dayName;
    }
  }

  return {
    weeklyVolume,
    byType,
    byFormat,
    byDayOfWeek,
    thisWeek: { totalMinutes: thisWeekMinutes, sessionCount: thisWeekSessions },
    thisMonth: { totalMinutes: thisMonthMinutes, sessionCount: thisMonthSessions },
    streak,
    mostActiveDay,
  };
}

/**
 * Fetch workout logs for CSV export. Applies same filters as Training Log.
 */
export async function getTrainingLogLogsForExport(
  uid: string,
  filters?: TrainingLogFilters
): Promise<WorkoutLog[]> {
  const logs = await fetchWorkoutLogsForTraining(uid);
  return logs.filter((log) => passesFilters(log, filters));
}

/**
 * Fetch workout logs for Training Log display. Returns enriched WorkoutLog[] ordered by date DESC.
 * Use weeksBack to limit scope (default: 12 weeks of data).
 * @deprecated Use getTrainingLogWeeks for aggregated data with filters.
 */
export async function fetchTrainingLogWeeks(uid: string, weeksBack = 12): Promise<WorkoutLog[]> {
  const logs = await fetchWorkoutLogsForTraining(uid);
  if (logs.length === 0) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeksBack * 7);
  const y = cutoff.getFullYear();
  const m = String(cutoff.getMonth() + 1).padStart(2, '0');
  const d = String(cutoff.getDate()).padStart(2, '0');
  const cutoffStr = `${y}-${m}-${d}`;

  return logs.filter((log) => log.date >= cutoffStr);
}
