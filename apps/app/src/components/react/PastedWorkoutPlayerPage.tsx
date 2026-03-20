/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Consumes workout handoff from Universal Activity Hub, renders WorkoutPlayer,
 * saves to user_workout_logs with workout_display_name, redirects to Training Log on complete.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import WorkoutPlayer from '@/components/react/tracking/WorkoutPlayer';
import { getExercisesFromWorkout } from '@/lib/program-schedule-utils';
import type { WorkoutSetTemplate } from '@/types/ai-workout';

const ADHOC_PROGRAM_ID = 'universal_activity_hub';
const ADHOC_WEEK_ID = 'adhoc';

function getHandoffId(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('hid');
}

export default function PastedWorkoutPlayerPage() {
  const { user } = useAppContext();
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; workoutSet: WorkoutSetTemplate }
  >({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const hid = getHandoffId();
    if (!hid) {
      setState({ status: 'error', message: 'Missing handoff ID. Open the workout from the Universal Activity Hub.' });
      return;
    }
    fetch(`/api/workout-handoff?id=${encodeURIComponent(hid)}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error('Handoff expired or not found.');
          throw new Error(res.statusText || 'Failed to load workout.');
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const ws = data.workoutSet;
        if (!ws?.workouts?.length) {
          setState({ status: 'error', message: 'Invalid workout data.' });
          return;
        }
        const workout = ws.workouts[0];
        const exercises = getExercisesFromWorkout(workout);
        if (!exercises.length) {
          setState({ status: 'error', message: 'No exercises found in workout.' });
          return;
        }
        setState({ status: 'ready', workoutSet: ws });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Failed to load workout.',
          });
        }
      });
    return () => { cancelled = true; };
  }, []);

  const handleComplete = useCallback(() => {
    window.location.href = '/training-log';
  }, []);

  const handleClose = useCallback(() => {
    window.location.href = '/training-log';
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black/95 text-white">
        <p className="font-mono text-white/70">Loading workout…</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black/95 px-4 text-center text-white">
        <p className="text-red-300">{state.message}</p>
        <a
          href="/training-log"
          className="rounded-lg border border-white/20 px-4 py-2 font-medium hover:bg-white/10"
        >
          Go to Training Log
        </a>
      </div>
    );
  }

  if (state.status === 'ready' && !user?.uid) {
    const returnUrl = `/workout/log-pasted?${window.location.search}`;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black/95 px-4 text-center text-white">
        <p className="text-white/70">Sign in to log this workout.</p>
        <a
          href={`/account?returnUrl=${encodeURIComponent(returnUrl)}`}
          className="rounded-lg bg-orange-500 px-4 py-2 font-medium text-black hover:bg-orange-400"
        >
          Sign in
        </a>
      </div>
    );
  }

  const workout = state.workoutSet.workouts[0]!;
  const workoutId = crypto.randomUUID().slice(0, 8);

  return (
    <WorkoutPlayer
      workout={workout}
      programId={ADHOC_PROGRAM_ID}
      weekId={ADHOC_WEEK_ID}
      workoutId={workoutId}
      workoutDisplayName={state.workoutSet.title}
      onClose={handleClose}
      onComplete={handleComplete}
    />
  );
}
