/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Full-page parsed-content landing for saved/handoff workouts.
 * Mirrors Universal Activity Hub WorkoutSetPreview layout; adds Start Workout and back link.
 */

import { getExercisesFromWorkout } from '@/lib/program-schedule-utils';
import type { WorkoutSetTemplate } from '@/types/ai-workout';
import type { Exercise } from '@/types/ai-program';

function formatRestDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function ExerciseRow({ exercise, index }: { exercise: Exercise; index: number }) {
  const hasName = !!exercise.exerciseName?.trim();
  return (
    <div
      className="flex items-start gap-3 rounded-lg border border-white/5 bg-black/10 p-3"
      data-exercise-block-card
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/80">
        {exercise.order ?? index + 1}
      </span>
      <div className="min-w-0 flex-1">
        {!hasName ? (
          <span className="text-sm text-white/40">Exercise not specified</span>
        ) : (
          <>
            <div className="font-medium text-white">{exercise.exerciseName}</div>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-white/60">
              {exercise.workSeconds != null &&
              exercise.restSeconds != null &&
              exercise.rounds != null ? (
                <span>
                  {exercise.workSeconds}s work / {formatRestDuration(exercise.restSeconds)} rest ×{' '}
                  {exercise.rounds} rounds
                </span>
              ) : (
                <>
                  <span>{exercise.sets ?? 0} sets</span>
                  <span>{exercise.reps ?? ''} reps</span>
                  {exercise.rpe != null && <span>RPE {exercise.rpe}</span>}
                  {exercise.restSeconds != null && (
                    <span>{formatRestDuration(exercise.restSeconds)} rest</span>
                  )}
                </>
              )}
            </div>
            {exercise.coachNotes?.trim() && (
              <p className="mt-1 text-xs italic text-white/50">{exercise.coachNotes}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export interface WorkoutSetPreviewLandingProps {
  workoutSet: WorkoutSetTemplate;
  onStartWorkout: () => void;
  returnPath: string;
  /** When provided, show Schedule, Log Past, Save Workout actions (text-entry flow). */
  onSchedule?: () => void;
  onLogPast?: () => void;
  onSave?: () => void;
}

const btnClass =
  'flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-mono text-sm font-bold uppercase tracking-wider text-white/90 transition-colors hover:bg-white/10';
const primaryBtnClass =
  'flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-amber-500/50 bg-gradient-to-r from-amber-600/40 to-orange-600/30 px-4 py-3 font-mono text-sm font-bold uppercase tracking-wider text-amber-50 transition-colors hover:from-amber-600/55 hover:to-orange-600/45';

export default function WorkoutSetPreviewLanding({
  workoutSet,
  onStartWorkout,
  returnPath,
  onSchedule,
  onLogPast,
  onSave,
}: WorkoutSetPreviewLandingProps) {
  const { title, description, difficulty, workouts } = workoutSet;
  const firstWorkout = workouts[0];
  const exercises = firstWorkout ? getExercisesFromWorkout(firstWorkout) : [];

  const isFromSavedWorkouts = returnPath.includes('savedId');
  const backHref = isFromSavedWorkouts ? '/account/saved-workouts' : '/training-log';
  const backLabel = isFromSavedWorkouts ? 'Your Workouts' : 'Training Log';

  return (
    <div className="flex min-h-screen flex-col bg-black/95 text-white">
      <header className="shrink-0 border-b border-white/10 px-4 py-3">
        <a href={backHref} className="text-sm text-white/70 transition hover:text-white">
          ← {backLabel}
        </a>
      </header>
      <main className="flex flex-1 flex-col gap-6 overflow-auto px-4 py-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-amber-100">
            {difficulty}
          </span>
        </div>
        <h1 className="font-heading text-xl font-bold tracking-tight text-white sm:text-2xl">
          {title}
        </h1>
        {description?.trim() && <p className="text-sm text-white/70">{description}</p>}
        {firstWorkout?.title && firstWorkout.title !== title && (
          <p className="font-mono text-xs text-white/50">{firstWorkout.title}</p>
        )}
        {exercises.length === 0 ? (
          <p className="font-mono text-sm text-white/40">No exercises extracted yet.</p>
        ) : (
          <div className="space-y-2">
            {exercises.map((ex, i) => (
              <ExerciseRow key={`${ex.exerciseName}-${i}`} exercise={ex} index={i} />
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-col gap-3">
          {onSchedule != null && onLogPast != null && onSave != null ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" className={btnClass} onClick={onSchedule}>
                  Schedule
                </button>
                <button type="button" className={btnClass} onClick={onLogPast}>
                  Log Past
                </button>
                <button type="button" className={`${btnClass} col-span-2`} onClick={onSave}>
                  Save Workout
                </button>
              </div>
              <button type="button" className={primaryBtnClass} onClick={onStartWorkout}>
                Start Workout
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onStartWorkout}
              className="border-orange-500 bg-orange-600 hover:bg-orange-500 w-full rounded-xl border-2 px-4 py-4 font-bold text-white transition sm:w-auto sm:min-w-[200px]"
            >
              Start Workout
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
