/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Session detail drawer: full log (exercises, sets), Do Again button.
 */

import React, { useState, useEffect } from 'react';
import { X, Play } from 'lucide-react';
import { getProgramWithSchedule } from '@/lib/supabase/client/user-programs';
import type { SessionHistoryItem } from '@/lib/supabase/client/session-history';
import type { ProgramSchedule } from '@/types/ai-program';
import type { ExerciseLog, SetLog } from '@/types/tracking';

type WorkoutFromSchedule = ProgramSchedule['workouts'][number];

export interface SessionDetailDrawerProps {
  session: SessionHistoryItem | null;
  onClose: () => void;
  onDoAgain: (
    workout: WorkoutFromSchedule,
    programId: string,
    weekId: string,
    workoutId: string
  ) => void;
}

function parseWeekId(weekId: string): number {
  const n = parseInt(weekId.replace(/^week-/, ''), 10);
  return Number.isNaN(n) ? 1 : n;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('default', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function SetRow({ set }: { set: SetLog }) {
  const weight = set.actualWeight > 0 ? `${set.actualWeight} lb` : '—';
  const reps = set.actualReps > 0 ? set.actualReps : '—';
  return (
    <tr className="border-b border-white/5 last:border-0">
      <td className="py-1.5 pr-3 font-mono text-[10px] text-white/50">{set.setNumber}</td>
      <td className="py-1.5 font-mono text-xs text-white/80">
        {weight} × {reps}
      </td>
      <td className="py-1.5 text-right">
        {set.completed ? (
          <span className="text-emerald-400" aria-label="Completed">
            ✓
          </span>
        ) : (
          <span className="text-white/30">—</span>
        )}
      </td>
    </tr>
  );
}

function ExerciseSection({ exercise }: { exercise: ExerciseLog }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="mb-2 font-mono text-[10px] font-medium uppercase text-white/70">
        {exercise.exerciseName}
      </p>
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10 text-left font-mono text-[10px] text-white/50">
            <th className="pb-1 pr-3">Set</th>
            <th className="pb-1">Weight × Reps</th>
            <th className="pb-1 text-right">Done</th>
          </tr>
        </thead>
        <tbody>
          {exercise.sets.map((set, i) => (
            <SetRow key={i} set={set} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SessionDetailDrawer: React.FC<SessionDetailDrawerProps> = ({
  session,
  onClose,
  onDoAgain,
}) => {
  const [doAgainLoading, setDoAgainLoading] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!session) return null;

  const handleDoAgain = () => {
    setDoAgainLoading(true);
    getProgramWithSchedule(session.programId)
      .then((prog) => {
        if (!prog) return;
        const weekNum = parseWeekId(session.weekId);
        const week = prog.schedule.find((w) => w.weekNumber === weekNum);
        const idx = parseInt(session.workoutId, 10);
        const workout = week?.workouts?.[idx] ?? null;
        if (workout) {
          onDoAgain(workout, session.programId, session.weekId, session.workoutId);
          onClose();
        }
      })
      .catch(() => {})
      .finally(() => setDoAgainLoading(false));
  };

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
        aria-labelledby="session-drawer-title"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-bg-dark px-6 py-4">
          <h2
            id="session-drawer-title"
            className="font-heading text-lg font-black uppercase text-white"
          >
            Session
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
          <div className="mb-4">
            <p className="font-heading text-xl font-black text-white">
              {session.workoutTitle ?? 'Workout'}
            </p>
            {session.programTitle && (
              <p className="mt-0.5 font-mono text-[10px] uppercase text-white/50">
                {session.programTitle}
              </p>
            )}
            <p className="mt-1 font-mono text-[10px] text-white/40">
              {formatDate(session.date)} · {formatDuration(session.durationSeconds)}
            </p>
            <p className="mt-1 font-mono text-[10px] text-white/40">Effort — · Readiness —</p>
          </div>

          <div className="mb-6">
            <p className="mb-3 font-mono text-[10px] uppercase text-white/50">Exercises & sets</p>
            {session.exercises.length === 0 ? (
              <p className="font-mono text-[10px] text-white/40">No exercises logged</p>
            ) : (
              session.exercises.map((ex, i) => <ExerciseSection key={i} exercise={ex} />)
            )}
          </div>

          <button
            type="button"
            onClick={handleDoAgain}
            disabled={doAgainLoading}
            className="border-orange-light/50 bg-orange-light/20 hover:bg-orange-light/30 flex w-full items-center justify-center gap-2 rounded-2xl border py-3 font-heading text-sm font-black uppercase text-orange-light transition-colors disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            {doAgainLoading ? 'Loading…' : 'Do Again'}
          </button>
        </div>
      </div>
    </>
  );
};

export default SessionDetailDrawer;
