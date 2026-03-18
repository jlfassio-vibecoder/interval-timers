/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Schedule Zone: calendar with log markers + click-to-open drawer + 7-day upcoming strip.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useAppContext } from '@/contexts/AppContext';
import { fetchUserPrograms, getProgramWithSchedule } from '@/lib/supabase/client/user-programs';
import { getLoggedDatesForCalendar } from '@/lib/supabase/client/calendar-completion';
import { getMonthRange, type CalendarEvent, type ProgramForCalendar } from '@/lib/calendar-events';
import { getUnifiedCalendarEvents } from '@/lib/calendar-unified';
import { buildIcsFromEvents } from '@/lib/ics-export';
import { updateScheduledWorkout } from '@/lib/supabase/client/scheduled-workouts';
import { rescheduleAmrapSession } from '@/lib/supabase/client/amrap-reschedule';
import AppCalendar from './AppCalendar';
import UpcomingStrip from './UpcomingStrip';
import type { UpcomingStripDay } from './UpcomingStrip';
import WorkoutEventDrawer from './WorkoutEventDrawer';
import SimpleActivityDrawer from './SimpleActivityDrawer';
import TimerActivityDrawer from './TimerActivityDrawer';
import ScheduledTimerDrawer from './ScheduledTimerDrawer';
import MultiActivityDayDrawer from './MultiActivityDayDrawer';
import AmrapResultDetailDrawer from './AmrapResultDetailDrawer';
import AmrapScheduleModal from './AmrapScheduleModal';
import ScheduleWorkoutModal from './ScheduleWorkoutModal';
import WorkoutPlayer from '@/components/react/tracking/WorkoutPlayer';
import {
  getAmrapSessionResults,
  type AmrapSessionResult,
} from '@/lib/supabase/client/amrap-session-results';
import { createAmrapSession } from '@/lib/supabase/client/amrap-create-session';
import { getAmrapSessionUrl } from '@/lib/amrap-urls';
import { getPersonalRecords } from '@/lib/supabase/client/progress-analytics';
import {
  addRestDay,
  removeRestDay,
  getRestDaysForRange,
} from '@/lib/supabase/client/user-rest-days';
import {
  getScheduledWorkoutsForRange,
  saveScheduledWorkout,
  deleteScheduledWorkout,
} from '@/lib/supabase/client/scheduled-workouts';
import { getAmrapScheduledSessionsForUser } from '@/lib/supabase/client/amrap-scheduled-sessions';
import { cancelAmrapSessionForCreator } from '@/lib/supabase/client/amrap-cancel-session';
import {
  getEventOrderPreference,
  setEventOrderPreference,
} from '@/lib/supabase/client/event-order-preference';
import { sortEventsByTypeOrder, DEFAULT_EVENT_TYPE_ORDER } from '@/lib/calendar-event-order';
import type { CalendarEventType } from '@/lib/calendar-events';
import { CalendarEventDragPreview } from './AppCalendar';
import EmptyDayActionDrawer from './EmptyDayActionDrawer';
import CalendarMultiSelectBar from './CalendarMultiSelectBar';
import CalendarCopyWeekModal from './CalendarCopyWeekModal';
import CalendarClearConfirmModal from './CalendarClearConfirmModal';
import CalendarWeekView from './CalendarWeekView';
import CalendarListView from './CalendarListView';
import EventOrderSettings from './EventOrderSettings';
import type { ProgramSchedule } from '@/types/ai-program';
import type { WorkoutLog } from '@/types';

const HUD_SCHEDULE_VIEW_KEY = 'hud_schedule_view';
export type ScheduleViewMode = 'month' | 'week' | 'list';

type WorkoutFromSchedule = ProgramSchedule['workouts'][number];

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function getStartOfWeek(): Date {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  return start;
}

