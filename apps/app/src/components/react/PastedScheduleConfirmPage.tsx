/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Consumes schedule handoff from Universal Activity Hub, saves to scheduled_workouts,
 * redirects to Training Log.
 */

import { useState, useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { saveScheduledWorkout } from '@/lib/supabase/client/scheduled-workouts';
import type { WorkoutSetTemplate } from '@/types/ai-workout';

function getHandoffId(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('hid');
}

export default function PastedScheduleConfirmPage() {
  const { user } = useAppContext();
  const [handoff, setHandoff] = useState<{
    workoutSet: WorkoutSetTemplate;
    scheduledAt: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const hid = getHandoffId();
    if (!hid) {
      setError('Missing handoff ID. Schedule the workout from the Universal Activity Hub.');
      return;
    }
    fetch(`/api/schedule-workout-handoff?id=${encodeURIComponent(hid)}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error('Handoff expired or not found.');
          throw new Error(res.statusText || 'Failed to load schedule.');
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const { workoutSet, scheduledAt } = data;
        if (!workoutSet?.workouts?.length || !scheduledAt) {
          setError('Invalid schedule data.');
          return;
        }
        setHandoff({ workoutSet, scheduledAt });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load schedule.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Omit `saving` from deps: after a failed save, setSaving(false) would re-run this effect and
  // retry indefinitely. We only save when handoff + user become available.
  useEffect(() => {
    if (!handoff || !user?.uid) return;
    let cancelled = false;
    setSaving(true);
    saveScheduledWorkout(user.uid, {
      sourceApp: 'universal_activity_hub',
      scheduledAt: handoff.scheduledAt,
      workoutTitle: handoff.workoutSet.title?.trim() || null,
      config: { workoutSet: handoff.workoutSet },
    })
      .then(() => {
        if (!cancelled) window.location.href = '/training-log';
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to save.');
          setSaving(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [handoff, user?.uid]);

  if (!handoff && !error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black/95 text-white">
        <p className="font-mono text-white/70">Loading…</p>
      </div>
    );
  }

  if (error) {
    const returnUrl = `/workout/schedule-pasted${window.location.search}`;
    const isSignInRequired = handoff && !user?.uid;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black/95 px-4 text-center text-white">
        <p className="text-red-300">
          {isSignInRequired ? 'Sign in to save this scheduled workout.' : error}
        </p>
        {isSignInRequired ? (
          <a
            href={`/account?returnUrl=${encodeURIComponent(returnUrl)}`}
            className="bg-orange-500 hover:bg-orange-400 rounded-lg px-4 py-2 font-medium text-black"
          >
            Sign in
          </a>
        ) : (
          <a
            href="/training-log"
            className="rounded-lg border border-white/20 px-4 py-2 font-medium hover:bg-white/10"
          >
            Go to Training Log
          </a>
        )}
      </div>
    );
  }

  if (handoff && !user?.uid) {
    const returnUrl = `/workout/schedule-pasted${window.location.search}`;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black/95 px-4 text-center text-white">
        <p className="text-white/70">Sign in to save this scheduled workout.</p>
        <a
          href={`/account?returnUrl=${encodeURIComponent(returnUrl)}`}
          className="bg-orange-500 hover:bg-orange-400 rounded-lg px-4 py-2 font-medium text-black"
        >
          Sign in
        </a>
      </div>
    );
  }

  if (saving) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black/95 text-white">
        <p className="font-mono text-white/70">Saving scheduled workout…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black/95 text-white">
      <p className="font-mono text-white/70">Redirecting…</p>
    </div>
  );
}
