/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Modal for editing a single exercise: name/title, sets, reps, RPE, rest, coach notes.
 * When exercise uses HIIT (Timer Schema), shows Work / Rest / Rounds instead.
 * The exercise name is used when generating with AI (Vision Lab).
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { Exercise } from '@/types/ai-program';

export interface ExerciseBlockEditorProps {
  block: Exercise;
  onSave: (updated: Exercise) => void;
  onCancel: () => void;
  isOpen: boolean;
}

const isTimerSchema = (ex: Exercise): boolean =>
  ex.workSeconds != null && ex.restSeconds != null && ex.rounds != null;

const ExerciseBlockEditor: React.FC<ExerciseBlockEditorProps> = ({
  block,
  onSave,
  onCancel,
  isOpen,
}) => {
  const [exerciseName, setExerciseName] = useState(
    block.exerciseName?.trim() || block.exerciseQuery?.trim() || ''
  );
  const [sets, setSets] = useState(block.sets);
  const [reps, setReps] = useState(block.reps);
  const [rpe, setRpe] = useState<number | ''>(block.rpe ?? '');
  const [restSeconds, setRestSeconds] = useState<number | ''>(block.restSeconds ?? '');
  const [coachNotes, setCoachNotes] = useState(block.coachNotes ?? '');
  const [workSeconds, setWorkSeconds] = useState<number | ''>(block.workSeconds ?? '');
  const [rounds, setRounds] = useState<number | ''>(block.rounds ?? '');

  const timerMode = isTimerSchema(block);

  useEffect(() => {
    if (isOpen) {
      setExerciseName(block.exerciseName?.trim() || block.exerciseQuery?.trim() || '');
      setSets(block.sets);
      setReps(block.reps);
      setRpe(block.rpe ?? '');
      setRestSeconds(block.restSeconds ?? '');
      setCoachNotes(block.coachNotes ?? '');
      setWorkSeconds(block.workSeconds ?? '');
      setRounds(block.rounds ?? '');
    }
  }, [
    isOpen,
    block.exerciseName,
    block.exerciseQuery,
    block.sets,
    block.reps,
    block.rpe,
    block.restSeconds,
    block.coachNotes,
    block.workSeconds,
    block.rounds,
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = exerciseName.trim() || block.exerciseName || '';
    if (timerMode) {
      const updated: Exercise = {
        ...block,
        exerciseName: name,
        exerciseQuery: name,
        sets: 0,
        reps: '',
        rpe: undefined,
        restSeconds: restSeconds === '' ? (block.restSeconds ?? 0) : Number(restSeconds),
        coachNotes: coachNotes.trim() || undefined,
        workSeconds: workSeconds === '' ? (block.workSeconds ?? 40) : Number(workSeconds),
        rounds: rounds === '' ? (block.rounds ?? 4) : Number(rounds),
      };
      onSave(updated);
    } else {
      const updated: Exercise = {
        ...block,
        exerciseName: name,
        exerciseQuery: name,
        sets,
        reps: typeof reps === 'number' ? String(reps) : reps,
        rpe: rpe === '' ? undefined : Number(rpe),
        restSeconds: restSeconds === '' ? undefined : Number(restSeconds),
        coachNotes: coachNotes.trim() || undefined,
        workSeconds: undefined,
        rounds: undefined,
      };
      onSave(updated);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[160] flex items-center justify-center bg-black/80 p-4"
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-xl border border-white/10 bg-bg-dark p-6 shadow-xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-heading text-lg font-bold">Edit: {exerciseName || 'Exercise'}</h3>
            <button
              type="button"
              onClick={onCancel}
              className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-white/80">Exercise name</label>
              <input
                type="text"
                value={exerciseName}
                onChange={(e) => setExerciseName(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white"
                placeholder="e.g. Pike Push-ups, Inverted Row"
              />
              <p className="mt-1 text-xs text-white/50">
                This name is used when generating with AI (Sparkles).
              </p>
            </div>
            {timerMode ? (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-white/80">
                    Work (seconds)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={workSeconds}
                    onChange={(e) =>
                      setWorkSeconds(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                    }
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white"
                    placeholder="e.g. 40"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-white/80">
                    Rest (seconds)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={restSeconds}
                    onChange={(e) =>
                      setRestSeconds(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                    }
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white"
                    placeholder="e.g. 20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-white/80">Rounds</label>
                  <input
                    type="number"
                    min={1}
                    value={rounds}
                    onChange={(e) =>
                      setRounds(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                    }
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white"
                    placeholder="e.g. 4"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-white/80">Sets</label>
                  <input
                    type="number"
                    min={1}
                    value={sets}
                    onChange={(e) => setSets(parseInt(e.target.value, 10) || 1)}
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-white/80">Reps</label>
                  <input
                    type="text"
                    value={reps}
                    onChange={(e) => setReps(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white"
                    placeholder="e.g. 8-10"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-white/80">
                    RPE (optional)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={rpe}
                    onChange={(e) =>
                      setRpe(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                    }
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white"
                    placeholder="1-10"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-white/80">
                    Rest (seconds, optional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={restSeconds}
                    onChange={(e) =>
                      setRestSeconds(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                    }
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white"
                    placeholder="e.g. 90"
                  />
                </div>
              </>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-white/80">
                Coach notes (optional)
              </label>
              <textarea
                value={coachNotes}
                onChange={(e) => setCoachNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white"
                placeholder="Form cues, tempo notes..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-white/10 px-4 py-2 text-white hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="hover:bg-[#ffbf00]/90 rounded-lg bg-[#ffbf00] px-4 py-2 font-medium text-black"
              >
                Save
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ExerciseBlockEditor;
