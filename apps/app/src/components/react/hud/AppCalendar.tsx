/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Native in-app calendar: month view with program workouts as events.
 * Supports drag-and-drop reschedule for timer_scheduled and amrap_scheduled events.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useAppContext } from '@/contexts/AppContext';
import { fetchUserPrograms, getProgramWithSchedule } from '@/lib/supabase/client/user-programs';
import type { ProgramForCalendar } from '@/lib/calendar-events';
import {
  getCalendarEventsForRange,
  getMonthRange,
  type CalendarEvent,
  type CalendarEventType,
} from '@/lib/calendar-events';
import { sortEventsByTypeOrder } from '@/lib/calendar-event-order';
import { formatDayTooltip } from '@/lib/calendar-insights';

const DRAGGABLE_TYPES = ['timer_scheduled', 'amrap_scheduled'] as const;
type DraggableType = (typeof DRAGGABLE_TYPES)[number];

function isDraggable(ev: CalendarEvent): ev is CalendarEvent & { type: DraggableType } {
  return DRAGGABLE_TYPES.includes(ev.type as DraggableType) && ev.sessionId != null;
}

function dragId(ev: CalendarEvent): string {
  return `${ev.type}:${ev.sessionId}`;
}

export interface AppCalendarProps {
  /** When changed, calendar refetches synced programs and events (only when events is not provided). */
  refreshKey?: number;
  /** When provided, use these events instead of fetching (e.g. from ScheduleZone). */
  events?: CalendarEvent[];
  /** When provided, day cells are clickable; called with date and all events for that day. */
  onEventClick?: (date: string, events: CalendarEvent[]) => void;
  /** When provided, called when user navigates to another month (so parent can refetch). */
  onMonthChange?: (year: number, month: number) => void;
  /** When provided, draggable events (timer_scheduled, amrap_scheduled) can be dropped on a day to reschedule. */
  onEventDrop?: (event: CalendarEvent, targetDate: string) => Promise<void>;
  /** When provided, "Sync to Calendar" export button is shown; called to generate and download .ics. */
  onExportIcs?: () => void;
  /** When true, export button shows loading state. */
  exportIcsLoading?: boolean;
  /** When true, DndContext and DragOverlay are provided by parent; render only grid content. */
  dndFromParent?: boolean;
  /** Set of ISO date strings (YYYY-MM-DD) for days marked as rest. */
  restDays?: Set<string>;
  /** When true, day cells toggle selection instead of opening drawer (Phase 5.7). */
  selectMode?: boolean;
  /** Set of selected ISO date strings; used with selectMode. */
  selectedDates?: Set<string>;
  /** When provided with selectMode, called when user toggles a day's selection. */
  onDaySelect?: (date: string, selected: boolean) => void;
  /** Called when user clicks Select/Done in header to enter or exit select mode. */
  onSelectModeToggle?: () => void;
  /** When provided, same-day events are sorted by this type order (Phase 5.9). */
  eventTypeOrder?: CalendarEventType[];
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDaysInMonth(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const startPad = first.getDay();
  const days: (Date | null)[] = Array(startPad).fill(null);
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month - 1, d));
  }
  return days;
}

function dateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const STATUS_STYLES: Record<CalendarEvent['status'], { border: string; bg: string; text: string }> =
  {
    scheduled: {
      border: 'border-orange-light',
      bg: 'bg-orange-light/10',
      text: 'text-orange-light',
    },
    completed: { border: 'border-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
    missed: { border: 'border-white/30', bg: 'bg-white/5', text: 'text-white/50' },
  };

const TYPE_STYLES: Record<CalendarEvent['type'], { border: string; bg: string; text: string }> = {
  program: STATUS_STYLES.scheduled,
  amrap: { border: 'border-blue-400', bg: 'bg-blue-400/10', text: 'text-blue-400' },
  amrap_scheduled: { border: 'border-blue-300', bg: 'bg-blue-300/10', text: 'text-blue-300' },
  timer: { border: 'border-emerald-400', bg: 'bg-emerald-400/10', text: 'text-emerald-400' },
  timer_scheduled: {
    border: 'border-emerald-300',
    bg: 'bg-emerald-400/10',
    text: 'text-emerald-300',
  },
  readiness: { border: 'border-violet-400', bg: 'bg-violet-400/10', text: 'text-violet-400' },
};

function getEventStyle(ev: CalendarEvent): { border: string; bg: string; text: string } {
  const status = ev.status ?? 'completed';
  if (ev.type === 'program') return STATUS_STYLES[status];
  return TYPE_STYLES[ev.type];
}

/** Exported for DragOverlay when DndContext is provided by parent (ScheduleZone). */
export function CalendarEventDragPreview({ event }: { event: CalendarEvent }) {
  const style = getEventStyle(event);
  return (
    <div
      className={`truncate rounded border-l-2 px-1 py-0.5 font-mono text-[9px] shadow-lg ${style.border} ${style.bg} ${style.text} cursor-grabbing`}
    >
      {event.workoutTitle}
    </div>
  );
}

interface DraggableEventPillProps {
  event: CalendarEvent;
  style: { border: string; bg: string; text: string };
  onDayClick?: (iso: string, events: CalendarEvent[]) => void;
  dayIso: string;
  dayEvents: CalendarEvent[];
}

function DraggableEventPill({
  event,
  style,
  onDayClick,
  dayIso,
  dayEvents,
}: DraggableEventPillProps) {
  const id = dragId(event);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { event },
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && onDayClick?.(dayIso, dayEvents)}
      className={`truncate rounded border-l-2 px-1 py-0.5 font-mono text-[9px] ${style.border} ${style.bg} ${style.text} ${isDragging ? 'opacity-50' : ''} cursor-grab active:cursor-grabbing`}
    >
      {event.workoutTitle}
    </div>
  );
}

