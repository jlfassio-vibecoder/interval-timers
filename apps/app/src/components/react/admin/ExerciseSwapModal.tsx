/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Exercise Swap Modal: allows admins to swap an exercise in a WOD with a published exercise.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Loader2, CheckCircle2, ImageOff } from 'lucide-react';
import { getGeneratedExercises } from '@/lib/supabase/client/generated-exercises';
import type { GeneratedExercise } from '@/types/generated-exercise';
import type { Exercise } from '@/types';

interface ExerciseSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The original exercise name being replaced. */
  originalExerciseName: string;
  /** Called when admin confirms the swap with the selected exercise. */
  onSwap: (exercise: Exercise) => void;
}

/**
 * Transform a GeneratedExercise into the simpler Exercise type used in WOD overrides.
 */
function transformToExercise(genEx: GeneratedExercise): Exercise {
  // Use performance cues as instructions, fall back to empty array
  const instructions = genEx.biomechanics?.performanceCues ?? [];

  return {
    name: genEx.exerciseName,
    images: genEx.imageUrl ? [genEx.imageUrl] : [],
    instructions,
    videoUrl: undefined,
  };
}

const ExerciseSwapModal: React.FC<ExerciseSwapModalProps> = ({
  isOpen,
  onClose,
  originalExerciseName,
  onSwap,
}) => {
  const [exercises, setExercises] = useState<GeneratedExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExercise, setSelectedExercise] = useState<GeneratedExercise | null>(null);
  const [swapping, setSwapping] = useState(false);

  const fetchExercises = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const approvedExercises = await getGeneratedExercises('approved');
      setExercises(approvedExercises);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exercises');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    fetchExercises();
  }, [isOpen, fetchExercises]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedExercise(null);
      setSwapping(false);
    }
  }, [isOpen]);

  // Filter exercises by search query
  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) return exercises;
    const query = searchQuery.toLowerCase();
    return exercises.filter(
      (ex) =>
        ex.exerciseName.toLowerCase().includes(query) ||
        ex.complexityLevel?.toLowerCase().includes(query) ||
        ex.kineticChainType?.toLowerCase().includes(query)
    );
  }, [exercises, searchQuery]);

  const handleSwap = async () => {
    if (!selectedExercise) return;
    setSwapping(true);
    try {
      const exercise = transformToExercise(selectedExercise);
      onSwap(exercise);
    } finally {
      setSwapping(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4 backdrop-blur-3xl"
        onClick={handleBackdropClick}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="relative flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-bg-dark shadow-[0_0_100px_rgba(255,191,0,0.1)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 p-6">
            <div>
              <h2 className="font-heading text-xl font-bold text-white">Swap Exercise</h2>
              <p className="mt-1 text-sm text-white/60">
                Replacing:{' '}
                <span className="font-medium text-[#ffbf00]">{originalExerciseName}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search */}
          <div className="border-b border-white/10 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search exercises by name or level..."
                className="w-full rounded-lg border border-white/10 bg-black/20 py-2 pl-10 pr-4 text-white placeholder:text-white/40 focus:border-[#ffbf00]/50 focus:outline-none focus:ring-2 focus:ring-[#ffbf00]/20"
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#ffbf00]" />
                <p className="mt-3 text-sm text-white/60">Loading published exercises...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-sm text-red-400">{error}</p>
                <button
                  type="button"
                  onClick={fetchExercises}
                  className="mt-3 text-sm text-[#ffbf00] underline hover:text-[#ffbf00]/80"
                >
                  Try again
                </button>
              </div>
            ) : filteredExercises.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-sm text-white/60">
                  {searchQuery
                    ? 'No exercises match your search.'
                    : 'No published exercises available.'}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredExercises.map((exercise) => {
                  const isSelected = selectedExercise?.id === exercise.id;
                  return (
                    <button
                      key={exercise.id}
                      type="button"
                      onClick={() => setSelectedExercise(exercise)}
                      className={`group relative flex flex-col overflow-hidden rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? 'border-[#ffbf00] bg-[#ffbf00]/10'
                          : 'border-white/10 bg-black/20 hover:border-white/30'
                      }`}
                    >
                      {/* Image */}
                      <div className="relative aspect-video w-full overflow-hidden bg-black/40">
                        {exercise.imageUrl ? (
                          <img
                            src={exercise.imageUrl}
                            alt={exercise.exerciseName}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <ImageOff className="h-8 w-8 text-white/20" />
                          </div>
                        )}
                        {/* Selected indicator */}
                        {isSelected && (
                          <div className="absolute right-2 top-2 rounded-full bg-[#ffbf00] p-1">
                            <CheckCircle2 className="h-4 w-4 text-black" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex flex-1 flex-col p-3">
                        <h3 className="line-clamp-2 font-heading text-sm font-bold text-white">
                          {exercise.exerciseName}
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {exercise.complexityLevel && (
                            <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs capitalize text-white/60">
                              {exercise.complexityLevel}
                            </span>
                          )}
                          {exercise.kineticChainType && (
                            <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/60">
                              {exercise.kineticChainType.split(' ')[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-white/10 p-4">
            <p className="text-xs text-white/40">
              {filteredExercises.length} exercise{filteredExercises.length !== 1 ? 's' : ''}{' '}
              available
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSwap}
                disabled={!selectedExercise || swapping}
                className="flex items-center gap-2 rounded-lg bg-[#ffbf00] px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-[#ffbf00]/90 disabled:opacity-50"
              >
                {swapping ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Swapping...</span>
                  </>
                ) : (
                  <span>Swap Exercise</span>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ExerciseSwapModal;
