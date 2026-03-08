/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Today's Workout Card for Zone 3: workout, rest day, or no program.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Play, Check } from 'lucide-react';
import { getTodaysWorkoutOrRest } from '@/lib/supabase/client/schedule-resolver';
import { getTodaysWorkoutLog } from '@/lib/supabase/client/progress-analytics';
import { getExercisesFromWorkout } from '@/lib/program-schedule-utils';
import WorkoutPlayer from '@/components/react/tracking/WorkoutPlayer';

const REST_DAY_TIPS = [
  'Focus on mobility and stretching today.',
  'Stay hydrated and prioritize sleep.',
  'Light walk or active recovery if you feel up to it.',
  "Foam rolling and mobility work support tomorrow's session.",
  'Rest is when adaptation happens—embrace it.',
];

function getRestTip(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return REST_DAY_TIPS[dayOfYear % REST_DAY_TIPS.length]!;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

export interface TodayWorkoutCardProps {
  userId: string;
  activeProgramId: string | null;
  isPaid: boolean;
  /** When false, hide upgrade CTA (e.g. user has only trainer_assigned/cohort programs). */
  showUpgradePrompts: boolean;
  onOpenConversionModal: () => void;
  onWorkoutComplete: () => void;
}

type ScheduleState =
  | { status: 'loading' }
  | { status: 'no_program' }
  | { status: 'rest'; tip: string }
  | {
      status: 'workout';
      workout: import('@/types/ai-program').ProgramSchedule['workouts'][number];
      weekNumber: number;
      workoutIndex: number;
      programId: string;
    };

const TodayWorkoutCard: React.FC<TodayWorkoutCardProps> = ({
  userId,
  activeProgramId,
  isPaid,
  showUpgradePrompts,
  onOpenConversionModal,
  onWorkoutComplete,
}) => {
  const [schedule, setSchedule] = useState<ScheduleState>({ status: 'loading' });
  const [todaysLog, setTodaysLog] = useState<Awaited<ReturnType<typeof getTodaysWorkoutLog>>>(null);
  const [workoutPlayer, setWorkoutPlayer] = useState<{
    workout: import('@/types/ai-program').ProgramSchedule['workouts'][number];
    weekNumber: number;
    workoutIndex: number;
    programId: string;
  } | null>(null);

  const load = useCallback(async () => {
    const [scheduleResult, logResult] = await Promise.all([
      activeProgramId ? getTodaysWorkoutOrRest(userId, activeProgramId) : null,
      getTodaysWorkoutLog(userId),
    ]);
    setTodaysLog(logResult);

    if (!activeProgramId) {
      setSchedule({ status: 'no_program' });
      return;
    }
    if (!scheduleResult) {
      setSchedule({ status: 'no_program' });
      return;
    }
    if (scheduleResult.type === 'rest') {
      setSchedule({ status: 'rest', tip: getRestTip() });
      return;
    }
    setSchedule({
      status: 'workout',
      workout: scheduleResult.workout,
      weekNumber: scheduleResult.weekNumber,
      workoutIndex: scheduleResult.workoutIndex,
      programId: activeProgramId,
    });
  }, [userId, activeProgramId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStartWorkout = () => {
    if (schedule.status !== 'workout') return;
    setWorkoutPlayer({
      workout: schedule.workout,
      weekNumber: schedule.weekNumber,
      workoutIndex: schedule.workoutIndex,
      programId: schedule.programId,
    });
  };

  const handlePlayerComplete = () => {
    setWorkoutPlayer(null);
    onWorkoutComplete();
    load();
  };

  if (schedule.status === 'loading') {
    return (
      <div className="rounded-3xl border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
        <p className="font-mono text-[10px] uppercase text-white/40">Loading today…</p>
      </div>
    );
  }

  if (schedule.status === 'no_program') {
    return (
      <div className="rounded-3xl border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
        <h4 className="mb-2 font-heading text-lg font-black uppercase tracking-tighter text-white">
          No program synced
        </h4>
        <p className="mb-4 text-sm text-white/60">
          Select a program in the sidebar to see today&apos;s workout.
        </p>
        <a
          href="#program-sidebar"
          className="border-orange-light/30 bg-orange-light/10 inline-block rounded-full border px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest text-orange-light transition-colors hover:bg-orange-light hover:text-black"
        >
          Go to Program
        </a>
      </div>
    );
  }

  if (schedule.status === 'rest') {
    return (
      <div className="rounded-3xl border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
        <span className="mb-2 inline-block rounded bg-white/10 px-2 py-0.5 font-mono text-[10px] uppercase text-white/60">
          Rest Day
        </span>
        <h4 className="mb-2 font-heading text-lg font-black uppercase tracking-tighter text-white">
          Rest Day
        </h4>
        <p className="text-sm text-white/70">{schedule.tip}</p>
      </div>
    );
  }

  const isCompleted = !!todaysLog;
  const exercises = getExercisesFromWorkout(schedule.workout);
  const preview = exercises.slice(0, 3).map((e) => e.exerciseName);

  return (
    <>
      <div className="rounded-3xl border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
        <div className="mb-2 flex items-center gap-2">
          <span className="bg-orange-light/20 rounded px-2 py-0.5 font-mono text-[10px] uppercase text-orange-light">
            Today
          </span>
          {isCompleted && (
            <span className="rounded bg-green-500/20 px-2 py-0.5 font-mono text-[10px] uppercase text-green-400">
              Completed
            </span>
          )}
        </div>
        <h4 className="mb-2 font-heading text-lg font-black uppercase tracking-tighter text-white">
          {schedule.workout.title || 'Workout'}
        </h4>
        <p className="mb-3 font-mono text-[10px] text-white/50">
          ~45 min · Week {schedule.weekNumber}
        </p>
        {preview.length > 0 && (
          <ul className="mb-4 list-inside list-disc text-sm text-white/70">
            {preview.map((name, i) => (
              <li key={i}>{name}</li>
            ))}
          </ul>
        )}
        {isCompleted ? (
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Check className="h-4 w-4 text-green-400" />
            <span>Logged {formatDuration(todaysLog.durationSeconds)}</span>
          </div>
        ) : isPaid ? (
          <button
            type="button"
            onClick={handleStartWorkout}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-orange-light py-3 font-mono text-xs font-bold uppercase tracking-widest text-black transition-opacity hover:opacity-90"
          >
            <Play className="h-4 w-4" />
            Start Workout
          </button>
        ) : showUpgradePrompts ? (
          <button
            type="button"
            onClick={onOpenConversionModal}
            className="border-orange-light/30 bg-orange-light/10 flex w-full items-center justify-center gap-2 rounded-full border py-3 font-mono text-xs font-bold uppercase tracking-widest text-orange-light transition-colors hover:bg-orange-light hover:text-black"
          >
            Upgrade to start workout
          </button>
        ) : (
          <p className="text-center text-sm text-white/50">
            Your program is assigned by your trainer.
          </p>
        )}
      </div>

      {workoutPlayer && (
        <WorkoutPlayer
          workout={workoutPlayer.workout}
          programId={workoutPlayer.programId}
          weekId={`week-${workoutPlayer.weekNumber}`}
          workoutId={String(workoutPlayer.workoutIndex)}
          onClose={() => setWorkoutPlayer(null)}
          onComplete={handlePlayerComplete}
        />
      )}
    </>
  );
};

export default TodayWorkoutCard;
