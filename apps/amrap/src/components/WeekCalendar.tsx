import { useState, useMemo, useEffect, type FC } from 'react';
import {
  startOfWeek,
  startOfMonth,
  endOfMonth,
  addMonths,
  addDays,
  isSameDay,
  isBefore,
  format,
  startOfDay,
} from 'date-fns';
import { useScheduledSessions } from '@/hooks/useScheduledSessions';
import type { ScheduledSession } from '@/hooks/useScheduledSessions';
import { getWorkoutTitle, getWorkoutTitleAndDuration } from '@/lib/workoutLabel';
import SessionEventModal from '@/components/SessionEventModal';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const GRID_DAYS = 6 * 7;

function formatEventTime(iso: string): string {
  return format(new Date(iso), 'h:mm a');
}

function getSessionsForDay(sessions: ScheduledSession[], dayDate: Date): ScheduledSession[] {
  return sessions.filter((s) => isSameDay(new Date(s.scheduled_start_at), dayDate));
}

/** True if the given day falls within the schedulable range (current week + next week). */
function isInActiveRange(dayDate: Date, thisWeekStart: Date, activeEnd: Date): boolean {
  const d = startOfDay(dayDate);
  return !isBefore(d, thisWeekStart) && isBefore(d, activeEnd);
}

export interface WeekCalendarProps {
  initialSelectedSession?: { id: string; scheduled_start_at: string } | null;
  onInitialSessionSelected?: () => void;
  /** When true, schedulable range extends to 52 weeks; otherwise 2 weeks. */
  hasFullAccess?: boolean;
}

const WeekCalendar: FC<WeekCalendarProps> = (props) => {
  const { initialSelectedSession, onInitialSessionSelected, hasFullAccess = false } = props;
  const [viewDate, setViewDate] = useState(() =>
    initialSelectedSession
      ? startOfMonth(new Date(initialSelectedSession.scheduled_start_at))
      : new Date()
  );

  const monthStart = useMemo(() => startOfMonth(viewDate), [viewDate]);
  const monthEnd = useMemo(() => endOfMonth(viewDate), [viewDate]);
  const monthEndExclusive = useMemo(() => addDays(monthEnd, 1), [monthEnd]);

  const { sessions, loading, error, refetch } = useScheduledSessions(monthStart, monthEndExclusive);
  const [selectedSession, setSelectedSession] = useState<ScheduledSession | null>(null);

  useEffect(() => {
    if (initialSelectedSession) {
      const targetMonth = startOfMonth(new Date(initialSelectedSession.scheduled_start_at));
      setViewDate((prev) =>
        isSameDay(startOfMonth(prev), targetMonth) ? prev : targetMonth
      );
    }
  }, [initialSelectedSession?.id, initialSelectedSession?.scheduled_start_at]);

  useEffect(() => {
    if (!loading && initialSelectedSession && sessions.length > 0) {
      const found = sessions.find((s) => s.id === initialSelectedSession.id);
      if (found) {
        queueMicrotask(() => {
          setSelectedSession(found);
        });
        onInitialSessionSelected?.();
      }
    }
  }, [loading, initialSelectedSession, sessions, onInitialSessionSelected]);

  const today = new Date();
  const thisWeekStart = startOfWeek(today, { weekStartsOn: 0 });
  const activeEnd = addDays(thisWeekStart, hasFullAccess ? 52 * 7 : 14);

  const gridStart = useMemo(
    () => startOfWeek(monthStart, { weekStartsOn: 0 }),
    [monthStart]
  );
  const dayDates = useMemo(() => {
    return Array.from({ length: GRID_DAYS }, (_, i) => addDays(gridStart, i));
  }, [gridStart]);

  const monthTitle = format(viewDate, 'MMMM yyyy');

  return (
    <section className="rounded-2xl border border-white/10 bg-black/30 p-6">
      <h2 className="mb-4 text-xl font-bold text-white">Schedule</h2>

      <div className="mb-4 flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-white/80">{monthTitle}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setViewDate((d) => addMonths(d, -1))}
            className="rounded-lg border border-white/20 bg-black/30 px-3 py-1.5 text-sm font-medium text-white/90 transition-colors hover:border-orange-500 hover:bg-orange-600/20"
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={() => setViewDate(() => new Date())}
            className="rounded-lg border border-white/20 bg-black/30 px-3 py-1.5 text-sm font-medium text-white/90 transition-colors hover:border-orange-500 hover:bg-orange-600/20"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setViewDate((d) => addMonths(d, 1))}
            className="rounded-lg border border-white/20 bg-black/30 px-3 py-1.5 text-sm font-medium text-white/90 transition-colors hover:border-orange-500 hover:bg-orange-600/20"
          >
            Next →
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-400">{error}</p>
      )}

      {/* Weekday headers */}
      <div className="mb-2 grid grid-cols-7 gap-2">
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-[10px] font-bold uppercase tracking-wider text-white/60"
          >
            {label}
          </div>
        ))}
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-white/50">Loading…</p>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {dayDates.map((dayDate) => {
            const isToday = isSameDay(dayDate, today);
            const active = isInActiveRange(dayDate, thisWeekStart, activeEnd);
            const isCurrentMonth = dayDate.getMonth() === viewDate.getMonth();
            const daySessions = getSessionsForDay(sessions, dayDate);
            return (
              <div
                key={dayDate.getTime()}
                className={`min-h-[100px] rounded-xl border p-2 ${
                  !isCurrentMonth
                    ? 'border-white/5 bg-black/10 opacity-50'
                    : active
                      ? isToday
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-white/10 bg-black/20'
                      : 'border-white/5 bg-black/10 opacity-60'
                }`}
              >
                <div className="mb-1.5 text-center">
                  <div
                    className={`text-sm font-bold ${
                      isToday ? 'text-orange-400' : isCurrentMonth ? 'text-white/90' : 'text-white/50'
                    }`}
                  >
                    {format(dayDate, 'd')}
                  </div>
                </div>
                <ul className="space-y-1">
                  {daySessions.map((session) => (
                    <li key={session.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedSession(session)}
                        title={getWorkoutTitleAndDuration(session.workout_list, session.duration_minutes)}
                        className="block w-full rounded border border-orange-500/30 bg-black/20 px-1.5 py-1 text-left text-[10px] transition-colors hover:border-orange-500/50 hover:bg-orange-500/10"
                      >
                        <span className="font-medium text-orange-400">
                          {formatEventTime(session.scheduled_start_at)}
                        </span>
                        <span className="ml-0.5 text-white/70">
                          {session.duration_minutes} min
                        </span>
                        <span className="mt-0.5 block truncate text-white/50">
                          {getWorkoutTitle(session.workout_list)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-center text-xs text-white/50">
        {hasFullAccess
          ? 'Schedule as far out as you like.'
          : 'Scheduling available for this week and next. Create an account to schedule further out.'}
      </p>

      {selectedSession && (
        <SessionEventModal
          session={selectedSession}
          isOpen={Boolean(selectedSession)}
          onClose={() => setSelectedSession(null)}
          maxWeeksAhead={hasFullAccess ? 52 : 1}
          onDeleted={() => {
            setSelectedSession(null);
            refetch();
          }}
          onRescheduled={() => {
            refetch();
          }}
        />
      )}
    </section>
  );
};

export default WeekCalendar;
