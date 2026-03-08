/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Plus, ChevronDown, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Workout } from '@/lib/supabase/admin/workouts';

interface WeekViewProps {
  weekNumber: number;
  workouts: Workout[];
  onAddWorkout: (week: number, day: number) => void;
  onEditWorkout: (workout: Workout) => void;
  onDeleteWorkout: (id: string) => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const WeekView: React.FC<WeekViewProps> = ({
  weekNumber,
  workouts,
  onAddWorkout,
  onEditWorkout,
  onDeleteWorkout,
}) => {
  const [expanded, setExpanded] = useState(true);

  // Helper: Filter workouts for a specific day index (0-6)
  const getWorkoutsForDay = (dayIndex: number) => {
    return workouts.filter((w: Workout) => w.scheduled_day === dayIndex);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#120800]">
      {/* Week Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex cursor-pointer items-center justify-between bg-white/5 px-6 py-4 transition-colors hover:bg-white/10"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-orange-light font-black text-black">
            {weekNumber}
          </div>
          <h3 className="font-heading text-lg font-bold uppercase tracking-wider text-white">
            Week {weekNumber}
          </h3>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs uppercase tracking-widest text-white/40">
            {workouts.length} Sessions
          </span>
          <ChevronDown
            className={`h-5 w-5 text-white/40 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {/* Week Grid */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/5"
          >
            <div className="grid grid-cols-1 divide-y divide-white/10 md:grid-cols-7 md:divide-x md:divide-y-0">
              {DAYS.map((dayName, dayIndex) => {
                const dayWorkouts = getWorkoutsForDay(dayIndex);
                return (
                  <div
                    key={dayIndex}
                    className="group relative flex min-h-[160px] flex-col p-3 transition-colors hover:bg-white/[0.02]"
                  >
                    {/* Day Header */}
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-white/30 transition-colors group-hover:text-white/60">
                        {dayName}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddWorkout(weekNumber, dayIndex);
                        }}
                        className="rounded p-1 text-white/20 opacity-0 transition-all hover:bg-orange-light hover:text-black group-hover:opacity-100"
                        title="Add Workout"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Workouts List */}
                    <div className="flex-1 space-y-2">
                      {dayWorkouts.map((workout) => (
                        <div
                          key={workout.id}
                          onClick={() => onEditWorkout(workout)}
                          className="group/card hover:border-orange-light/50 relative cursor-pointer rounded-lg border border-white/5 bg-[#1a1a1a] p-3 shadow-sm transition-all hover:bg-[#2a2a2a] hover:shadow-md"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="line-clamp-2 text-xs font-bold text-white group-hover/card:text-orange-light">
                              {workout.title}
                            </h4>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteWorkout(workout.id);
                              }}
                              className="text-white/20 opacity-0 transition-opacity hover:text-red-400 group-hover/card:opacity-100"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="rounded bg-black/20 px-1.5 py-0.5 text-[10px] uppercase text-white/40">
                              {workout.blocks?.length || 0} Blocks
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Empty State / Drop Target */}
                      {dayWorkouts.length === 0 && (
                        <div
                          onClick={() => onAddWorkout(weekNumber, dayIndex)}
                          className="group/empty flex h-full min-h-[60px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-white/5 transition-colors hover:border-white/10 hover:bg-white/5"
                        >
                          <Plus className="h-4 w-4 text-white/10 group-hover/empty:text-white/30" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WeekView;
