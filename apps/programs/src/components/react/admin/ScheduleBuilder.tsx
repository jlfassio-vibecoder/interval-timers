/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import {
  fetchWorkoutsForProgram,
  createWorkout,
  deleteWorkout,
  type Workout,
} from '@/lib/supabase/admin/workouts';
import WeekView from './ScheduleBuilder/WeekView';

interface ScheduleBuilderProps {
  programId: string;
  durationWeeks: number;
}

const ScheduleBuilder: React.FC<ScheduleBuilderProps> = ({ programId, durationWeeks }) => {
  const { user } = useAppContext();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!programId || !user?.uid) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await fetchWorkoutsForProgram(programId);
        if (!cancelled) setWorkouts(list);
      } catch (err) {
        if (!cancelled) console.error('[ScheduleBuilder]', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [programId, user?.uid]);

  const handleAddWorkout = async (week: number, day: number) => {
    if (!user?.uid) return;
    try {
      const w = await createWorkout({
        program_id: programId,
        trainer_id: user.uid,
        title: `Week ${week} Day ${day + 1}`,
        scheduled_week: week,
        scheduled_day: day,
      });
      setWorkouts((prev) => [...prev, w]);
    } catch (err) {
      console.error('[ScheduleBuilder] add workout', err);
    }
  };

  const handleEditWorkout = (workout: Workout) => {
    window.location.href = `/admin/workouts/${workout.id}`;
  };

  const handleDeleteWorkout = async (id: string) => {
    try {
      await deleteWorkout(id);
      setWorkouts((prev) => prev.filter((w) => w.id !== id));
    } catch (err) {
      console.error('[ScheduleBuilder] delete workout', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-white/60">Loading schedule...</div>
    );
  }

  return (
    <div className="space-y-4">
      {Array.from({ length: durationWeeks }, (_, i) => i + 1).map((weekNum) => (
        <WeekView
          key={weekNum}
          weekNumber={weekNum}
          workouts={workouts.filter(
            (w) => w.scheduled_week === weekNum || w.scheduled_week == null
          )}
          onAddWorkout={handleAddWorkout}
          onEditWorkout={handleEditWorkout}
          onDeleteWorkout={handleDeleteWorkout}
        />
      ))}
    </div>
  );
};

export default ScheduleBuilder;
