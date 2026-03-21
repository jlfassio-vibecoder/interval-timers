/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Reusable pasted workout session: renders WorkoutPlayer for a WorkoutSetTemplate.
 * Used by PastedWorkoutFromHandoff; saves to user_workout_logs with universal_activity_hub.
 */

import React, { useMemo } from 'react';
import WorkoutPlayer from '@/components/react/tracking/WorkoutPlayer';
import type { WorkoutSetTemplate } from '@/types/ai-workout';

const ADHOC_PROGRAM_ID = 'universal_activity_hub';
const ADHOC_WEEK_ID = 'adhoc';

export interface PastedWorkoutSessionProps {
  workoutSet: WorkoutSetTemplate;
  onClose: () => void;
  onComplete: () => void;
}

export default function PastedWorkoutSession({
  workoutSet,
  onClose,
  onComplete,
}: PastedWorkoutSessionProps) {
  const workout = workoutSet.workouts[0]!;
  const workoutId = useMemo(() => crypto.randomUUID().slice(0, 8), []);

  return (
    <WorkoutPlayer
      workout={workout}
      programId={ADHOC_PROGRAM_ID}
      weekId={ADHOC_WEEK_ID}
      workoutId={workoutId}
      workoutDisplayName={workoutSet.title}
      onClose={onClose}
      onComplete={onComplete}
    />
  );
}
