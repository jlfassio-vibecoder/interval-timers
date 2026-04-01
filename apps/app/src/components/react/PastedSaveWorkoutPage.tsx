/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Route shell for /workout/save-pasted. Consumes workout handoff (hid) or savedId from Your Workouts,
 * renders library editor for saving to user_saved_workouts.
 */

import { useState, useEffect } from 'react';
import PastedLibraryWorkoutEditor from '@/components/react/pasted-workout/PastedLibraryWorkoutEditor';
import { getSavedWorkout } from '@/lib/supabase/client/user-saved-workouts';
import { useAppContext } from '@/contexts/AppContext';
import type { WorkoutSetTemplate } from '@/types/ai-workout';

const LoadingPlaceholder = () => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-black/95 text-white">
    <p className="font-mono text-white/70">Loading workout…</p>
  </div>
);

export default function PastedSaveWorkoutPage() {
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
    workoutSet: WorkoutSetTemplate;
    id: string;
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
        setSavedWorkout({ workoutSet: row.workout_set, id: row.id });
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
          <p className="text-white/70">Sign in to edit this workout.</p>
          <a
            href={`/account?returnUrl=${encodeURIComponent(`/workout/save-pasted?savedId=${savedId}`)}`}
            className="bg-orange-500 hover:bg-orange-400 rounded-lg px-4 py-2 font-medium text-black"
          >
            Sign in
          </a>
        </div>
      );
    }
    if (savedWorkout) {
      return (
        <PastedLibraryWorkoutEditor
          workoutSet={savedWorkout.workoutSet}
          savedId={savedWorkout.id}
          returnPath={`/workout/save-pasted?savedId=${encodeURIComponent(savedId)}`}
        />
      );
    }
    return <LoadingPlaceholder />;
  }

  if (!hid) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black/95 px-4 text-center text-white">
        <p className="text-red-300">
          Missing handoff ID. Save the workout from the Universal Activity Hub.
        </p>
        <a
          href="/training-log"
          className="rounded-lg border border-white/20 px-4 py-2 font-medium hover:bg-white/10"
        >
          Go to Training Log
        </a>
      </div>
    );
  }

  return <PastedSaveWorkoutGate hid={hid} />;
}

function PastedSaveWorkoutGate({ hid }: { hid: string }) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; workoutSet: WorkoutSetTemplate }
  >({ status: 'loading' });

  useEffect(() => {
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
  }, [hid]);

  if (state.status === 'loading') {
    return <LoadingPlaceholder />;
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

  return (
    <PastedLibraryWorkoutEditor
      workoutSet={state.workoutSet}
      returnPath={`/workout/save-pasted?hid=${encodeURIComponent(hid)}`}
    />
  );
}