export interface DroppableDayCellProps {
  iso: string;
  dayEvents: CalendarEvent[];
  d: Date | null;
  onEventClick?: (date: string, events: CalendarEvent[]) => void;
  onEventDrop?: (event: CalendarEvent, targetDate: string) => Promise<void>;
  restDays?: Set<string>;
  selectMode?: boolean;
  selectedDates?: Set<string>;
  onDaySelect?: (date: string, selected: boolean) => void;
}

export function DroppableDayCell({
  iso,
  dayEvents,
  d,
  onEventClick,
  onEventDrop,
  restDays,
  selectMode,
  selectedDates,
  onDaySelect,
}: DroppableDayCellProps) {
  const { setNodeRef, isOver } = useDroppable({ id: iso });
  const draggableEvents = dayEvents.filter(isDraggable);
  const hasDnD = onEventDrop != null && draggableEvents.length > 0;
  const isRest = restDays?.has(iso) ?? false;
  const isSelected = selectMode && selectedDates?.has(iso);

  const dayTooltip = d && dayEvents.length > 0 ? formatDayTooltip(dayEvents) : undefined;
  const cellBaseClass = `group relative min-h-[80px] border p-1 md:min-h-[100px] ${
    isOver ? 'border-orange-light/60 bg-orange-light/10' : 'border-white/5 bg-bg-dark'
  }`;
  const restClass = isRest ? ' bg-white/5 border-white/10' : '';
  const selectClass = isSelected ? ' ring-2 ring-orange-light ring-inset' : '';

  const handleCellClick = () => {
    if (selectMode && onDaySelect && d && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      onDaySelect(iso, !selectedDates?.has(iso));
      return;
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={cellBaseClass + restClass + selectClass}
      aria-label={dayTooltip ?? (isRest && d ? 'Rest day' : undefined)}
      role={selectMode && d ? 'button' : undefined}
      tabIndex={selectMode && d ? 0 : undefined}
      onClick={selectMode && d ? handleCellClick : undefined}
      onKeyDown={
        selectMode && d
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCellClick();
              }
            }
          : undefined
      }
    >
      {dayTooltip && (
        <div
          className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 max-w-[180px] -translate-x-1/2 rounded border border-white/10 bg-gray-900 px-2 py-1.5 text-center font-mono text-[10px] text-white opacity-0 shadow-lg transition-opacity delay-150 duration-150 group-hover:opacity-100 group-hover:delay-0"
          role="tooltip"
        >
          {dayTooltip}
        </div>
      )}
      {d ? (
        <>
          <span
            className={`font-mono text-[10px] text-white/60 ${selectMode ? 'pointer-events-none' : ''}`}
          >
            {d.getDate()}
          </span>
          {dayEvents.length > 0 ? (
            <div className={`mt-1 space-y-0.5 ${selectMode ? 'pointer-events-none' : ''}`}>
              {hasDnD && !selectMode ? (
                dayEvents.map((ev, j) =>
                  isDraggable(ev) ? (
                    <DraggableEventPill
                      key={j}
                      event={ev}
                      style={getEventStyle(ev)}
                      onDayClick={onEventClick}
                      dayIso={iso}
                      dayEvents={dayEvents}
                    />
                  ) : (
                    <div
                      key={j}
                      className={`truncate rounded border-l-2 px-1 py-0.5 font-mono text-[9px] ${getEventStyle(ev).border} ${getEventStyle(ev).bg} ${getEventStyle(ev).text}`}
                    >
                      {ev.workoutTitle}
                    </div>
                  )
                )
              ) : !selectMode && onEventClick ? (
                <button
                  type="button"
                  onClick={() => onEventClick(iso, dayEvents)}
                  className="w-full rounded border-l-2 px-1 py-0.5 text-left font-mono text-[9px] transition-opacity hover:opacity-90 focus:outline-none focus:ring-1 focus:ring-white/30"
                >
                  {dayEvents.length > 1 ? (
                    <span className="block truncate text-white/80">
                      {dayEvents.length} activities
                    </span>
                  ) : (
                    <span
                      className={`block truncate rounded border-l-2 px-1 py-0.5 ${getEventStyle(dayEvents[0]).border} ${getEventStyle(dayEvents[0]).bg} ${getEventStyle(dayEvents[0]).text}`}
                    >
                      {dayEvents[0].workoutTitle}
                    </span>
                  )}
                </button>
              ) : (
                <ul className="space-y-0.5">
                  {dayEvents.length > 1 ? (
                    <li className="font-mono text-[9px] text-white/60">
                      {dayEvents.length} activities
                    </li>
                  ) : (
                    <li
                      className={`truncate rounded border-l-2 px-1 py-0.5 font-mono text-[9px] ${getEventStyle(dayEvents[0]).border} ${getEventStyle(dayEvents[0]).bg} ${getEventStyle(dayEvents[0]).text}`}
                    >
                      {dayEvents[0].workoutTitle}
                    </li>
                  )}
                </ul>
              )}
            </div>
          ) : selectMode ? (
            <div className="mt-1 min-h-[2rem]" />
          ) : onEventClick ? (
            <button
              type="button"
              onClick={() => onEventClick(iso, [])}
              className="mt-1 flex min-h-[2rem] w-full flex-col items-center justify-center rounded border border-dashed border-white/10 py-2 font-mono text-[10px] text-white/50 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-white/70 focus:outline-none focus:ring-1 focus:ring-white/30"
            >
              {isRest ? 'Rest' : null}
            </button>
          ) : isRest ? (
            <span className="mt-1 block font-mono text-[10px] text-white/40">Rest</span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

const AppCalendar: React.FC<AppCalendarProps> = ({
  refreshKey = 0,
  events: eventsProp,
  onEventClick,
  onMonthChange,
  onEventDrop,
  onExportIcs,
  exportIcsLoading = false,
  dndFromParent = false,
  restDays,
  selectMode = false,
  selectedDates,
  onDaySelect,
  onSelectModeToggle,
  eventTypeOrder,
}) => {
  const { user } = useAppContext();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [internalEvents, setInternalEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const events = eventsProp ?? internalEvents;

  useEffect(() => {
    if (eventsProp !== undefined) {
      setLoading(false);
      return;
    }
    if (!user?.uid) {
      setInternalEvents([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const accessList = await fetchUserPrograms(user.uid);
        const withStart = accessList.filter((a) => a.startDate);
        const programResults = await Promise.all(
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
        const programs = programResults.filter((p): p is ProgramForCalendar => p !== null);
        if (cancelled) return;
        const { start, end } = getMonthRange(year, month);
        const ev = getCalendarEventsForRange(start, end, programs);
        setInternalEvents(ev);
      } catch (e) {
        if (import.meta.env.DEV) console.error('[AppCalendar]', e);
        if (!cancelled) setInternalEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, year, month, refreshKey, eventsProp]);

  const days = useMemo(() => getDaysInMonth(year, month), [year, month]);
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    if (eventTypeOrder != null && eventTypeOrder.length > 0) {
      for (const [date, list] of map) {
        map.set(date, sortEventsByTypeOrder(list, eventTypeOrder));
      }
    }
    return map;
  }, [events, eventTypeOrder]);

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
      if (!ev || !overId || typeof overId !== 'string' || !onEventDrop) return;
      const targetDate = overId;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return;
      if (targetDate === ev.date) return;
      try {
        await onEventDrop(ev, targetDate);
      } catch (err) {
        if (import.meta.env.DEV) console.error('[AppCalendar] onEventDrop failed:', err);
        throw err;
      }
    },
    [onEventDrop]
  );

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => {
        const newY = y - 1;
        onMonthChange?.(newY, 12);
        return newY;
      });
    } else {
      setMonth((m) => {
        const newM = m - 1;
        onMonthChange?.(year, newM);
        return newM;
      });
    }
  };
  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => {
        const newY = y + 1;
        onMonthChange?.(newY, 1);
        return newY;
      });
    } else {
      setMonth((m) => {
        const newM = m + 1;
        onMonthChange?.(year, newM);
        return newM;
      });
    }
  };
  const monthLabel = `${new Date(year, month - 1).toLocaleString('default', { month: 'long' })} ${year}`;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm md:p-8">
      <div className="border-orange-light/20 mb-4 flex items-center justify-between border-b pb-4">
        <h4 className="font-mono text-[10px] uppercase tracking-[0.4em] text-orange-light">
          Calendar
        </h4>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-white transition-colors hover:bg-white/10"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[140px] text-center font-heading text-sm font-black uppercase text-white">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-white transition-colors hover:bg-white/10"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {onExportIcs && (
            <button
              type="button"
              onClick={onExportIcs}
              disabled={exportIcsLoading}
              className="ml-2 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-white transition-colors hover:bg-white/10 disabled:opacity-50"
              aria-label="Sync to Calendar"
              title="Export as .ics file for Google Calendar, Apple Calendar, or Outlook"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {exportIcsLoading ? 'Exporting…' : 'Sync to Calendar'}
            </button>
          )}
          {onDaySelect != null && (
            <button
              type="button"
              onClick={onSelectModeToggle}
              className="ml-2 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-white transition-colors hover:bg-white/10"
              aria-label={selectMode ? 'Done' : 'Select days'}
            >
              {selectMode ? 'Done' : 'Select'}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center font-mono text-[10px] uppercase text-white/40">Loading…</p>
      ) : (
        <>
          {onEventDrop ? (
            dndFromParent ? (
              <div className="grid grid-cols-7 gap-px border border-white/10 bg-white/5">
                {WEEKDAYS.map((wd) => (
                  <div
                    key={wd}
                    className="bg-bg-dark py-2 text-center font-mono text-[10px] uppercase text-white/50"
                  >
                    {wd}
                  </div>
                ))}
                {days.map((d, i) => {
                  const iso = d ? dateToISO(d) : `pad-${i}`;
                  const dayEvents: CalendarEvent[] = d ? (eventsByDate.get(iso) ?? []) : [];
                  return (
                    <DroppableDayCell
                      key={i}
                      iso={iso}
                      dayEvents={dayEvents}
                      d={d}
                      onEventClick={onEventClick}
                      onEventDrop={onEventDrop}
                      restDays={restDays}
                      selectMode={selectMode}
                      selectedDates={selectedDates}
                      onDaySelect={onDaySelect}
                    />
                  );
                })}
              </div>
            ) : (
              <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-7 gap-px border border-white/10 bg-white/5">
                  {WEEKDAYS.map((wd) => (
                    <div
                      key={wd}
                      className="bg-bg-dark py-2 text-center font-mono text-[10px] uppercase text-white/50"
                    >
                      {wd}
                    </div>
                  ))}
                  {days.map((d, i) => {
                    const iso = d ? dateToISO(d) : `pad-${i}`;
                    const dayEvents: CalendarEvent[] = d ? (eventsByDate.get(iso) ?? []) : [];
                    return (
                      <DroppableDayCell
                        key={i}
                        iso={iso}
                        dayEvents={dayEvents}
                        d={d}
                        onEventClick={onEventClick}
                        onEventDrop={onEventDrop}
                        restDays={restDays}
                        selectMode={selectMode}
                        selectedDates={selectedDates}
                        onDaySelect={onDaySelect}
                      />
                    );
                  })}
                </div>
                <DragOverlay>
                  {activeEvent ? <CalendarEventDragPreview event={activeEvent} /> : null}
                </DragOverlay>
              </DndContext>
            )
          ) : (
            <>
              <div className="grid grid-cols-7 gap-px border border-white/10 bg-white/5">
                {WEEKDAYS.map((wd) => (
                  <div
                    key={wd}
                    className="bg-bg-dark py-2 text-center font-mono text-[10px] uppercase text-white/50"
                  >
                    {wd}
                  </div>
                ))}
                {days.map((d, i) => {
                  const iso = d ? dateToISO(d) : '';
                  const dayEvents: CalendarEvent[] = iso ? (eventsByDate.get(iso) ?? []) : [];
                  const dayTooltipNoDnd =
                    d && dayEvents.length > 0 ? formatDayTooltip(dayEvents) : undefined;
                  const isRestNoDnd = iso ? (restDays?.has(iso) ?? false) : false;
                  const isSelectedNoDnd =
                    selectMode && iso ? (selectedDates?.has(iso) ?? false) : false;
                  const handleNoDndCellClick = () => {
                    if (selectMode && onDaySelect && iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
                      onDaySelect(iso, !selectedDates?.has(iso));
                    }
                  };
                  return (
                    <div
                      key={i}
                      className={`group relative min-h-[80px] border p-1 md:min-h-[100px] ${
                        isRestNoDnd ? 'border-white/10 bg-white/5' : 'border-white/5 bg-bg-dark'
                      } ${isSelectedNoDnd ? 'ring-2 ring-inset ring-orange-light' : ''}`}
                      aria-label={dayTooltipNoDnd ?? (isRestNoDnd && d ? 'Rest day' : undefined)}
                      role={selectMode && d ? 'button' : undefined}
                      tabIndex={selectMode && d ? 0 : undefined}
                      onClick={selectMode && d ? handleNoDndCellClick : undefined}
                      onKeyDown={
                        selectMode && d
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleNoDndCellClick();
                              }
                            }
                          : undefined
                      }
                    >
                      {dayTooltipNoDnd && (
                        <div
                          className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 max-w-[180px] -translate-x-1/2 rounded border border-white/10 bg-gray-900 px-2 py-1.5 text-center font-mono text-[10px] text-white opacity-0 shadow-lg transition-opacity delay-150 duration-150 group-hover:opacity-100 group-hover:delay-0"
                          role="tooltip"
                        >
                          {dayTooltipNoDnd}
                        </div>
                      )}
                      {d ? (
                        <>
                          <span
                            className={`font-mono text-[10px] text-white/60 ${selectMode ? 'pointer-events-none' : ''}`}
                          >
                            {d.getDate()}
                          </span>
                          {dayEvents.length > 0 ? (
                            !selectMode && onEventClick ? (
                              <button
                                type="button"
                                onClick={() => onEventClick(iso, dayEvents)}
                                className="mt-1 w-full rounded border-l-2 px-1 py-0.5 text-left font-mono text-[9px] transition-opacity hover:opacity-90 focus:outline-none focus:ring-1 focus:ring-white/30"
                              >
                                {dayEvents.length > 1 ? (
                                  <span className="block truncate text-white/80">
                                    {dayEvents.length} activities
                                  </span>
                                ) : (
                                  <span
                                    className={`block truncate rounded border-l-2 px-1 py-0.5 ${getEventStyle(dayEvents[0]).border} ${getEventStyle(dayEvents[0]).bg} ${getEventStyle(dayEvents[0]).text}`}
                                  >
                                    {dayEvents[0].workoutTitle}
                                  </span>
                                )}
                              </button>
                            ) : (
                              <ul className="mt-1 space-y-0.5">
                                {dayEvents.length > 1 ? (
                                  <li className="font-mono text-[9px] text-white/60">
                                    {dayEvents.length} activities
                                  </li>
                                ) : (
                                  <li
                                    className={`truncate rounded border-l-2 px-1 py-0.5 font-mono text-[9px] ${getEventStyle(dayEvents[0]).border} ${getEventStyle(dayEvents[0]).bg} ${getEventStyle(dayEvents[0]).text}`}
                                  >
                                    {dayEvents[0].workoutTitle}
                                  </li>
                                )}
                              </ul>
                            )
                          ) : selectMode ? (
                            <div className="mt-1 min-h-[2rem]" />
                          ) : onEventClick ? (
                            <button
                              type="button"
                              onClick={() => onEventClick(iso, [])}
                              className="mt-1 flex min-h-[2rem] w-full flex-col items-center justify-center rounded border border-dashed border-white/10 py-2 font-mono text-[10px] text-white/50 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-white/70 focus:outline-none focus:ring-1 focus:ring-white/30"
                            >
                              {isRestNoDnd ? 'Rest' : null}
                            </button>
                          ) : isRestNoDnd ? (
                            <span className="mt-1 block font-mono text-[10px] text-white/40">
                              Rest
                            </span>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {events.length === 0 && !loading && (
            <p className="mt-4 text-center text-sm italic text-white/40">
              No workouts on calendar. Sync a program from Saved Programs.
            </p>
          )}
        </>
      )}
    </section>
  );
};

export default AppCalendar;
