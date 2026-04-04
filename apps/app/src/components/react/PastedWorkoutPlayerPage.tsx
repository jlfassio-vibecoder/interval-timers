/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Route shell for /workout/log-pasted. Consumes workout handoff (hid) or saved library (savedId),
 * renders reusable pasted-workout flow, saves to user_workout_logs.
 */

import { useState, useEffect } from 'react';
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
  const [params, setParams] = useState<
    { hid: string | null; savedId: string | null; coachAssignmentId: string | null } | 'pending'
  >('pending');

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setParams({
      hid: search.get('hid'),
      savedId: search.get('savedId'),
      coachAssignmentId: search.get('coachAssignmentId'),
    });
  }, []);

  const [savedWorkout, setSavedWorkout] = useState<{
    workoutSet: import('@/types/ai-workout').WorkoutSetTemplate;
  } | null>(null);
  const [savedError, setSavedError] = useState<string | null>(null);

  const [coachPayload, setCoachPayload] = useState<{
    workoutSet: import('@/types/ai-workout').WorkoutSetTemplate;
    assignmentId: string;
    resourceId: string;
    assignmentType: 'workout' | 'wod';
  } | null>(null);
  const [coachError, setCoachError] = useState<string | null>(null);

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

  useEffect(() => {
    if (params === 'pending' || !params.coachAssignmentId?.trim() || params.savedId) return;
    if (!user?.uid) return;
    let cancelled = false;
    const id = params.coachAssignmentId.trim();
    setCoachError(null);
    setCoachPayload(null);
    fetch(`/api/me/coach-assignments/${encodeURIComponent(id)}/payload`, {
      credentials: 'include',
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof body.error === 'string' ? body.error : 'Could not load assignment'
          );
        }
        if (body.assignmentType !== 'workout' && body.assignmentType !== 'wod') {
          throw new Error('This assignment is not a workout you can log here.');
        }
        const ws = body.workoutSet;
        if (!ws?.workouts?.length) {
          throw new Error('No workout data for this assignment.');
        }
        if (typeof body.assignmentId !== 'string' || typeof body.resourceId !== 'string') {
          throw new Error('Assignment payload is incomplete.');
        }
        return {
          workoutSet: ws as import('@/types/ai-workout').WorkoutSetTemplate,
          assignmentId: body.assignmentId,
          resourceId: body.resourceId,
          assignmentType: body.assignmentType as 'workout' | 'wod',
        };
      })
      .then((data) => {
        if (!cancelled) setCoachPayload(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setCoachError(err instanceof Error ? err.message : 'Could not load assignment.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [params, user?.uid]);

  if (params === 'pending') {
    return <LoadingPlaceholder />;
  }

  const { hid, savedId, coachAssignmentId } = params;

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

  if (coachAssignmentId?.trim()) {
    const cid = coachAssignmentId.trim();
    if (coachError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black/95 px-4 text-center text-white">
          <p className="text-red-300">{coachError}</p>
          <a
            href="/"
            className="rounded-lg border border-white/20 px-4 py-2 font-medium hover:bg-white/10"
          >
            Back home
          </a>
        </div>
      );
    }
    if (!user?.uid) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black/95 px-4 text-center text-white">
          <p className="text-white/70">Sign in to log this workout.</p>
          <a
            href={`/account?returnUrl=${encodeURIComponent(`/workout/log-pasted?coachAssignmentId=${encodeURIComponent(cid)}`)}`}
            className="bg-orange-500 hover:bg-orange-400 rounded-lg px-4 py-2 font-medium text-black"
          >
            Sign in
          </a>
        </div>
      );
    }
    if (coachPayload) {
      return (
        <PastedWorkoutFromHandoff
          initialWorkoutSet={coachPayload.workoutSet}
          coachAssignmentId={coachPayload.assignmentId}
          coachResourceId={coachPayload.resourceId}
          coachAssignmentType={coachPayload.assignmentType}
          returnPath={`/workout/log-pasted?coachAssignmentId=${encodeURIComponent(cid)}`}
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
