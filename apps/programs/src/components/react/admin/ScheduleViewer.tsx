/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Read-only schedule viewer: weeks → workouts → exercises.
 * Optional "Promote to Canonical" per workout.
 */

import React from 'react';
import type { Exercise, ProgramSchedule } from '@/types/ai-program';
import type { ProgramWorkout } from '@/lib/program-schedule-utils';
import ExerciseBlockCard from './ExerciseBlockCard';

export interface ScheduleViewerProps {
  schedule: ProgramSchedule[];
  getExercisesFromWorkout: (w: ProgramWorkout) => Exercise[];
  onPromoteWorkout?: (weekIndex: number, workoutIndex: number) => void;
  /** When promoting, pass { weekIndex, workoutIndex } to disable that button */
  promoting?: { weekIndex: number; workoutIndex: number } | null;
  emptyState?: React.ReactNode;
}

const ScheduleViewer: React.FC<ScheduleViewerProps> = ({
  schedule,
  getExercisesFromWorkout,
  onPromoteWorkout,
  promoting,
  emptyState,
}) => {
  const hasSchedule = schedule != null && schedule.length > 0;
  const hasWorkouts = hasSchedule && schedule.some((w) => (w.workouts?.length ?? 0) > 0);

  if (!hasSchedule || !hasWorkouts) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
        <h2 className="mb-6 font-heading text-xl font-bold">Program Schedule</h2>
        {emptyState ?? (
          <div className="rounded-lg border-2 border-dashed border-white/20 bg-black/10 p-24 text-center backdrop-blur-sm">
            <p className="text-xl font-medium text-white/60">No schedule yet</p>
            <p className="mt-2 text-sm text-white/40">
              Use "Edit schedule with AI" to create a program schedule
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
      <h2 className="mb-6 font-heading text-xl font-bold">Program Schedule</h2>

      <div className="space-y-6">
        {schedule.map((week, weekIndex) => (
          <div
            key={weekIndex}
            className="rounded-lg border border-white/10 bg-black/10 p-4"
            data-week
          >
            <h3 className="mb-4 font-heading text-lg font-semibold">Week {week.weekNumber}</h3>
            <div className="space-y-4">
              {week.workouts.map((workout, workoutIndex) => (
                <div
                  key={workoutIndex}
                  className="rounded-lg border border-white/5 bg-black/20 p-4"
                  data-workout
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-white">{workout.title}</h4>
                      {workout.description != null && workout.description.trim() !== '' && (
                        <p className="mt-1 text-sm text-white/60">{workout.description}</p>
                      )}
                    </div>
                    {onPromoteWorkout != null && (
                      <button
                        type="button"
                        onClick={() => onPromoteWorkout(weekIndex, workoutIndex)}
                        disabled={
                          promoting != null &&
                          promoting.weekIndex === weekIndex &&
                          promoting.workoutIndex === workoutIndex
                        }
                        className="border-orange-light/40 bg-orange-light/10 hover:bg-orange-light/20 rounded border px-2 py-1 text-xs text-orange-light transition-colors disabled:opacity-50"
                      >
                        {promoting?.weekIndex === weekIndex &&
                        promoting?.workoutIndex === workoutIndex
                          ? 'Saving...'
                          : 'Save as Standalone Workout'}
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {getExercisesFromWorkout(workout).map((exercise, exIndex) => (
                      <ExerciseBlockCard key={exercise.id ?? exIndex} block={exercise} readOnly />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScheduleViewer;
