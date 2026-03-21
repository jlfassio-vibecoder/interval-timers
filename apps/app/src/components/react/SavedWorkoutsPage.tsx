/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lists saved workouts with Open (start session) and Schedule actions.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { listSavedWorkouts } from '@/lib/supabase/client/user-saved-workouts';
import type { UserSavedWorkout } from '@/lib/supabase/client/user-saved-workouts';
import ScheduleSavedWorkoutModal from './ScheduleSavedWorkoutModal';

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 24 * 60 * 60 * 1000) return 'Today';
  if (diff < 2 * 24 * 60 * 60 * 1000) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SavedWorkoutsPage() {
  const { user } = useAppContext();
  const [workouts, setWorkouts] = useState<UserSavedWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleTarget, setScheduleTarget] = useState<UserSavedWorkout | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setWorkouts([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listSavedWorkouts(user.uid)
      .then((list) => {
        if (!cancelled) setWorkouts(list);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const handleOpen = useCallback((w: UserSavedWorkout) => {
    window.location.href = `/workout/log-pasted?savedId=${encodeURIComponent(w.id)}`;
  }, []);

  const handleSchedule = useCallback((w: UserSavedWorkout) => {
    setScheduleTarget(w);
  }, []);

  const handleEdit = useCallback((w: UserSavedWorkout) => {
    window.location.href = `/workout/save-pasted?savedId=${encodeURIComponent(w.id)}`;
  }, []);

  if (!user?.uid) {
    return (
      <main className="relative z-10 min-h-screen px-4 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-4 text-white/70">Sign in to view your saved workouts.</p>
          <a
            href={`/account?returnUrl=${encodeURIComponent('/account/saved-workouts')}`}
            className="inline-block rounded-lg bg-orange-500 px-4 py-2 font-medium text-black hover:bg-orange-400"
          >
            Sign in
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="relative z-10 min-h-screen px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <a
            href="/account"
            className="text-sm text-white/70 transition hover:text-white"
          >
            ← Account
          </a>
        </div>
        <h1 className="mb-6 font-heading text-3xl font-bold text-white">Your Workouts</h1>

        {loading ? (
          <p className="font-mono text-white/70">Loading…</p>
        ) : workouts.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
            <p className="text-white/70">No saved workouts yet.</p>
            <p className="mt-2 text-sm text-white/50">
              Paste a workout in the Universal Activity Hub and use &quot;Save Workout&quot; to add it here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {workouts.map((w) => (
              <div
                key={w.id}
                className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <h3 className="font-heading font-bold text-white">{w.title}</h3>
                  <p className="text-sm text-white/50">Updated {formatDate(w.updated_at)}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpen(w)}
                    className="rounded-xl border-2 border-orange-500 bg-orange-600 px-4 py-2 font-bold text-white transition hover:bg-orange-500"
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSchedule(w)}
                    className="rounded-xl border border-white/20 px-4 py-2 font-medium text-white transition hover:bg-white/10"
                  >
                    Schedule
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEdit(w)}
                    className="rounded-xl border border-white/20 px-4 py-2 font-medium text-white transition hover:bg-white/10"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {scheduleTarget && (
        <ScheduleSavedWorkoutModal
          savedWorkout={scheduleTarget}
          onClose={() => setScheduleTarget(null)}
        />
      )}
    </main>
  );
}
