/**
 * Footer actions: Schedule, Log Past, Open Workout (gym logger), Launch Timer.
 */

import { useState } from 'react';
import type { WorkoutSetTemplate } from '@/types/workoutSetTemplate';
import SchedulePastedWorkoutModal from './SchedulePastedWorkoutModal';

const APP_BASE =
  import.meta.env.VITE_APP_ORIGIN || import.meta.env.VITE_MAIN_APP_ORIGIN || 'http://localhost:3006';
const API_BASE = import.meta.env.VITE_APP_ORIGIN || '';

const btnClass =
  'flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-mono text-sm font-bold uppercase tracking-wider text-white/90 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40';

const primaryClass =
  'flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-amber-500/50 bg-gradient-to-r from-amber-600/40 to-orange-600/30 px-4 py-3 font-mono text-sm font-bold uppercase tracking-wider text-amber-50 transition-colors hover:from-amber-600/55 hover:to-orange-600/45 disabled:cursor-not-allowed disabled:opacity-40';

function hasExercises(workoutSet: WorkoutSetTemplate): boolean {
  return workoutSet.workouts?.some((w) => {
    if (w.exerciseBlocks?.length) {
      return w.exerciseBlocks.some((b) => (b.exercises?.length ?? 0) > 0);
    }
    return (w.blocks?.length ?? 0) > 0;
  });
}

export interface UniversalPasteFooterProps {
  workoutSet: WorkoutSetTemplate | null;
}

export default function UniversalPasteFooter({ workoutSet }: UniversalPasteFooterProps) {
  const [openWorkoutError, setOpenWorkoutError] = useState<string | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  if (!workoutSet) return null;

  const hasPayload = Boolean(workoutSet.title?.trim()) || hasExercises(workoutSet);
  const disabled = !hasPayload;

  const handleOpenWorkout = async () => {
    setOpenWorkoutError(null);
    const url = API_BASE ? `${API_BASE}/api/workout-handoff` : '/api/workout-handoff';
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workoutSet }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : res.statusText || 'Handoff failed');
      }
      const handoffId = data.handoffId;
      if (!handoffId) throw new Error('No handoff ID returned');
      window.open(`${APP_BASE}/workout/log-pasted?hid=${encodeURIComponent(handoffId)}`);
    } catch (err) {
      setOpenWorkoutError(err instanceof Error ? err.message : 'Failed to open workout');
    }
  };

  return (
    <footer className="mt-8 space-y-3 border-t border-white/10 pt-6">
      {openWorkoutError && (
        <p className="text-center text-sm text-red-300">{openWorkoutError}</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          className={btnClass}
          disabled={disabled}
          onClick={() => setScheduleModalOpen(true)}
        >
          📅 Schedule
        </button>
        <button
          type="button"
          className={btnClass}
          disabled={disabled}
          onClick={() => {}}
        >
          ✅ Log Past
        </button>
        <button
          type="button"
          className={btnClass}
          disabled={disabled}
          onClick={handleOpenWorkout}
        >
          📋 Open Workout
        </button>
      </div>
      <button
        type="button"
        className={primaryClass}
        disabled={disabled}
        onClick={() => {}}
      >
        ▶ Launch Timer
      </button>
      {scheduleModalOpen && (
        <SchedulePastedWorkoutModal
          workoutSet={workoutSet}
          onClose={() => setScheduleModalOpen(false)}
        />
      )}
    </footer>
  );
}
