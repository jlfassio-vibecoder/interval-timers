/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Loader2, Trash2 } from 'lucide-react';
import {
  fetchWorkout,
  updateWorkoutDetails,
  type SupabaseWorkout,
  type WorkoutBlock,
  type BlockExercise,
} from '@/lib/supabase/admin/workout-details';
import { useAppContext } from '@/contexts/AppContext';
import StatusMessage from '../StatusMessage';

interface WorkoutEditorProps {
  /** When rendered from Astro (no React Router), pass the workout id from the URL. */
  workoutId?: string;
}

const WorkoutEditor: React.FC<WorkoutEditorProps> = ({ workoutId }) => {
  const paramsId = useParams<{ id: string }>()?.id;
  const id = paramsId ?? workoutId;
  const navigate = useNavigate();
  const { user } = useAppContext();

  const [workout, setWorkout] = useState<SupabaseWorkout | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(60);
  const [difficulty, setDifficulty] = useState('intermediate');

  // Blocks State (The core workout structure)
  const [blocks, setBlocks] = useState<WorkoutBlock[]>([]);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchWorkout(id!);
      setWorkout(data);

      setTitle(data.title);
      setDescription(data.description || '');
      setDuration(data.duration_minutes || 60);
      setDifficulty(data.difficulty_level || 'intermediate');

      // Normalize blocks if empty or null
      const loadedBlocks = (data.blocks as WorkoutBlock[]) || [];
      if (loadedBlocks.length === 0) {
        setBlocks([
          { type: 'warmup', name: 'Warmup', order: 1, exercises: [] },
          { type: 'main', name: 'Main Circuit', order: 2, exercises: [] },
          { type: 'cooldown', name: 'Cooldown', order: 3, exercises: [] },
        ]);
      } else {
        setBlocks(loadedBlocks);
      }
    } catch (err) {
      console.error('Failed to load workout:', err);
      setError('Failed to load workout details.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id || !user) return;
    try {
      setSaving(true);
      setError(null);
      setSaveSuccess(false);

      await updateWorkoutDetails(id, {
        title,
        description,
        duration_minutes: duration,
        difficulty_level: difficulty,
        blocks: blocks, // Save the JSON structure
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Save failed:', err);
      setError('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddExercise = (blockIndex: number) => {
    const newBlocks = [...blocks];
    const newExercise: BlockExercise = {
      id: crypto.randomUUID(),
      name: 'New Exercise',
      sets: 3,
      reps: '10',
      restSeconds: 60,
    };
    newBlocks[blockIndex].exercises.push(newExercise);
    setBlocks(newBlocks);
  };

  const handleUpdateExercise = (
    blockIndex: number,
    exerciseIndex: number,
    field: string,
    value: string | number
  ) => {
    const newBlocks = [...blocks];
    newBlocks[blockIndex].exercises[exerciseIndex] = {
      ...newBlocks[blockIndex].exercises[exerciseIndex],
      [field]: value,
    };
    setBlocks(newBlocks);
  };

  const handleRemoveExercise = (blockIndex: number, exerciseIndex: number) => {
    const newBlocks = [...blocks];
    newBlocks[blockIndex].exercises.splice(exerciseIndex, 1);
    setBlocks(newBlocks);
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-orange-light" />
      </div>
    );
  }

  if (error || !workout) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/60 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <StatusMessage type="error" message={error || 'Workout not found'} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-20">
      {/* Header */}
      <div className="bg-bg-dark/95 sticky top-0 z-30 flex items-center justify-between border-b border-white/5 py-4 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="rounded-full bg-white/5 p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Edit Workout</h1>
            <p className="text-xs text-white/40">{title || 'Untitled'}</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="hover:bg-orange-light/90 flex items-center gap-2 rounded-lg bg-orange-light px-6 py-2 text-sm font-bold text-black transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {saveSuccess && (
        <StatusMessage
          type="success"
          message="Workout saved successfully!"
          onDismiss={() => setSaveSuccess(false)}
        />
      )}

      {/* Meta Form */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-white/40">
              Workout Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="focus:border-orange-light/50 w-full rounded-lg border border-white/10 bg-white/5 p-3 text-white outline-none"
              placeholder="e.g. Chest & Triceps"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-white/40">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="focus:border-orange-light/50 w-full resize-none rounded-lg border border-white/10 bg-white/5 p-3 text-white outline-none"
              placeholder="Instructions for the client..."
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-white/40">
              Duration (min)
            </label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
              className="focus:border-orange-light/50 w-full rounded-lg border border-white/10 bg-white/5 p-3 text-white outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-white/40">
              Difficulty
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="focus:border-orange-light/50 w-full rounded-lg border border-white/10 bg-white/5 p-3 text-white outline-none"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>
      </div>

      {/* Blocks Editor */}
      <div className="space-y-6">
        <h2 className="border-b border-white/10 pb-2 text-lg font-bold text-white">
          Workout Blocks
        </h2>

        {blocks.map((block, blockIndex) => (
          <div
            key={blockIndex}
            className="overflow-hidden rounded-xl border border-white/10 bg-[#1a1a1a]/40"
          >
            <div className="flex items-center justify-between bg-white/5 p-3">
              <input
                type="text"
                value={block.name}
                onChange={(e) => {
                  const newBlocks = [...blocks];
                  newBlocks[blockIndex].name = e.target.value;
                  setBlocks(newBlocks);
                }}
                className="focus:border-orange-light/50 border-b border-transparent bg-transparent font-bold text-white focus:outline-none"
              />
              <span className="rounded bg-white/10 px-2 py-1 text-xs uppercase text-white/50">
                {block.type}
              </span>
            </div>

            <div className="space-y-3 p-4">
              {block.exercises.map((ex, exIndex) => (
                <div key={exIndex} className="group flex items-start gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={ex.name}
                        onChange={(e) =>
                          handleUpdateExercise(blockIndex, exIndex, 'name', e.target.value)
                        }
                        className="focus:border-orange-light/50 flex-1 rounded border border-white/10 bg-black/20 px-2 py-1.5 text-sm font-medium text-white outline-none"
                        placeholder="Exercise Name"
                      />
                      <button
                        onClick={() => handleRemoveExercise(blockIndex, exIndex)}
                        className="p-1.5 text-white/20 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <div className="flex items-center gap-1 rounded border border-white/5 bg-white/5 px-2 py-1">
                        <span className="uppercase text-white/40">Sets</span>
                        <input
                          type="number"
                          value={ex.sets}
                          onChange={(e) =>
                            handleUpdateExercise(
                              blockIndex,
                              exIndex,
                              'sets',
                              parseInt(e.target.value)
                            )
                          }
                          className="w-8 bg-transparent text-center font-mono text-white focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1 rounded border border-white/5 bg-white/5 px-2 py-1">
                        <span className="uppercase text-white/40">Reps</span>
                        <input
                          type="text"
                          value={ex.reps}
                          onChange={(e) =>
                            handleUpdateExercise(blockIndex, exIndex, 'reps', e.target.value)
                          }
                          className="w-12 bg-transparent text-center font-mono text-white focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1 rounded border border-white/5 bg-white/5 px-2 py-1">
                        <span className="uppercase text-white/40">Rest (s)</span>
                        <input
                          type="number"
                          value={ex.restSeconds}
                          onChange={(e) =>
                            handleUpdateExercise(
                              blockIndex,
                              exIndex,
                              'restSeconds',
                              parseInt(e.target.value)
                            )
                          }
                          className="w-10 bg-transparent text-center font-mono text-white focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={() => handleAddExercise(blockIndex)}
                className="flex w-full items-center justify-center gap-2 rounded border border-dashed border-white/10 py-2 text-xs font-bold uppercase tracking-wide text-white/30 transition-colors hover:bg-white/5 hover:text-orange-light"
              >
                <Plus className="h-3 w-3" />
                Add Exercise
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={() =>
            setBlocks([
              ...blocks,
              { type: 'main', name: 'New Block', order: blocks.length + 1, exercises: [] },
            ])
          }
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/5 py-3 font-bold uppercase text-white/40 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Plus className="h-4 w-4" />
          Add Block
        </button>
      </div>
    </div>
  );
};

export default WorkoutEditor;
