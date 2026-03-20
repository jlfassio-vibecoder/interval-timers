/**
 * Read-only preview mirroring app ExerciseBlockCard layout.
 * Uses WorkoutSetTemplate shape from API (no lucide; emoji/text only).
 */

import type { Exercise, WorkoutInSet, WorkoutSetTemplate } from '@/types/workoutSetTemplate';

function formatRestDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function getExercisesFromWorkout(workout: WorkoutInSet): Exercise[] {
  if (workout.exerciseBlocks?.length) {
    return workout.exerciseBlocks.flatMap((b) => b.exercises ?? []);
  }
  return workout.blocks ?? [];
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

export interface WorkoutSetPreviewProps {
  workoutSet: WorkoutSetTemplate;
}

export default function WorkoutSetPreview({ workoutSet }: WorkoutSetPreviewProps) {
  const { title, description, difficulty, workouts } = workoutSet;
  const firstWorkout = workouts[0];
  const exercises = firstWorkout ? getExercisesFromWorkout(firstWorkout) : [];

  return (
    <div className="flex h-full min-h-[280px] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-amber-100">
          {difficulty}
        </span>
      </div>
      <h2 className="font-heading text-xl font-bold tracking-tight text-white sm:text-2xl">
        {title}
      </h2>
      {description?.trim() && (
        <p className="text-sm text-white/70">{description}</p>
      )}
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
    </div>
  );
}
