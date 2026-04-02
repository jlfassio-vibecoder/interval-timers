/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ScheduleBuilder V2: displays and edits program schedule from program_weeks (API).
 * Works with ProgramTemplate.schedule; parent saves via updateProgram API.
 */

import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import type { ProgramSchedule } from '@/types/ai-program';

type ScheduleWorkout = ProgramSchedule['workouts'][number];

function emptyWorkout(weekNumber: number, index: number): ScheduleWorkout {
  return {
    title: `Week ${weekNumber} Workout ${index + 1}`,
    description: '',
    exerciseBlocks: [{ order: 1, name: 'Main', exercises: [] }],
  };
}

export interface ScheduleBuilderProps {
  programId: string;
  schedule: ProgramSchedule[];
  durationWeeks: number;
  onScheduleChange: (schedule: ProgramSchedule[]) => void;
  readOnly?: boolean;
  /** Called when user clicks "Edit in Workout Factory" for a workout */
  onEditWorkout?: (weekNumber: number, workoutIndex: number, workout: ScheduleWorkout) => void;
}

const ScheduleBuilder: React.FC<ScheduleBuilderProps> = ({
  schedule,
  durationWeeks,
  onScheduleChange,
  readOnly = false,
  onEditWorkout,
}) => {
  const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>(() => {
    const o: Record<number, boolean> = {};
    for (let i = 1; i <= durationWeeks; i++) o[i] = true;
    return o;
  });

  const getWeekSchedule = (weekNumber: number): ScheduleWorkout[] => {
    const week = schedule.find((w) => w.weekNumber === weekNumber);
    return week?.workouts ?? [];
  };

  const setWeekWorkouts = (weekNumber: number, workouts: ScheduleWorkout[]) => {
    const next = schedule.filter((w) => w.weekNumber !== weekNumber);
    next.push({ weekNumber, workouts });
    next.sort((a, b) => a.weekNumber - b.weekNumber);
    onScheduleChange(next);
  };

  const handleAddWorkout = (weekNumber: number) => {
    if (readOnly) return;
    const current = getWeekSchedule(weekNumber);
    const newWorkout = emptyWorkout(weekNumber, current.length);
    setWeekWorkouts(weekNumber, [...current, newWorkout]);
  };

  const handleDeleteWorkout = (weekNumber: number, workoutIndex: number) => {
    if (readOnly) return;
    const current = getWeekSchedule(weekNumber);
    const next = current.filter((_, i) => i !== workoutIndex);
    setWeekWorkouts(weekNumber, next);
  };

  const blockCount = (w: ScheduleWorkout) => {
    if (w.exerciseBlocks?.length) return w.exerciseBlocks.length;
    return w.blocks?.length ?? 0;
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Schedule</h2>
      {Array.from({ length: durationWeeks }, (_, i) => i + 1).map((weekNum) => {
        const workouts = getWeekSchedule(weekNum);
        const expanded = expandedWeeks[weekNum] ?? true;
        return (
          <div
            key={weekNum}
            className="overflow-hidden rounded-xl border border-white/10 bg-[#120800]"
          >
            <div
              onClick={() => setExpandedWeeks((prev) => ({ ...prev, [weekNum]: !prev[weekNum] }))}
              className="flex cursor-pointer items-center justify-between bg-white/5 px-6 py-4 transition-colors hover:bg-white/10"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-orange-light font-black text-black">
                  {weekNum}
                </div>
                <h3 className="font-heading text-lg font-bold uppercase tracking-wider text-white">
                  Week {weekNum}
                </h3>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-xs uppercase tracking-widest text-white/40">
                  {workouts.length} session{workouts.length !== 1 ? 's' : ''}
                </span>
                {expanded ? (
                  <ChevronDown className="h-5 w-5 text-white/40" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-white/40" />
                )}
              </div>
            </div>

            {expanded && (
              <div className="border-t border-white/5 p-4">
                <div className="space-y-2">
                  {workouts.map((workout, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between gap-2 rounded-lg border border-white/5 bg-[#1a1a1a] p-3"
                    >
                      <div>
                        <div className="font-medium text-white">{workout.title}</div>
                        {workout.description && (
                          <div className="mt-1 line-clamp-1 text-sm text-white/50">
                            {workout.description}
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <span className="rounded bg-black/20 px-1.5 py-0.5 text-[10px] uppercase text-white/40">
                            {blockCount(workout)} block{blockCount(workout) !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      {!readOnly && (
                        <div className="flex items-center gap-1">
                          {onEditWorkout && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditWorkout(weekNum, idx, workout);
                              }}
                              className="hover:bg-orange-500/20 rounded p-1.5 text-white/40 transition-colors hover:text-orange-light"
                              title="Edit in Workout Factory"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteWorkout(weekNum, idx);
                            }}
                            className="rounded p-1.5 text-white/40 transition-colors hover:bg-red-500/10 hover:text-red-400"
                            title="Remove workout"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleAddWorkout(weekNum)}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/10 py-4 text-white/50 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-white/70"
                    >
                      <Plus className="h-4 w-4" />
                      Add workout
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ScheduleBuilder;
