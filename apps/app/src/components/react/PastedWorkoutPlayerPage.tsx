/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Route shell for /workout/log-pasted. Consumes workout handoff (hid) or saved library (savedId),
 * renders reusable pasted-workout flow, saves to user_workout_logs.
 */

import React, { useState, useEffect } from 'react';
import PastedWorkoutFromHandoff from '@/components/react/pasted-workout/PastedWorkoutFromHandoff';
import PastedWorkoutTextEntry from '@/components/react/pasted-workout/PastedWorkoutTextEntry';
import { getSavedWorkout } from '@/lib/supabase/client/user-saved-workouts';
import { useAppContext } from '@/contexts/AppContext';

/** Loading placeholder — same on SSR and initial client render to avoid hydration mismatch. */
const LoadingPlaceholder = () => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-black/95 text-white">
    <p className="font-mono text-white/70">Loading workout…</p>
  </div>
);

export default function PastedWorkoutPlayerPage() {
  const { user } = useAppContext();
  const [params, setParams] = useState<{ hid: string | null; savedId: string | null } | 'pending'>(
    'pending'
  );

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setParams({
      hid: search.get('hid'),
      savedId: search.get('savedId'),
    });
  }, []);

  const [savedWorkout, setSavedWorkout] = useState<{
    workoutSet: import('@/types/ai-workout').WorkoutSetTemplate;
  } | null>(null);
  const [savedError, setSavedError] = useState<string | null>(null);

  useEffect(() => {
    if (params === 'pending' || !params.savedId || !user?.uid) return;
    let cancelled = false;
    getSavedWorkout(params.savedId)
      .then((row) => {
        if (cancelled) return;
        if (!row) {
          setSavedError('Saved workout not found.');
          return;
        }
        if (row.user_id !== user.uid) {
          setSavedError('You do not have access to this workout.');
          return;
        }
        setSavedWorkout({ workoutSet: row.workout_set });
      })
      .catch((err) => {
        if (!cancelled)
          setSavedError(err instanceof Error ? err.message : 'Failed to load workout.');
      });
    return () => {
      cancelled = true;
    };
  }, [params, user?.uid]);

  if (params === 'pending') {
    return <LoadingPlaceholder />;
  }

  const { hid, savedId } = params;

  if (savedId) {
    if (savedError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black/95 px-4 text-center text-white">
          <p className="text-red-300">{savedError}</p>
          <a
            href="/account/saved-workouts"
            className="rounded-lg border border-white/20 px-4 py-2 font-medium hover:bg-white/10"
          >
            Your Workouts
          </a>
        </div>
      );
    }
    if (!user?.uid) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black/95 px-4 text-center text-white">
          <p className="text-white/70">Sign in to open this workout.</p>
          <a
            href={`/account?returnUrl=${encodeURIComponent(`/workout/log-pasted?savedId=${savedId}`)}`}
            className="bg-orange-500 hover:bg-orange-400 rounded-lg px-4 py-2 font-medium text-black"
          >
            Sign in
          </a>
        </div>
      );
    }
    if (savedWorkout) {
      return (
        <PastedWorkoutFromHandoff
          initialWorkoutSet={savedWorkout.workoutSet}
          returnPath={`/workout/log-pasted?savedId=${encodeURIComponent(savedId)}`}
        />
      );
    }
    return <LoadingPlaceholder />;
  }

  if (!hid) {
    return <PastedWorkoutTextEntry />;
  }

  return <PastedWorkoutFromHandoff hid={hid} />;
}
