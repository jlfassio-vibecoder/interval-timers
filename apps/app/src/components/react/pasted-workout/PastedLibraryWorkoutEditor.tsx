/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Library editor for pasted workouts: read-only view, Edit toggle, Save to user_saved_workouts.
 */

import { useState, useCallback } from 'react';
import { X, Pencil, Check } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { getExercisesFromWorkout, normalizeWorkoutSet } from '@/lib/program-schedule-utils';
import { insertSavedWorkout, updateSavedWorkout } from '@/lib/supabase/client/user-saved-workouts';
import type { WorkoutSetTemplate } from '@/types/ai-workout';
import type { Exercise } from '@/types/ai-program';

export interface PastedLibraryWorkoutEditorProps {
  workoutSet: WorkoutSetTemplate;
  returnPath: string;
  /** When editing an existing saved workout, pass its id so Save performs update. */
  savedId?: string;
}

export default function PastedLibraryWorkoutEditor({
  workoutSet: initialWorkoutSet,
  returnPath,
  savedId,
}: PastedLibraryWorkoutEditorProps) {
  const { user } = useAppContext();
  const normalized = normalizeWorkoutSet(initialWorkoutSet);
  const workout = normalized.workouts[0];
  const exercises = workout ? getExercisesFromWorkout(workout) : [];

  const [isEditing, setIsEditing] = useState(Boolean(savedId));
  const [title, setTitle] = useState(normalized.title);
  const [exerciseEdits, setExerciseEdits] = useState<
    Array<{
      exerciseName: string;
      sets: number;
      reps: string;
      restSeconds?: number;
      coachNotes?: string;
    }>
  >(() =>
    exercises.map((e) => ({
      exerciseName: e.exerciseName,
      // WorkoutPlayer uses Array.from({ length: block.sets }) — clamp to 1 to avoid empty sets array
      sets: Math.max(1, e.sets ?? 1),
      reps: typeof e.reps === 'number' ? String(e.reps) : (e.reps ?? ''),
      restSeconds: e.restSeconds,
      coachNotes: e.coachNotes ?? '',
    }))
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const updateExercise = useCallback((index: number, patch: Partial<(typeof exerciseEdits)[0]>) => {
    setExerciseEdits((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }, []);

  const handleSave = useCallback(async () => {
    if (!user?.uid) {
      window.location.href = `/account?returnUrl=${encodeURIComponent(returnPath)}`;
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const built: WorkoutSetTemplate = {
        ...normalized,
        title: title.trim() || normalized.title,
        workouts: [
          {
            ...workout!,
            title: title.trim() || normalized.title,
            exerciseBlocks: [
              {
                order: 1,
                name: 'Main',
                exercises: exerciseEdits.map((e, i) => ({
                  order: i + 1,
                  exerciseName: e.exerciseName.trim() || 'Exercise',
                  sets: e.sets,
                  reps: e.reps,
                  restSeconds: e.restSeconds,
                  coachNotes: e.coachNotes?.trim() || undefined,
                })) as Exercise[],
              },
            ],
          },
        ],
      };
      if (savedId) {
        await updateSavedWorkout(savedId, { title: built.title, workoutSet: built });
      } else {
        await insertSavedWorkout(user.uid, { title: built.title, workoutSet: built });
      }
      window.location.href = '/account/saved-workouts';
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save workout.';
      setSaveError(msg);
      if (import.meta.env.DEV) console.error('[PastedLibraryWorkoutEditor] Save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [user?.uid, returnPath, savedId, normalized, workout, title, exerciseEdits]);

  const handleClose = useCallback(() => {
    window.location.href = '/training-log';
  }, []);

  const inputClass =
    'min-h-[44px] w-full rounded-lg border border-white/20 bg-black/40 px-3 text-white focus:border-orange-light focus:outline-none';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white">
      <header className="flex min-h-[52px] shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="font-mono text-sm font-medium text-white/80">
          {savedId ? 'Edit workout' : 'Save to library'}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEditing((e) => !e)}
            className="flex min-h-[44px] items-center gap-2 rounded-lg border border-white/20 px-3 font-medium transition hover:bg-white/10"
          >
            {isEditing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            {isEditing ? 'Done' : 'Edit'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="min-h-[44px] rounded-lg bg-orange-light px-4 font-bold uppercase tracking-wider text-black transition hover:bg-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-white/20 transition hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      {saveError && (
        <div className="bg-red-500/20 px-4 py-2 text-center text-sm text-red-300">
          <p>{saveError}</p>
          {(saveError.includes('sign in') || saveError.includes('session')) && (
            <a
              href={`/account?returnUrl=${encodeURIComponent(returnPath)}`}
              className="mt-2 inline-block font-medium underline"
            >
              Sign in again
            </a>
          )}
        </div>
      )}

      {!user?.uid && (
        <p className="border-b border-white/10 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-200">
          Sign in to save this workout to your library.
        </p>
      )}

      <main className="flex flex-1 flex-col overflow-auto p-4">
        <div className="mb-4">
          {isEditing ? (
            <div>
              <label
                htmlFor="workout-title"
                className="mb-1 block text-xs font-medium uppercase tracking-wider text-white/50"
              >
                Workout title
              </label>
              <input
                id="workout-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Upper Body Push Day"
                className={`${inputClass} font-heading text-xl font-bold`}
              />
            </div>
          ) : (
            <h1 className="font-heading text-xl font-bold md:text-2xl">
              {title || normalized.title}
            </h1>
          )}
        </div>

        <div className="space-y-3">
          {exerciseEdits.map((ex, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-4">
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor={`ex-name-${i}`}
                      className="mb-1 block text-xs font-medium uppercase tracking-wider text-white/50"
                    >
                      Exercise name
                    </label>
                    <input
                      id={`ex-name-${i}`}
                      type="text"
                      value={ex.exerciseName}
                      onChange={(e) => updateExercise(i, { exerciseName: e.target.value })}
                      placeholder="e.g. Bench Press"
                      className={inputClass}
                    />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="w-20 shrink-0">
                      <label
                        htmlFor={`ex-sets-${i}`}
                        className="mb-1 block text-xs font-medium uppercase tracking-wider text-white/50"
                      >
                        Sets
                      </label>
                      <input
                        id={`ex-sets-${i}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={ex.sets || ''}
                        onChange={(e) =>
                          updateExercise(i, {
                            sets: Math.max(1, parseInt(e.target.value, 10) || 1),
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor={`ex-reps-${i}`}
                        className="mb-1 block text-xs font-medium uppercase tracking-wider text-white/50"
                      >
                        Reps
                      </label>
                      <input
                        id={`ex-reps-${i}`}
                        type="text"
                        value={ex.reps}
                        onChange={(e) => updateExercise(i, { reps: e.target.value })}
                        placeholder="e.g. 10 or 10-12"
                        className={inputClass}
                      />
                    </div>
                    <div className="w-24 shrink-0">
                      <label
                        htmlFor={`ex-rest-${i}`}
                        className="mb-1 block text-xs font-medium uppercase tracking-wider text-white/50"
                      >
                        Rest (sec)
                      </label>
                      <input
                        id={`ex-rest-${i}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={ex.restSeconds ?? ''}
                        onChange={(e) =>
                          updateExercise(i, {
                            restSeconds:
                              e.target.value === '' ? undefined : parseInt(e.target.value, 10) || 0,
                          })
                        }
                        placeholder="0"
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor={`ex-notes-${i}`}
                      className="mb-1 block text-xs font-medium uppercase tracking-wider text-white/50"
                    >
                      Form cues / notes
                    </label>
                    <textarea
                      id={`ex-notes-${i}`}
                      value={ex.coachNotes ?? ''}
                      onChange={(e) => updateExercise(i, { coachNotes: e.target.value })}
                      placeholder="e.g. Control the descent, pause at chest"
                      rows={2}
                      className={`${inputClass} min-h-[64px] resize-y py-2`}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <p className="font-medium">{ex.exerciseName || 'Exercise'}</p>
                  <p className="text-sm text-white/70">
                    {ex.sets} × {ex.reps || '—'}
                    {ex.restSeconds != null && ex.restSeconds > 0
                      ? ` • ${ex.restSeconds}s rest`
                      : ''}
                  </p>
                  {ex.coachNotes?.trim() && (
                    <p className="mt-1 text-xs italic text-white/50">{ex.coachNotes}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
