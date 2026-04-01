/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Quick log for pasted workout: effort, rating, notes, date → workout_logs.
 * Consumes handoff from Universal Activity Hub Log Past flow.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { normalizeFitnessGoalRanking } from '@/lib/fitness-goal-taxonomy';
import { saveWorkoutLog } from '@/lib/supabase/client/workout-logs';
import type { WorkoutSetTemplate } from '@/types/ai-workout';

function getHandoffId(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('hid');
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function PastedQuickLogPage() {
  const { user } = useAppContext();
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; workoutSet: WorkoutSetTemplate }
    | { status: 'saved' }
  >({ status: 'loading' });
  const [effort, setEffort] = useState(5);
  const [rating, setRating] = useState(3);
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(() => toDateString(new Date()));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const hid = getHandoffId();
    if (!hid) {
      setState({
        status: 'error',
        message: 'Missing handoff ID. Log from the Universal Activity Hub.',
      });
      return;
    }
    fetch(`/api/quick-log-workout-handoff?id=${encodeURIComponent(hid)}`)
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
  }, []);

  const handleSubmit = useCallback(async () => {
    if (state.status !== 'ready' || !user?.uid) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const ranked = normalizeFitnessGoalRanking(user?.fitnessGoalRanking ?? []);
      await saveWorkoutLog({
        userId: user.uid,
        workoutId: undefined,
        workoutName: state.workoutSet.title?.trim() || 'Pasted Workout',
        date,
        effort,
        rating,
        notes: notes.trim(),
        source: 'universal_activity_hub',
        goalSnapshot: ranked.length > 0 ? ranked : null,
      });
      setState({ status: 'saved' });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }, [state, user?.uid, user?.fitnessGoalRanking, date, effort, rating, notes]);

  const returnUrl =
    typeof window !== 'undefined'
      ? `/workout/log-past-summary${window.location.search}`
      : '/workout/log-past-summary';

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
          href={`/account?returnUrl=${encodeURIComponent(returnUrl)}`}
          className="bg-orange-500 hover:bg-orange-400 rounded-lg px-4 py-2 font-medium text-black"
        >
          Sign in
        </a>
      </div>
    );
  }

  if (state.status === 'saved') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-black/95 px-4 text-center text-white">
        <p className="text-lg font-medium text-white/90">Workout logged.</p>
        <a
          href="/training-log"
          className="bg-orange-500 hover:bg-orange-400 rounded-lg px-4 py-2 font-medium text-black"
        >
          View Training Log
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-black/95 px-4 py-12 text-white">
      <h1 className="mb-6 text-xl font-bold">Log Past Workout</h1>
      <p className="mb-6 text-sm text-white/60">{state.workoutSet.title}</p>

      <div className="space-y-6">
        <div>
          <label className="mb-2 block font-mono text-xs uppercase tracking-wider text-white/50">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="focus:border-orange-500 w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block font-mono text-xs uppercase tracking-wider text-white/50">
            Effort (1–10): {effort}
          </label>
          <input
            type="range"
            min={1}
            max={10}
            value={effort}
            onChange={(e) => setEffort(parseInt(e.target.value, 10))}
            className="accent-orange-500 w-full"
          />
        </div>

        <div>
          <label className="mb-2 block font-mono text-xs uppercase tracking-wider text-white/50">
            Rating (1–5): {rating}
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className={`flex-1 rounded-lg border px-3 py-2 font-mono text-sm ${
                  rating >= n
                    ? 'border-orange-500 bg-orange-500/20 text-orange-400'
                    : 'border-white/20 text-white/60'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block font-mono text-xs uppercase tracking-wider text-white/50">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes…"
            rows={3}
            className="focus:border-orange-500 w-full resize-none rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-white/30 focus:outline-none"
          />
        </div>

        {submitError && <p className="text-sm text-red-300">{submitError}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="bg-orange-500 hover:bg-orange-400 w-full rounded-xl py-4 font-bold text-black transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Save to Training Log'}
        </button>
      </div>
    </div>
  );
}
