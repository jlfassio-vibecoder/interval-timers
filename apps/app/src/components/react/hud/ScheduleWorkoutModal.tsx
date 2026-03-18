/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Modal to schedule a workout from the calendar (AMRAP, Tabata, Daily Warm-Up). Phase 5.1 + 5.2.
 */

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { createAmrapSession } from '@/lib/supabase/client/amrap-create-session';
import { saveScheduledWorkout } from '@/lib/supabase/client/scheduled-workouts';
import {
  getSuggestedTimeForWorkoutType,
  formatSuggestedTime,
} from '@/lib/supabase/client/suggested-schedule-time';

export type SchedulableWorkoutType = 'amrap' | 'tabata' | 'daily-warmup';

export interface ScheduleWorkoutModalProps {
  /** Pre-fill date part (YYYY-MM-DD). If omitted, default to next hour. */
  date?: string;
  /** When true, show a non-blocking message that the day was marked as rest. */
  isRestDay?: boolean;
  onClose: () => void;
  onScheduled?: () => void;
}

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultDatetime(prefillDate?: string): Date {
  const now = new Date();
  if (!prefillDate) {
    const d = new Date(now);
    d.setMinutes(0, 0, 0);
    if (d.getTime() <= now.getTime()) d.setHours(d.getHours() + 1);
    return d;
  }
  const [y, m, day] = prefillDate.split('-').map(Number);
  const d = new Date(y, m - 1, day, 9, 0, 0, 0);
  if (d.getTime() <= now.getTime()) {
    d.setHours(now.getHours(), now.getMinutes(), 0, 0);
    if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  }
  return d;
}

/** Apply suggested time to current date part; if result is in the past, use tomorrow. */
function applySuggestedTime(
  datetimeValue: string,
  suggested: { hour: number; minute: number }
): string {
  const [datePart] = datetimeValue.split('T');
  const [y, m, day] = datePart.split('-').map(Number);
  const d = new Date(y, m - 1, day, suggested.hour, suggested.minute, 0, 0);
  const now = new Date();
  if (d.getTime() <= now.getTime()) {
    d.setDate(d.getDate() + 1);
  }
  return toDatetimeLocal(d);
}

const SCHEDULABLE_TYPES: { value: SchedulableWorkoutType; label: string }[] = [
  { value: 'amrap', label: 'AMRAP With Friends' },
  { value: 'tabata', label: 'Tabata' },
  { value: 'daily-warmup', label: 'Daily Warm-Up' },
];

const AMRAP_DURATIONS = [5, 10, 15, 20] as const;