function isDateInThisWeek(isoDate: string): boolean {
  const d = isoDate ? new Date(isoDate) : null;
  if (!d) return false;
  return d >= getStartOfWeek();
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

export interface ScheduleZoneProps {
  /** When changed, refetches programs and events. */
  refreshKey?: number;
  /** Called when user taps View Log on a completed calendar event (scroll to History Zone). */
  onViewLog?: () => void;
  /** Called when calendar should refetch (e.g. AMRAP scheduled). */
  onCalendarRefresh?: () => void;
  /** Workout count for current week (for weekly summary bar). */
  workoutsThisWeek?: number;
  /** Workout logs for duration aggregation (for weekly summary bar). */
  workoutLogs?: WorkoutLog[];
}

const ScheduleZone: React.FC<ScheduleZoneProps> = ({
  refreshKey = 0,
  onViewLog,
  onCalendarRefresh,
  workoutsThisWeek = 0,
  workoutLogs = [],
}) => {
  const { user, activeProgramId } = useAppContext();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [_programs, setPrograms] = useState<ProgramForCalendar[]>([]);
  const [monthEvents, setMonthEvents] = useState<CalendarEvent[]>([]);
  const [stripDays, setStripDays] = useState<UpcomingStripDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDayEvents, setSelectedDayEvents] = useState<CalendarEvent[] | null>(null);
  const [workoutPlayer, setWorkoutPlayer] = useState<{
    workout: WorkoutFromSchedule;
    programId: string;
    weekId: string;
    workoutId: string;
  } | null>(null);
  const [restDayMessage, setRestDayMessage] = useState<string | null>(null);
  const [amrapResultForCalendar, setAmrapResultForCalendar] = useState<AmrapSessionResult | null>(
    null
  );
  const [selectedAmrapResult, setSelectedAmrapResult] = useState<AmrapSessionResult | null>(null);
  const [schedulingFor, setSchedulingFor] = useState<AmrapSessionResult | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState<{ date: string } | null>(null);
  const [exportingIcs, setExportingIcs] = useState(false);
  const [prCountThisWeek, setPrCountThisWeek] = useState(0);
  const [restDays, setRestDays] = useState<Set<string>>(new Set());
  const [emptyDayDrawer, setEmptyDayDrawer] = useState<{ date: string } | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [copyWeekModalOpen, setCopyWeekModalOpen] = useState<{
    sourceWeekStart: string;
    targetWeekStart: string;
  } | null>(null);
  const [clearConfirmModalOpen, setClearConfirmModalOpen] = useState(false);
  const [eventOrderModalOpen, setEventOrderModalOpen] = useState(false);

  const today = todayISO();

  const [viewMode, setViewModeState] = useState<ScheduleViewMode>(() => {
    if (typeof window === 'undefined') return 'month';
    try {
      const s = window.localStorage.getItem(HUD_SCHEDULE_VIEW_KEY);
      if (s === 'month' || s === 'week' || s === 'list') return s;
    } catch {
      // ignore
    }
    return 'month';
  });
  const setViewMode = useCallback((mode: ScheduleViewMode) => {
    setViewModeState(mode);
    try {
      window.localStorage.setItem(HUD_SCHEDULE_VIEW_KEY, mode);
    } catch {
      // ignore
    }
  }, []);

  const [weekStart, setWeekStart] = useState<string>(() => {
    const d = new Date(today + 'T12:00:00Z');
    const day = d.getUTCDay();
    const start = new Date(d);
    start.setUTCDate(d.getUTCDate() - day);
    return start.toISOString().slice(0, 10);
  });
  const [weekEvents, setWeekEvents] = useState<CalendarEvent[]>([]);
  const [listEvents, setListEvents] = useState<CalendarEvent[]>([]);
  const [eventTypeOrder, setEventTypeOrder] = useState<CalendarEventType[]>(
    () => DEFAULT_EVENT_TYPE_ORDER
  );

  /** Sunday–Saturday week bounds for an anchor date (ISO). */
  const getWeekBounds = useCallback((anchorIso: string) => {
    const d = new Date(anchorIso + 'T12:00:00Z');
    const day = d.getUTCDay();
    const start = new Date(d);
    start.setUTCDate(d.getUTCDate() - day);
    const startIso = start.toISOString().slice(0, 10);
    const endIso = addDays(startIso, 6);
    return { start: startIso, end: endIso };
  }, []);

  const shiftDate = useCallback((iso: string, days: number) => addDays(iso, days), []);

  const durationThisWeekSeconds = React.useMemo(() => {
    const startOfWeek = getStartOfWeek();
    return workoutLogs.reduce((sum, log) => {
      const d = log.date ? new Date(log.date) : null;
      if (!d || d < startOfWeek) return sum;
      return sum + (log.durationSeconds ?? 0);
    }, 0);
  }, [workoutLogs]);

  useEffect(() => {
    if (!user?.uid) {
      setPrCountThisWeek(0);
      return;
    }
    let cancelled = false;
    getPersonalRecords(user.uid, 50).then((prs) => {
      if (cancelled) return;
      const count = prs.filter((pr) => isDateInThisWeek(pr.date)).length;
      setPrCountThisWeek(count);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const loadPrograms = useCallback(async () => {
    if (!user?.uid) return [];
    const accessList = await fetchUserPrograms(user.uid);
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
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setPrograms([]);
      setMonthEvents([]);
      setStripDays([]);
      setWeekEvents([]);
      setListEvents([]);
      setRestDays(new Set());
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const progList = await loadPrograms();
        if (cancelled) return;
        setPrograms(progList);

        if (viewMode === 'month') {
          const { start: monthStart, end: monthEnd } = getMonthRange(year, month);
          const stripEnd = addDays(today, 6);
          const rangeStart = monthStart < today ? monthStart : today;
          const rangeEnd = monthEnd > stripEnd ? monthEnd : stripEnd;
          const loggedMap = await getLoggedDatesForCalendar(user.uid, rangeStart, rangeEnd);
          if (cancelled) return;
          const [allEvents, restSet] = await Promise.all([
            getUnifiedCalendarEvents(user.uid, rangeStart, rangeEnd, {
              programs: progList,
              loggedMap,
            }),
            getRestDaysForRange(user.uid, rangeStart, rangeEnd),
          ]);
          if (cancelled) return;
          setRestDays(restSet);
          const monthEv = allEvents.filter((e) => e.date >= monthStart && e.date <= monthEnd);
          setMonthEvents(monthEv);
          const eventsByDate = new Map<string, CalendarEvent[]>();
          for (const e of allEvents) {
            const list = eventsByDate.get(e.date) ?? [];
            list.push(e);
            eventsByDate.set(e.date, list);
          }
          const days: UpcomingStripDay[] = [];
          for (let i = 0; i < 7; i++) {
            const date = addDays(today, i);
            const list = eventsByDate.get(date) ?? [];
            let sorted = sortEventsByTypeOrder(list, eventTypeOrder);
            if (activeProgramId != null) {
              sorted = [...sorted].sort((a, b) => {
                const aPrimary = a.type === 'program' && a.programId === activeProgramId;
                const bPrimary = b.type === 'program' && b.programId === activeProgramId;
                if (aPrimary && !bPrimary) return -1;
                if (!aPrimary && bPrimary) return 1;
                return 0;
              });
            }
            days.push({ date, events: sorted });
          }
          setStripDays(days);
          setWeekEvents([]);
          setListEvents([]);
        } else if (viewMode === 'week') {
          const weekEnd = addDays(weekStart, 6);
          const [allEvents, restSet] = await Promise.all([
            getUnifiedCalendarEvents(user.uid, weekStart, weekEnd, {
              programs: progList,
              loggedMap: await getLoggedDatesForCalendar(user.uid, weekStart, weekEnd),
            }),
            getRestDaysForRange(user.uid, weekStart, weekEnd),
          ]);
          if (cancelled) return;
          setRestDays(restSet);
          setWeekEvents(allEvents);
          setMonthEvents([]);
          setStripDays([]);
          setListEvents([]);
        } else {
          const listEnd = addDays(today, 21);
          const [allEvents, restSet] = await Promise.all([
            getUnifiedCalendarEvents(user.uid, today, listEnd, {
              programs: progList,
              loggedMap: await getLoggedDatesForCalendar(user.uid, today, listEnd),
            }),
            getRestDaysForRange(user.uid, today, listEnd),
          ]);
          if (cancelled) return;
          setRestDays(restSet);
          setListEvents(allEvents);
          setMonthEvents([]);
          setStripDays([]);
          setWeekEvents([]);
        }
      } catch (e) {
        if (import.meta.env.DEV) console.error('[ScheduleZone]', e);
        if (!cancelled) {
          setMonthEvents([]);
          setStripDays([]);
          setWeekEvents([]);
          setListEvents([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    user?.uid,
    year,
    month,
    today,
    weekStart,
    viewMode,
    refreshKey,
    loadPrograms,
    activeProgramId,
    eventTypeOrder,
  ]);

  const amrapEvent = selectedDayEvents?.length === 1 ? selectedDayEvents[0] : null;
  const isSingleAmrap = amrapEvent?.type === 'amrap' && amrapEvent.sessionId != null;

  useEffect(() => {
    if (!user?.uid || !isSingleAmrap) {
      setAmrapResultForCalendar(null);
      return;
    }
    const sessionId = amrapEvent!.sessionId!;
    let cancelled = false;
    getAmrapSessionResults(user.uid, 100).then((results) => {
      if (cancelled) return;
      const match = results.find((r) => r.session_id === sessionId) ?? null;
      setAmrapResultForCalendar(match);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.uid, isSingleAmrap, amrapEvent?.sessionId]);

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    getEventOrderPreference(user.uid).then((order) => {
      if (!cancelled) setEventTypeOrder(order);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const handleMonthChange = useCallback((newYear: number, newMonth: number) => {
    setYear(newYear);
    setMonth(newMonth);
  }, []);

  const handleDayClick = useCallback(
    (date: string, events: CalendarEvent[]) => {
      if (selectMode) return;
      if (events.length > 0) {
        setSelectedDayEvents(events);
      } else {
        setEmptyDayDrawer({ date });
        setRestDayMessage(null);
      }
    },
    [selectMode]
  );

  const handleDaySelect = useCallback((date: string, selected: boolean) => {
    const iso = date.slice(0, 10);
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (selected) next.add(iso);
      else next.delete(iso);
      return next;
    });
  }, []);

  const handleSelectModeToggle = useCallback(() => {
    setSelectMode((prev) => {
      if (prev) setSelectedDates(new Set());
      return !prev;
    });
  }, []);

  const handleMarkRest = useCallback(
    async (date: string) => {
      if (!user?.uid) return;
      try {
        await addRestDay(user.uid, date);
        setRestDays((prev) => new Set(prev).add(date.slice(0, 10)));
        onCalendarRefresh?.();
        toast.success('Day marked as rest');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to mark rest day');
      }
    },
    [user?.uid, onCalendarRefresh]
  );

  const handleUnmarkRest = useCallback(
    async (date: string) => {
      if (!user?.uid) return;
      try {
        await removeRestDay(user.uid, date);
        setRestDays((prev) => {
          const next = new Set(prev);
          next.delete(date.slice(0, 10));
          return next;
        });
        onCalendarRefresh?.();
        toast.success('Rest day removed');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to unmark rest day');
      }
    },
    [user?.uid, onCalendarRefresh]
  );

  const handleStartWorkout = useCallback(
    (workout: WorkoutFromSchedule, programId: string, weekId: string, workoutId: string) => {
      setSelectedDayEvents(null);
      setWorkoutPlayer({ workout, programId, weekId, workoutId });
    },
    []
  );

  const handleAmrapViewResults = useCallback(() => {
    if (amrapResultForCalendar) {
      setSelectedAmrapResult(amrapResultForCalendar);
      setSelectedDayEvents(null);
    }
  }, [amrapResultForCalendar]);

  const handleAmrapDoAgain = useCallback(async (result: AmrapSessionResult) => {
    setSelectedAmrapResult(null);
    try {
      const { session_id } = await createAmrapSession({
        duration_minutes: result.duration_minutes,
        workout_list: result.workout_list,
        host_nickname: 'Host',
      });
      window.location.href = getAmrapSessionUrl(session_id);
    } catch {
      // Error could be shown via toast; for now user stays on page
    }
  }, []);

  const handleAmrapSchedule = useCallback((result: AmrapSessionResult) => {
    setSelectedAmrapResult(null);
    setSchedulingFor(result);
  }, []);

  const handleEventDrop = useCallback(
    async (event: CalendarEvent, targetDate: string) => {
      if (!user?.uid) return;
      const prevScheduled = event.metadata?.scheduledAt as string | undefined;
      let timePart = '12:00:00';
      if (prevScheduled?.includes('T')) {
        const afterT = prevScheduled.slice(prevScheduled.indexOf('T') + 1);
        const m = afterT.match(/^(\d{2}:\d{2}:\d{2})/);
        if (m) timePart = m[1];
      }
      const newScheduledAt = `${targetDate}T${timePart}Z`;

      try {
        if (event.type === 'timer_scheduled' && event.sessionId) {
          await updateScheduledWorkout(event.sessionId, { scheduledAt: newScheduledAt });
          toast.success('Workout rescheduled');
        } else if (event.type === 'amrap_scheduled' && event.sessionId) {
          await rescheduleAmrapSession(event.sessionId, newScheduledAt);
          toast.success('AMRAP session rescheduled');
        } else {
          toast.error('This event cannot be rescheduled');
          return;
        }
        onCalendarRefresh?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to reschedule');
        throw err;
      }
    },
    [user?.uid, onCalendarRefresh]
  );

  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const handleDragStart = useCallback((e: DragStartEvent) => {
    const ev = e.active.data.current?.event as CalendarEvent | undefined;
    if (ev) setActiveEvent(ev);
  }, []);
  const handleDragEnd = useCallback(
    async (e: DragEndEvent) => {
      setActiveEvent(null);
      const overId = e.over?.id;
      const ev = e.active.data.current?.event as CalendarEvent | undefined;
      if (!ev || !overId || typeof overId !== 'string') return;
      const targetDate = String(overId);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return;
      if (targetDate === ev.date) return;
      try {
        await handleEventDrop(ev, targetDate);
      } catch (err) {
        if (import.meta.env.DEV) console.error('[ScheduleZone] onEventDrop failed:', err);
      }
    },
    [handleEventDrop]
  );

  const handleExportIcs = useCallback(async () => {
    if (!user?.uid || exportingIcs) return;
    setExportingIcs(true);
    try {
      const rangeStart = addDays(today, -7);
      const rangeEnd = addDays(today, 30);
      const progList = await loadPrograms();
      const loggedMap = await getLoggedDatesForCalendar(user.uid, rangeStart, rangeEnd);
      const raw = await getUnifiedCalendarEvents(user.uid, rangeStart, rangeEnd, {
        programs: progList,
        loggedMap,
      });
      const byDate = new Map<string, CalendarEvent[]>();
      for (const e of raw) {
        const list = byDate.get(e.date) ?? [];
        list.push(e);
        byDate.set(e.date, list);
      }
      const sorted: CalendarEvent[] = [];
      for (const date of [...byDate.keys()].sort()) {
        sorted.push(...sortEventsByTypeOrder(byDate.get(date) ?? [], eventTypeOrder));
      }
      const ics = buildIcsFromEvents(sorted);
      const blob = new Blob([ics], { type: 'text/calendar; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'interval-timers.ics';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Calendar exported');
    } catch (err) {
      if (import.meta.env.DEV) console.error('[ScheduleZone] export ics failed:', err);
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExportingIcs(false);
    }
  }, [user?.uid, today, loadPrograms, exportingIcs, eventTypeOrder]);

  const handleBulkMarkRest = useCallback(async () => {
    if (!user?.uid || selectedDates.size === 0) return;
    try {
      for (const date of selectedDates) {
        await addRestDay(user.uid, date);
      }
      setRestDays((prev) => {
        const next = new Set(prev);
        for (const d of selectedDates) next.add(d);
        return next;
      });
      onCalendarRefresh?.();
      toast.success(
        `${selectedDates.size} day${selectedDates.size === 1 ? '' : 's'} marked as rest`
      );
      setSelectedDates(new Set());
      setSelectMode(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark rest days');
    }
  }, [user?.uid, selectedDates, onCalendarRefresh]);

  const handleCopyWeekOpen = useCallback(() => {
    if (selectedDates.size === 0) return;
    const sorted = Array.from(selectedDates).sort();
    const first = sorted[0];
    const { start: sourceWeekStart } = getWeekBounds(first);
    const targetWeekStart = shiftDate(sourceWeekStart, 7);
    setCopyWeekModalOpen({ sourceWeekStart, targetWeekStart });
  }, [selectedDates, getWeekBounds, shiftDate]);

  const handleCopyWeekConfirm = useCallback(async () => {
    if (!user?.uid || !copyWeekModalOpen) return;
    const { sourceWeekStart, targetWeekStart } = copyWeekModalOpen;
    const sourceEnd = shiftDate(sourceWeekStart, 6);
    try {
      for (let i = 0; i < 7; i++) {
        const src = shiftDate(sourceWeekStart, i);
        if (restDays.has(src)) {
          await addRestDay(user.uid, shiftDate(targetWeekStart, i));
        }
      }
      const timerRows = await getScheduledWorkoutsForRange(user.uid, sourceWeekStart, sourceEnd);
      for (const row of timerRows) {
        const srcDate = row.scheduled_at.slice(0, 10);
        const dayOffset = Math.round(
          (new Date(srcDate + 'T12:00:00Z').getTime() -
            new Date(sourceWeekStart + 'T12:00:00Z').getTime()) /
            86400000
        );
        const newDate = shiftDate(targetWeekStart, dayOffset);
        const timePart = row.scheduled_at.includes('T')
          ? row.scheduled_at.slice(row.scheduled_at.indexOf('T'))
          : 'T12:00:00.000Z';
        await saveScheduledWorkout(user.uid, {
          sourceApp: row.source_app,
          scheduledAt: newDate + timePart,
          workoutTitle: row.workout_title,
          config: row.config,
        });
      }
      const amrapSessions = await getAmrapScheduledSessionsForUser(
        user.uid,
        sourceWeekStart,
        sourceEnd
      );
      for (const s of amrapSessions) {
        const srcDate = s.scheduled_start_at.slice(0, 10);
        const dayOffset = Math.round(
          (new Date(srcDate + 'T12:00:00Z').getTime() -
            new Date(sourceWeekStart + 'T12:00:00Z').getTime()) /
            86400000
        );
        const newDate = shiftDate(targetWeekStart, dayOffset);
        const timePart = s.scheduled_start_at.includes('T')
          ? s.scheduled_start_at.slice(s.scheduled_start_at.indexOf('T'))
          : 'T09:00:00.000Z';
        await createAmrapSession({
          duration_minutes: s.duration_minutes,
          workout_list: s.workout_list,
          scheduled_start_at: newDate + timePart,
        });
      }
      setCopyWeekModalOpen(null);
      onCalendarRefresh?.();
      toast.success('Week copied');
      setSelectedDates(new Set());
      setSelectMode(false);
    } catch (err) {
      if (import.meta.env.DEV) console.error('[ScheduleZone] copy week failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to copy week');
    }
  }, [user?.uid, copyWeekModalOpen, restDays, shiftDate, onCalendarRefresh]);

  const scheduledToClear = React.useMemo(() => {
    return monthEvents.filter(
      (e) =>
        (e.type === 'timer_scheduled' || e.type === 'amrap_scheduled') &&
        e.sessionId &&
        selectedDates.has(e.date)
    );
  }, [monthEvents, selectedDates]);

  const handleClearScheduledOpen = useCallback(() => {
    setClearConfirmModalOpen(true);
  }, []);

  const handleClearScheduledConfirm = useCallback(async () => {
    if (!user?.uid || scheduledToClear.length === 0) return;
    try {
      for (const ev of scheduledToClear) {
        if (ev.type === 'timer_scheduled' && ev.sessionId) {
          await deleteScheduledWorkout(ev.sessionId);
        } else if (ev.type === 'amrap_scheduled' && ev.sessionId) {
          await cancelAmrapSessionForCreator(ev.sessionId);
        }
      }
      setClearConfirmModalOpen(false);
      onCalendarRefresh?.();
      toast.success('Scheduled workouts cleared');
      setSelectedDates(new Set());
      setSelectMode(false);
    } catch (err) {
      if (import.meta.env.DEV) console.error('[ScheduleZone] clear scheduled failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to clear scheduled');
    }
  }, [user?.uid, scheduledToClear, onCalendarRefresh]);

  const handleWeekChange = useCallback(
    (delta: number) => {
      setWeekStart((prev) => shiftDate(prev, delta * 7));
    },
    [shiftDate]
  );

  const handleEventOrderSave = useCallback(
    async (newOrder: CalendarEventType[]) => {
      if (!user?.uid) return;
      try {
        await setEventOrderPreference(user.uid, newOrder);
        setEventTypeOrder(newOrder);
        setEventOrderModalOpen(false);
        toast.success('Event order saved');
      } catch (err) {
        if (import.meta.env.DEV) console.error('[ScheduleZone] setEventOrderPreference', err);
        toast.error(err instanceof Error ? err.message : 'Failed to save event order');
      }
    },
    [user?.uid]
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          {(['month', 'week', 'list'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`border-b-2 px-4 py-2 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                viewMode === mode
                  ? 'border-orange-light text-orange-light'
                  : 'border-transparent text-white/60 hover:text-white/80'
              }`}
            >
              {mode === 'month' ? 'Month' : mode === 'week' ? 'Week' : 'List'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setEventOrderModalOpen(true)}
          className="font-mono text-[10px] uppercase tracking-wider text-white/60 transition-colors hover:text-white/80"
        >
          Order events
        </button>
      </div>
      {eventOrderModalOpen && (
        <EventOrderSettings
          currentOrder={eventTypeOrder}
          onSave={handleEventOrderSave}
          onClose={() => setEventOrderModalOpen(false)}
        />
      )}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {viewMode === 'month' && (
          <AppCalendar
            refreshKey={refreshKey}
            events={monthEvents}
            eventTypeOrder={eventTypeOrder}
            onEventClick={(date, events) => handleDayClick(date, events)}
            onMonthChange={handleMonthChange}
            onEventDrop={handleEventDrop}
            onExportIcs={handleExportIcs}
            exportIcsLoading={exportingIcs}
            dndFromParent
            restDays={restDays}
            selectMode={selectMode}
            selectedDates={selectedDates}
            onDaySelect={handleDaySelect}
            onSelectModeToggle={handleSelectModeToggle}
          />
        )}
        {viewMode === 'week' && (
          <CalendarWeekView
            events={weekEvents}
            weekStart={weekStart}
            todayISO={today}
            restDays={restDays}
            eventTypeOrder={eventTypeOrder}
            onEventClick={handleDayClick}
            onEventDrop={handleEventDrop}
            onWeekChange={handleWeekChange}
            onExportIcs={handleExportIcs}
            exportIcsLoading={exportingIcs}
            loading={loading}
          />
        )}
        {viewMode === 'list' && (
          <CalendarListView
            events={listEvents}
            todayISO={today}
            restDays={restDays}
            eventTypeOrder={eventTypeOrder}
            onEventClick={handleDayClick}
            onExportIcs={handleExportIcs}
            exportIcsLoading={exportingIcs}
            loading={loading}
          />
        )}
        {!loading && stripDays.length > 0 && viewMode !== 'week' && (
          <div className="mt-6">
            <h4 className="mb-3 font-mono text-[10px] uppercase tracking-[0.4em] text-orange-light">
              Next 7 days
            </h4>
            <UpcomingStrip
              days={stripDays}
              todayISO={today}
              onDayClick={handleDayClick}
              droppable
              restDays={restDays}
            />
          </div>
        )}
        <DragOverlay>
          {activeEvent ? <CalendarEventDragPreview event={activeEvent} /> : null}
        </DragOverlay>
      </DndContext>

      {selectMode && selectedDates.size > 0 && (
        <CalendarMultiSelectBar
          selectedCount={selectedDates.size}
          onMarkRest={handleBulkMarkRest}
          onCopyWeek={handleCopyWeekOpen}
          onClearScheduled={handleClearScheduledOpen}
          onCancel={handleSelectModeToggle}
        />
      )}

      {copyWeekModalOpen && (
        <CalendarCopyWeekModal
          sourceWeekStart={copyWeekModalOpen.sourceWeekStart}
          targetWeekStart={copyWeekModalOpen.targetWeekStart}
          onConfirm={handleCopyWeekConfirm}
          onClose={() => setCopyWeekModalOpen(null)}
        />
      )}

      {clearConfirmModalOpen && (
        <CalendarClearConfirmModal
          scheduledCount={scheduledToClear.length}
          dayCount={selectedDates.size}
          onConfirm={handleClearScheduledConfirm}
          onClose={() => setClearConfirmModalOpen(false)}
        />
      )}

      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-white/80">
        This week: {workoutsThisWeek} workout{workoutsThisWeek !== 1 ? 's' : ''}
        {durationThisWeekSeconds > 0 && `, ${formatDuration(durationThisWeekSeconds)}`}
        {prCountThisWeek > 0 && `, ${prCountThisWeek} PR${prCountThisWeek !== 1 ? 's' : ''}`}
      </div>
      {restDayMessage && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-mono text-[10px] text-white/70">
          {restDayMessage}
        </div>
      )}
      {selectedDayEvents?.length === 1 && selectedDayEvents[0].type === 'program' && (
        <WorkoutEventDrawer
          event={selectedDayEvents[0]}
          onClose={() => setSelectedDayEvents(null)}
          onStartWorkout={handleStartWorkout}
          onViewLog={onViewLog}
        />
      )}
      {selectedDayEvents?.length === 1 && selectedDayEvents[0].type === 'timer' && (
        <TimerActivityDrawer
          event={selectedDayEvents[0]}
          onClose={() => setSelectedDayEvents(null)}
          onUpdated={onCalendarRefresh}
        />
      )}
      {selectedDayEvents?.length === 1 && selectedDayEvents[0].type === 'timer_scheduled' && (
        <ScheduledTimerDrawer
          event={selectedDayEvents[0]}
          onClose={() => setSelectedDayEvents(null)}
          onRemoved={onCalendarRefresh}
        />
      )}
      {selectedDayEvents?.length === 1 &&
        selectedDayEvents[0].type !== 'program' &&
        selectedDayEvents[0].type !== 'timer' &&
        selectedDayEvents[0].type !== 'timer_scheduled' && (
          <SimpleActivityDrawer
            event={selectedDayEvents[0]}
            onClose={() => setSelectedDayEvents(null)}
            onViewResults={
              isSingleAmrap && amrapResultForCalendar ? handleAmrapViewResults : undefined
            }
          />
        )}
      {selectedDayEvents && selectedDayEvents.length > 1 && (
        <MultiActivityDayDrawer
          date={selectedDayEvents[0].date}
          events={selectedDayEvents}
          eventTypeOrder={eventTypeOrder}
          onClose={() => setSelectedDayEvents(null)}
          onEventSelect={(ev) => setSelectedDayEvents([ev])}
          onScheduleWorkout={(date) => {
            setSelectedDayEvents(null);
            setScheduleModalOpen({ date });
          }}
        />
      )}
      {selectedAmrapResult && (
        <AmrapResultDetailDrawer
          result={selectedAmrapResult}
          onClose={() => setSelectedAmrapResult(null)}
          onDoAgain={handleAmrapDoAgain}
          onSchedule={handleAmrapSchedule}
        />
      )}

      {schedulingFor && (
        <AmrapScheduleModal
          result={schedulingFor}
          onClose={() => setSchedulingFor(null)}
          onScheduled={onCalendarRefresh}
        />
      )}

      {emptyDayDrawer && (
        <EmptyDayActionDrawer
          date={emptyDayDrawer.date}
          isRestDay={restDays.has(emptyDayDrawer.date.slice(0, 10))}
          onClose={() => setEmptyDayDrawer(null)}
          onMarkRest={() => handleMarkRest(emptyDayDrawer.date)}
          onUnmarkRest={() => handleUnmarkRest(emptyDayDrawer.date)}
          onScheduleWorkout={() => {
            const date = emptyDayDrawer.date;
            setEmptyDayDrawer(null);
            setScheduleModalOpen({ date });
          }}
        />
      )}

      {scheduleModalOpen && (
        <ScheduleWorkoutModal
          date={scheduleModalOpen.date}
          isRestDay={restDays.has(scheduleModalOpen.date.slice(0, 10))}
          onClose={() => setScheduleModalOpen(null)}
          onScheduled={onCalendarRefresh}
        />
      )}

      {workoutPlayer && (
        <WorkoutPlayer
          workout={workoutPlayer.workout}
          programId={workoutPlayer.programId}
          weekId={workoutPlayer.weekId}
          workoutId={workoutPlayer.workoutId}
          onClose={() => setWorkoutPlayer(null)}
          onComplete={() => setWorkoutPlayer(null)}
        />
      )}
    </div>
  );
};

export default ScheduleZone;
