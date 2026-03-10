/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Drawer for a calendar workout event: details, exercise preview, Start Workout / View Log.
 */

import React, { useState, useEffect } from 'react';
import { X, Play, History } from 'lucide-react';
import { getProgramWithSchedule } from '@/lib/supabase/client/user-programs';
import { getExercisesFromWorkout } from '@/lib/program-schedule-utils';
import type { CalendarEvent } from '@/lib/calendar-events';
import type { ProgramSchedule } from '@/types/ai-program';

type WorkoutFromSchedule = ProgramSchedule['workouts'][number];

export interface WorkoutEventDrawerProps {
  event: CalendarEvent;
  onClose: () => void;
  onStartWorkout: (
    workout: WorkoutFromSchedule,
    programId: string,
    weekId: string,
    workoutId: string
  ) => void;
  /** When user taps View Log (completed event), scroll to History Zone. */
  onViewLog?: () => void;
}

function parseWeekId(weekId: string): number {
  const n = parseInt(weekId.replace(/^week-/, ''), 10);
  return Number.isNaN(n) ? 1 : n;
}

const WorkoutEventDrawer: React.FC<WorkoutEventDrawerProps> = ({
  event,
  onClose,
  onStartWorkout,
  onViewLog,
}) => {
  const [workout, setWorkout] = useState<WorkoutFromSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getProgramWithSchedule(event.programId)
      .then((prog) => {
        if (cancelled || !prog) {
          setWorkout(null);
          setError(prog ? null : 'Program not found');
          return;
        }
        const weekNum = parseWeekId(event.weekId);
        const week = prog.schedule.find((w) => w.weekNumber === weekNum);
        const idx = parseInt(event.workoutId, 10);
        const w = week?.workouts?.[idx] ?? null;
        setWorkout(w ?? null);
        if (!w) setError('Workout not found');
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load');
          setWorkout(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [event.programId, event.weekId, event.workoutId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const exercises = workout ? getExercisesFromWorkout(workout).slice(0, 3) : [];
  const dateLabel = event.date
    ? new Date(event.date + 'T12:00:00Z').toLocaleDateString('default', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : '';

  const statusLabel =
    event.status === 'completed' ? 'Completed' : event.status === 'missed' ? 'Missed' : 'Scheduled';
  const statusClass =
    event.status === 'completed'
      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
      : event.status === 'missed'
        ? 'bg-white/10 text-white/50 border-white/20'
        : 'bg-orange-light/20 text-orange-light border-orange-light/40';

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-3xl border border-white/10 bg-bg-dark shadow-2xl"
        role="dialog"
        aria-labelledby="drawer-title"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-bg-dark px-6 py-4">
          <h2 id="drawer-title" className="font-heading text-lg font-black uppercase text-white">
            Workout
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          {loading ? (
            <p className="font-mono text-[10px] uppercase text-white/40">Loading…</p>
          ) : error ? (
            <p className="text-sm text-white/60">{error}</p>
          ) : (
            <>
              <div className="mb-4">
                <p className="font-heading text-xl font-black text-white">{event.workoutTitle}</p>
                <p className="mt-0.5 font-mono text-[10px] uppercase text-white/50">
                  {event.programTitle}
                </p>
                <p className="mt-1 font-mono text-[10px] text-white/40">{dateLabel}</p>
                <span
                  className={`mt-2 inline-block rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${statusClass}`}
                >
                  {statusLabel}
                </span>
              </div>
              {exercises.length > 0 && (
                <div className="mb-6">
                  <p className="mb-2 font-mono text-[10px] uppercase text-white/50">
                    Exercises preview
                  </p>
                  <ul className="space-y-1">
                    {exercises.map((ex, i) => (
                      <li
                        key={i}
                        className="font-mono text-xs text-white/80"
                      >{`${i + 1}. ${ex.exerciseName}${ex.reps ? ` — ${ex.reps}` : ''}`}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex flex-col gap-3">
                {event.status !== 'completed' && workout && (
                  <button
                    type="button"
                    onClick={() =>
                      onStartWorkout(workout, event.programId, event.weekId, event.workoutId)
                    }
                    className="border-orange-light/50 bg-orange-light/20 hover:bg-orange-light/30 flex items-center justify-center gap-2 rounded-2xl border py-3 font-heading text-sm font-black uppercase text-orange-light transition-colors"
                  >
                    <Play className="h-4 w-4" />
                    Start Workout
                  </button>
                )}
                {event.status === 'completed' ? (
                  <button
                    type="button"
                    onClick={() => {
                      onViewLog?.();
                      onClose();
                    }}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 py-3 font-mono text-[10px] uppercase text-white/70"
                  >
                    <History className="h-4 w-4" />
                    View Log
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default WorkoutEventDrawer;
