/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Workout Player (Gym Mode): set-level tracking overlay.
 * Mobile-first, broad touch targets; records actual vs target.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Check, Plus } from 'lucide-react';
import type { Exercise, ProgramSchedule } from '@/types/ai-program';
import type { ExerciseLog, SetLog, WorkoutLog } from '@/types/tracking';
import { saveWorkoutLog } from '@/lib/supabase/client/tracking';
import { useAppContext } from '@/contexts/AppContext';
import { getExercisesFromWorkout } from '@/lib/program-schedule-utils';
import { isPerSidePrescription } from '@/lib/tracking-per-side';

type WorkoutFromSchedule = ProgramSchedule['workouts'][number];

export interface WorkoutPlayerProps {
  workout: WorkoutFromSchedule;
  programId: string;
  weekId: string;
  workoutId: string;
  /** Display label for Training Log (e.g. pasted workouts from Universal Activity Hub). */
  workoutDisplayName?: string;
  onClose: () => void;
  onComplete: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** First integer in target string (e.g. "10-12" → 10) for default actual reps. */
function defaultActualRepsFromTarget(targetReps: string): number {
  const trimmed = targetReps.trim();
  if (!trimmed) return 0;
  const m = trimmed.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function buildSetLogForExercise(block: Exercise, setIndex: number): SetLog {
  const perSide = isPerSidePrescription(block.reps, block.exerciseName);
  const def = defaultActualRepsFromTarget(block.reps);
  const base: SetLog = {
    setNumber: setIndex + 1,
    targetReps: block.reps,
    targetRPE: block.rpe ?? 0,
    actualWeight: 0,
    actualReps: perSide ? def * 2 : def,
    actualRPE: 0,
    completed: false,
  };
  if (perSide) {
    return { ...base, actualRepsLeft: def, actualRepsRight: def };
  }
  return base;
}

function buildInitialLogs(workout: WorkoutFromSchedule): ExerciseLog[] {
  const exercises = getExercisesFromWorkout(workout);
  if (!exercises.length) return [];
  return exercises.map((block) => ({
    exerciseName: block.exerciseName,
    coachNotes: block.coachNotes,
    notes: '',
    sets: Array.from({ length: block.sets }, (_, i) => buildSetLogForExercise(block, i)),
  }));
}

const WorkoutPlayer: React.FC<WorkoutPlayerProps> = ({
  workout,
  programId,
  weekId,
  workoutId,
  workoutDisplayName,
  onClose,
  onComplete,
}) => {
  const { user } = useAppContext();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [logs, setLogs] = useState<ExerciseLog[]>(() => buildInitialLogs(workout));
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setElapsedTime((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const updateSet = useCallback((exIndex: number, setIndex: number, patch: Partial<SetLog>) => {
    setLogs((prev) =>
      prev.map((ex, ei) =>
        ei === exIndex
          ? {
              ...ex,
              sets: ex.sets.map((s, si) => (si === setIndex ? { ...s, ...patch } : s)),
            }
          : ex
      )
    );
  }, []);

  const addSet = useCallback((exIndex: number) => {
    setLogs((prev) =>
      prev.map((ex, ei) => {
        if (ei !== exIndex) return ex;
        const last = ex.sets[ex.sets.length - 1];
        const targetReps = last?.targetReps ?? '';
        const targetRPE = last?.targetRPE ?? 0;
        const perSide = isPerSidePrescription(targetReps, ex.exerciseName);
        const def = defaultActualRepsFromTarget(targetReps);
        const newSet: SetLog = perSide
          ? {
              setNumber: ex.sets.length + 1,
              targetReps,
              targetRPE,
              actualWeight: last?.actualWeight ?? 0,
              actualRepsLeft: last?.actualRepsLeft ?? def,
              actualRepsRight: last?.actualRepsRight ?? def,
              actualReps:
                (last?.actualRepsLeft ?? def) + (last?.actualRepsRight ?? def),
              actualRPE: 0,
              completed: false,
            }
          : {
              setNumber: ex.sets.length + 1,
              targetReps,
              targetRPE,
              actualWeight: last?.actualWeight ?? 0,
              actualReps: last?.actualReps ?? def,
              actualRPE: 0,
              completed: false,
            };
        return { ...ex, sets: [...ex.sets, newSet] };
      })
    );
  }, []);

  const updateExerciseNotes = useCallback((exIndex: number, notes: string) => {
    setLogs((prev) =>
      prev.map((ex, ei) => (ei === exIndex ? { ...ex, notes } : ex))
    );
  }, []);

  const hasAtLeastOneCompletedSet = useCallback(() => {
    return logs.some((ex) => ex.sets.some((s) => s.completed));
  }, [logs]);

  const handleFinish = useCallback(async () => {
    setFinishError(null);
    if (!hasAtLeastOneCompletedSet()) {
      setFinishError('Complete at least one set.');
      return;
    }

    const uid = user?.uid;
    if (!uid) {
      setFinishError('You must be logged in to save.');
      return;
    }

    setSaving(true);
    try {
      const log: WorkoutLog = {
        programId,
        weekId,
        workoutId,
        date: new Date(),
        durationSeconds: elapsedTime,
        exercises: logs,
        ...(workoutDisplayName != null && { workoutDisplayName }),
      };
      await saveWorkoutLog(uid, log);
      onComplete();
    } catch (err) {
      setFinishError(err instanceof Error ? err.message : 'Failed to save workout.');
    } finally {
      setSaving(false);
    }
  }, [
    user?.uid,
    programId,
    weekId,
    workoutId,
    workoutDisplayName,
    elapsedTime,
    logs,
    hasAtLeastOneCompletedSet,
    onComplete,
  ]);

  const exercises = logs;
  const current = exercises[activeExerciseIndex];
  const canPrev = activeExerciseIndex > 0;
  const canNext = activeExerciseIndex < exercises.length - 1;
  const perSideExercise =
    current != null &&
    isPerSidePrescription(
      current.sets[0]?.targetReps ?? '',
      current.exerciseName
    );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white">
      {/* Header */}
      <header className="flex min-h-[52px] shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="font-mono text-lg font-medium tabular-nums text-orange-light">
          {formatTime(elapsedTime)}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-white/20 text-white/80 transition hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={handleFinish}
            disabled={saving}
            className="min-h-[44px] rounded-lg bg-orange-light px-4 font-bold uppercase tracking-wider text-black transition hover:bg-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Finish'}
          </button>
        </div>
      </header>

      {finishError && (
        <p className="bg-red-500/20 px-4 py-2 text-center text-sm text-red-300">{finishError}</p>
      )}

      {/* Exercise card */}
      <main className="flex flex-1 flex-col overflow-auto p-4">
        {current && (
          <>
            <h2 className="mb-4 font-heading text-xl font-bold text-white md:text-2xl">
              {current.exerciseName}
            </h2>

            {current.coachNotes?.trim() ? (
              <p className="mb-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
                {current.coachNotes}
              </p>
            ) : null}

            <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20">
              <table
                className={`w-full text-left text-sm ${perSideExercise ? 'min-w-[560px]' : 'min-w-[480px]'}`}
              >
                <thead>
                  <tr className="border-b border-white/10 text-white/70">
                    <th className="p-3 font-medium">Set</th>
                    <th className="p-3 font-medium">Target</th>
                    <th className="p-3 font-medium">Weight</th>
                    {perSideExercise ? (
                      <>
                        <th className="p-3 font-medium">Reps L</th>
                        <th className="p-3 font-medium">Reps R</th>
                      </>
                    ) : (
                      <th className="p-3 font-medium">Reps</th>
                    )}
                    <th className="p-3 font-medium">RPE</th>
                    <th className="min-w-[52px] p-3 font-medium">Done</th>
                  </tr>
                </thead>
                <tbody>
                  {current.sets.map((set, setIndex) => (
                    <tr key={setIndex} className="border-b border-white/5 last:border-0">
                      <td className="p-3 font-medium">{set.setNumber}</td>
                      <td className="p-3 text-white/80">
                        {set.targetReps} reps
                        {set.targetRPE > 0 ? ` @ RPE ${set.targetRPE}` : ''}
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step={0.5}
                          value={set.actualWeight || ''}
                          onChange={(e) =>
                            updateSet(activeExerciseIndex, setIndex, {
                              actualWeight: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="min-h-[44px] w-full max-w-[80px] rounded border border-white/20 bg-black/40 px-2 text-white focus:border-orange-light focus:outline-none"
                        />
                      </td>
                      {perSideExercise ? (
                        <>
                          <td className="p-2">
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              value={
                                typeof set.actualRepsLeft === 'number'
                                  ? set.actualRepsLeft
                                  : ''
                              }
                              onChange={(e) => {
                                const v = e.target.value;
                                const left = v === '' ? 0 : parseInt(v, 10) || 0;
                                const right =
                                  typeof set.actualRepsRight === 'number'
                                    ? set.actualRepsRight
                                    : 0;
                                updateSet(activeExerciseIndex, setIndex, {
                                  actualRepsLeft: left,
                                  actualReps: left + right,
                                });
                              }}
                              aria-label="Reps left side"
                              className="min-h-[44px] w-full max-w-[64px] rounded border border-white/20 bg-black/40 px-2 text-white focus:border-orange-light focus:outline-none"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              value={
                                typeof set.actualRepsRight === 'number'
                                  ? set.actualRepsRight
                                  : ''
                              }
                              onChange={(e) => {
                                const v = e.target.value;
                                const right = v === '' ? 0 : parseInt(v, 10) || 0;
                                const left =
                                  typeof set.actualRepsLeft === 'number'
                                    ? set.actualRepsLeft
                                    : 0;
                                updateSet(activeExerciseIndex, setIndex, {
                                  actualRepsRight: right,
                                  actualReps: left + right,
                                });
                              }}
                              aria-label="Reps right side"
                              className="min-h-[44px] w-full max-w-[64px] rounded border border-white/20 bg-black/40 px-2 text-white focus:border-orange-light focus:outline-none"
                            />
                          </td>
                        </>
                      ) : (
                        <td className="p-2">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            value={set.actualReps || ''}
                            onChange={(e) =>
                              updateSet(activeExerciseIndex, setIndex, {
                                actualReps: parseInt(e.target.value, 10) || 0,
                              })
                            }
                            className="min-h-[44px] w-full max-w-[64px] rounded border border-white/20 bg-black/40 px-2 text-white focus:border-orange-light focus:outline-none"
                          />
                        </td>
                      )}
                      <td className="p-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={1}
                          max={10}
                          step={0.5}
                          value={
                            set.actualRPE != null && set.actualRPE > 0 ? set.actualRPE : ''
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === '') {
                              updateSet(activeExerciseIndex, setIndex, { actualRPE: 0 });
                              return;
                            }
                            const n = parseFloat(v);
                            if (!Number.isNaN(n)) {
                              updateSet(activeExerciseIndex, setIndex, { actualRPE: n });
                            }
                          }}
                          placeholder="—"
                          aria-label="Actual RPE"
                          className="min-h-[44px] w-full max-w-[64px] rounded border border-white/20 bg-black/40 px-2 text-white placeholder:text-white/30 focus:border-orange-light focus:outline-none"
                        />
                      </td>
                      <td className="p-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateSet(activeExerciseIndex, setIndex, {
                              completed: !set.completed,
                            })
                          }
                          className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border-2 transition ${
                            set.completed
                              ? 'bg-orange-light/20 border-orange-light text-orange-light'
                              : 'border-white/20 text-white/50 hover:border-white/40'
                          }`}
                          aria-label={set.completed ? 'Mark set incomplete' : 'Mark set complete'}
                        >
                          <Check className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={() => addSet(activeExerciseIndex)}
              className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/25 bg-white/5 px-4 text-sm font-medium text-white/80 transition hover:border-orange-light/50 hover:bg-white/10 hover:text-white"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add set
            </button>

            <label className="mt-4 block">
              <span className="mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-wide text-white/50">
                Notes for this exercise
              </span>
              <textarea
                value={current.notes ?? ''}
                onChange={(e) => updateExerciseNotes(activeExerciseIndex, e.target.value)}
                rows={3}
                placeholder="Warm-up sets, how it felt, substitutions…"
                className="w-full resize-y rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-orange-light focus:outline-none"
              />
            </label>

            {/* Navigation */}
            <div className="mt-6 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setActiveExerciseIndex((i) => i - 1)}
                disabled={!canPrev}
                className="flex min-h-[44px] items-center gap-2 rounded-lg border border-white/20 px-4 font-medium disabled:opacity-40"
              >
                <ChevronLeft className="h-5 w-5" />
                Prev
              </button>
              <span className="text-white/70">
                {activeExerciseIndex + 1} / {exercises.length}
              </span>
              <button
                type="button"
                onClick={() => setActiveExerciseIndex((i) => i + 1)}
                disabled={!canNext}
                className="flex min-h-[44px] items-center gap-2 rounded-lg border border-white/20 px-4 font-medium disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default WorkoutPlayer;
