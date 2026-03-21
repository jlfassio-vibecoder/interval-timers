/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Loads workout from handoff API, validates exercises, gates on auth.
 * Shows parsed-content landing first; "Start Workout" opens PastedWorkoutSession.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { getExercisesFromWorkout } from '@/lib/program-schedule-utils';
import PastedWorkoutSession from './PastedWorkoutSession';
import WorkoutSetPreviewLanding from './WorkoutSetPreviewLanding';
import type { WorkoutSetTemplate } from '@/types/ai-workout';

export interface PastedWorkoutFromHandoffProps {
  hid?: string;
  /** Pre-loaded workout (e.g. from saved library); when set, skips handoff fetch. */
  initialWorkoutSet?: WorkoutSetTemplate;
  /** Base path for returnUrl (e.g. /workout/log-pasted). Default uses current path + search. */
  returnPath?: string;
}

export default function PastedWorkoutFromHandoff({
  hid,
  initialWorkoutSet,
  returnPath,
}: PastedWorkoutFromHandoffProps) {
  const { user } = useAppContext();
  const [viewMode, setViewMode] = useState<'preview' | 'session'>('preview');
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; workoutSet: WorkoutSetTemplate }
  >(() => {
    if (!initialWorkoutSet) return { status: 'loading' };
    const workout = initialWorkoutSet.workouts[0];
    const exercises = workout ? getExercisesFromWorkout(workout) : [];
    if (!exercises.length) return { status: 'error', message: 'No exercises found in workout.' };
    return { status: 'ready', workoutSet: initialWorkoutSet };
  });

  useEffect(() => {
    if (initialWorkoutSet || !hid) return;
    let cancelled = false;
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
    return () => {
      cancelled = true;
    };
  }, [hid, initialWorkoutSet]);

  const handleComplete = useCallback(() => {
    window.location.href = '/training-log';
  }, []);

  const handleClose = useCallback(() => {
    window.location.href = '/training-log';
  }, []);

  const effectiveReturnPath =
    returnPath ?? (typeof window !== 'undefined' ? `/workout/log-pasted${window.location.search}` : '/workout/log-pasted');

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
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black/95 px-4 text-center text-white">
        <p className="text-white/70">Sign in to log this workout.</p>
        <a
          href={`/account?returnUrl=${encodeURIComponent(effectiveReturnPath)}`}
          className="rounded-lg bg-orange-500 px-4 py-2 font-medium text-black hover:bg-orange-400"
        >
          Sign in
        </a>
      </div>
    );
  }

  if (state.status === 'ready' && viewMode === 'preview') {
    return (
      <WorkoutSetPreviewLanding
        workoutSet={state.workoutSet}
        onStartWorkout={() => setViewMode('session')}
        returnPath={effectiveReturnPath}
      />
    );
  }

  return (
    <PastedWorkoutSession
      workoutSet={state.workoutSet}
      onClose={handleClose}
      onComplete={handleComplete}
    />
  );
}
