/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Schedule a saved workout: pick date/time, save to scheduled_workouts.
 */

import { useState } from 'react';
import CreateFlowSchedulePicker from '@interval-timers/schedule-picker';
import { useAppContext } from '@/contexts/AppContext';
import { saveScheduledWorkout } from '@/lib/supabase/client/scheduled-workouts';
import type { UserSavedWorkout } from '@/lib/supabase/client/user-saved-workouts';

export interface ScheduleSavedWorkoutModalProps {
  savedWorkout: UserSavedWorkout;
  onClose: () => void;
}

export default function ScheduleSavedWorkoutModal({
  savedWorkout,
  onClose,
}: ScheduleSavedWorkoutModalProps) {
  const { user } = useAppContext();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!value.trim() || !user?.uid) return;
    setError(null);
    setSubmitting(true);
    try {
      await saveScheduledWorkout(user.uid, {
        sourceApp: 'saved_workout',
        scheduledAt: new Date(value).toISOString(),
        workoutTitle: savedWorkout.title,
        config: { workoutSet: savedWorkout.workout_set },
      });
      onClose();
      window.location.href = '/training-log';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/20 bg-black/90 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold text-white">Schedule Workout</h2>
        <CreateFlowSchedulePicker
          value={value}
          onChange={setValue}
          minDate={new Date()}
          maxWeeksAhead={52}
          description="Pick when to schedule this workout. It will be added to your calendar."
        />
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/20 px-4 py-3 font-bold text-white/80 transition-colors hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!value.trim() || submitting}
            className="border-orange-500 bg-orange-600 hover:bg-orange-500 flex-1 rounded-xl border-2 px-4 py-3 font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Scheduling…' : 'Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}
