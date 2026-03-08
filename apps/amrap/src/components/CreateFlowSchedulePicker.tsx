import { useMemo, useState } from 'react';
import {
  startOfWeek,
  addDays,
  addWeeks,
  isSameDay,
  format,
  startOfDay,
} from 'date-fns';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Minimum time for datetime-local (today at 00:00 in local tz). */
function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse datetime-local string to Date. */
function fromDatetimeLocal(s: string): Date | null {
  if (!s || s.length < 16) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface CreateFlowSchedulePickerProps {
  value: string;
  onChange: (value: string) => void;
  /** Minimum selectable date/time (local); e.g. new Date() to disallow past. */
  minDate?: Date;
}

const MAX_WEEKS_AHEAD = 1;

export default function CreateFlowSchedulePicker({
  value,
  onChange,
  minDate,
}: CreateFlowSchedulePickerProps) {
  const today = useMemo(() => new Date(), []);
  const thisWeekStart = useMemo(() => startOfWeek(today, { weekStartsOn: 0 }), [today]);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week, 1 = next week (max 1 ahead)
  const weekStart = useMemo(
    () => (weekOffset === 0 ? thisWeekStart : addWeeks(thisWeekStart, weekOffset)),
    [thisWeekStart, weekOffset]
  );
  const dayDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const weekEnd = addDays(weekStart, 6);
  const weekRangeLabel = `${format(weekStart, 'EEE, MMM d')} – ${format(weekEnd, 'EEE, MMM d')}`;
  const isThisWeek = weekOffset === 0;
  const isNextWeek = weekOffset === MAX_WEEKS_AHEAD;

  const selectedDate = value ? fromDatetimeLocal(value) : null;
  const defaultTime = '18:00';
  const [timePart, setTimePart] = useState(() => {
    if (value && value.length >= 16) {
      const t = value.slice(11, 16);
      return t;
    }
    return defaultTime;
  });

  const handleSelectDay = (dayDate: Date) => {
    const [h, m] = timePart.split(':').map(Number);
    const combined = startOfDay(dayDate);
    combined.setHours(isNaN(h) ? 18 : h, isNaN(m) ? 0 : m, 0, 0);
    if (minDate && combined.getTime() < minDate.getTime()) {
      combined.setTime(minDate.getTime());
      setTimePart(format(combined, 'HH:mm'));
    }
    onChange(toDatetimeLocal(combined));
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = e.target.value;
    setTimePart(t);
    const base = selectedDate ? new Date(selectedDate) : startOfDay(today);
    const [h, m] = (t || defaultTime).split(':').map(Number);
    const combined = new Date(base);
    combined.setHours(isNaN(h) ? 18 : h, isNaN(m) ? 0 : m, 0, 0);
    onChange(toDatetimeLocal(combined));
  };

  const handleClear = () => {
    onChange('');
    setTimePart(defaultTime);
  };

  return (
    <div className="rounded-xl border border-white/20 bg-black/20 p-4">
      <p className="mb-2 text-sm text-white/70">
        Optionally set when you plan to start; invitees will see a countdown and can join up to 10 minutes before.
      </p>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span className="font-medium text-white/90">
          Today: {format(today, 'EEEE, MMMM d, yyyy')}
        </span>
        <span className="text-white/60">
          {isThisWeek ? 'This week' : 'Next week'}: {weekRangeLabel}
        </span>
      </div>
      <div className="mb-3">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-white/70">
            Schedule for (optional)
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setWeekOffset((o) => Math.max(0, o - 1))}
              disabled={isThisWeek}
              className="rounded border border-white/20 bg-black/30 px-2 py-1 text-xs font-medium text-white/90 transition-colors hover:border-orange-500 hover:bg-orange-600/20 disabled:opacity-40 disabled:pointer-events-none"
            >
              ← This week
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset((o) => Math.min(MAX_WEEKS_AHEAD, o + 1))}
              disabled={isNextWeek}
              className="rounded border border-white/20 bg-black/30 px-2 py-1 text-xs font-medium text-white/90 transition-colors hover:border-orange-500 hover:bg-orange-600/20 disabled:opacity-40 disabled:pointer-events-none"
            >
              Next week →
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {dayDates.map((dayDate) => {
            const isToday = isSameDay(dayDate, today);
            const isSelected = selectedDate && isSameDay(dayDate, selectedDate);
            return (
              <button
                key={dayDate.getTime()}
                type="button"
                onClick={() => handleSelectDay(dayDate)}
                className={`rounded-lg border py-2 text-center text-sm transition-colors ${
                  isSelected
                    ? 'border-orange-500 bg-orange-500/30 text-white'
                    : isToday
                      ? 'border-orange-500/50 bg-orange-500/10 text-orange-200'
                      : 'border-white/10 bg-black/30 text-white/80 hover:border-white/20 hover:bg-black/40'
                }`}
              >
                <div className="text-[10px] font-medium text-white/60">
                  {DAY_LABELS[dayDate.getDay()]}
                </div>
                <div className="font-bold">{format(dayDate, 'd')}</div>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="text-xs text-white/70">Time</label>
          <input
            type="time"
            value={timePart}
            onChange={handleTimeChange}
            className="rounded-lg border border-white/20 bg-black/30 px-2 py-1.5 text-sm text-white focus:border-orange-500 focus:outline-none"
          />
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-white/60 underline hover:text-white/90"
            >
              Clear
            </button>
          )}
        </div>
      </div>
      {value && selectedDate && (
        <p className="text-xs text-white/60">
          Scheduled: {format(selectedDate, 'EEE, MMM d, yyyy')} at {format(selectedDate, 'h:mm a')}
        </p>
      )}
    </div>
  );
}