export default function ScheduleWorkoutModal({
  date: prefillDate,
  isRestDay = false,
  onClose,
  onScheduled,
}: ScheduleWorkoutModalProps) {
  const { user } = useAppContext();
  const [workoutType, setWorkoutType] = useState<SchedulableWorkoutType>('amrap');
  const [datetimeValue, setDatetimeValue] = useState(() =>
    toDatetimeLocal(defaultDatetime(prefillDate))
  );
  const [amrapDuration, setAmrapDuration] = useState(10);
  const [amrapName, setAmrapName] = useState('AMRAP');
  const [timerLabel, setTimerLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [suggestedTime, setSuggestedTime] = useState<{
    hour: number;
    minute: number;
  } | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setSuggestedTime(null);
      return;
    }
    let cancelled = false;
    setSuggestedTime(null);
    getSuggestedTimeForWorkoutType(user.uid, workoutType).then((result) => {
      if (!cancelled) setSuggestedTime(result);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.uid, workoutType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;
    setError(null);
    setLoading(true);
    try {
      const scheduledAt = new Date(datetimeValue).toISOString();
      if (workoutType === 'amrap') {
        await createAmrapSession({
          duration_minutes: amrapDuration,
          workout_list: [amrapName.trim() || 'AMRAP'],
          host_nickname: 'Host',
          scheduled_start_at: scheduledAt,
        });
      } else {
        await saveScheduledWorkout(user.uid, {
          sourceApp: workoutType,
          scheduledAt,
          workoutTitle: timerLabel.trim() || null,
        });
      }
      setSuccess(true);
      onScheduled?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-bg-dark p-6 shadow-2xl"
        role="dialog"
        aria-labelledby="schedule-workout-modal-title"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="schedule-workout-modal-title"
            className="font-heading text-lg font-black uppercase text-white"
          >
            Schedule workout
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          <p className="text-white/90">Scheduled. It will appear on your calendar.</p>
        ) : (
          <form onSubmit={handleSubmit}>
            {isRestDay && (
              <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-amber-400">
                You marked this day as rest. Schedule anyway?
              </p>
            )}
            <label className="mb-2 block font-mono text-[10px] uppercase text-white/50">
              Workout type
            </label>
            <div className="mb-4 flex flex-col gap-2">
              {SCHEDULABLE_TYPES.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="workoutType"
                    value={value}
                    checked={workoutType === value}
                    onChange={() => setWorkoutType(value)}
                    className="text-orange-500 focus:ring-orange-500 rounded border-white/30"
                  />
                  <span className="text-white">{label}</span>
                </label>
              ))}
            </div>

            <label className="mb-2 block font-mono text-[10px] uppercase text-white/50">
              Date & time
            </label>
            {suggestedTime != null && (
              <button
                type="button"
                onClick={() => setDatetimeValue(applySuggestedTime(datetimeValue, suggestedTime))}
                className="border-orange-500/50 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 mb-2 inline-flex items-center rounded-full border px-3 py-1.5 font-mono text-xs transition-colors"
              >
                Usually at {formatSuggestedTime(suggestedTime.hour, suggestedTime.minute)}
              </button>
            )}
            <input
              type="datetime-local"
              value={datetimeValue}
              onChange={(e) => setDatetimeValue(e.target.value)}
              className="focus:border-orange-500 focus:ring-orange-500 mb-4 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white focus:outline-none focus:ring-1"
            />

            {workoutType === 'amrap' && (
              <>
                <label className="mb-2 block font-mono text-[10px] uppercase text-white/50">
                  Duration
                </label>
                <select
                  value={amrapDuration}
                  onChange={(e) => setAmrapDuration(Number(e.target.value))}
                  className="focus:border-orange-500 focus:ring-orange-500 mb-4 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white focus:outline-none focus:ring-1"
                >
                  {AMRAP_DURATIONS.map((m) => (
                    <option key={m} value={m} className="bg-bg-dark text-white">
                      {m} min
                    </option>
                  ))}
                </select>
                <label className="mb-2 block font-mono text-[10px] uppercase text-white/50">
                  Workout name (optional)
                </label>
                <input
                  type="text"
                  value={amrapName}
                  onChange={(e) => setAmrapName(e.target.value)}
                  placeholder="AMRAP"
                  className="focus:border-orange-500 focus:ring-orange-500 mb-4 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-1"
                />
              </>
            )}

            {(workoutType === 'tabata' || workoutType === 'daily-warmup') && (
              <>
                <label className="mb-2 block font-mono text-[10px] uppercase text-white/50">
                  Label (optional)
                </label>
                <input
                  type="text"
                  value={timerLabel}
                  onChange={(e) => setTimerLabel(e.target.value)}
                  placeholder={
                    workoutType === 'tabata' ? 'e.g. Tabata 20 min' : 'e.g. Daily Warm-Up'
                  }
                  className="focus:border-orange-500 focus:ring-orange-500 mb-4 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-1"
                />
              </>
            )}

            {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 font-bold text-white hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="border-orange-500 bg-orange-600 hover:bg-orange-500 rounded-xl border px-4 py-2 font-bold text-white disabled:opacity-50"
              >
                {loading ? 'Scheduling…' : 'Schedule'}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
