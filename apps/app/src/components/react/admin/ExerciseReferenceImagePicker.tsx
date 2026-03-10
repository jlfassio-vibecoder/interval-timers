/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Exercise Reference Image Picker: search for an exercise, select it, then pick
 * primary or gallery image as reference. Reuses getGeneratedExercises and
 * getExerciseImages (same as Exercises tab).
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Loader2, ImageOff } from 'lucide-react';
import { getGeneratedExercises } from '@/lib/supabase/client/generated-exercises';
import { getExerciseImages } from '@/lib/supabase/client/exercise-gallery';
import type { GeneratedExercise } from '@/types/generated-exercise';

interface ExerciseImageOption {
  id: string;
  imageUrl: string;
  roleLabel: string;
}

export interface ExerciseReferenceImagePickerProps {
  loadReferenceFromUrl: (url: string) => Promise<void>;
  loadingReference: boolean;
}

const ExerciseReferenceImagePicker: React.FC<ExerciseReferenceImagePickerProps> = ({
  loadReferenceFromUrl,
  loadingReference,
}) => {
  const [exercises, setExercises] = useState<GeneratedExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExercise, setSelectedExercise] = useState<GeneratedExercise | null>(null);
  const [exerciseImages, setExerciseImages] = useState<ExerciseImageOption[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);

  const fetchExercises = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getGeneratedExercises();
      setExercises(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exercises');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExercises();
  }, [fetchExercises]);

  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) return exercises;
    const query = searchQuery.toLowerCase();
    return exercises.filter(
      (ex) =>
        ex.exerciseName.toLowerCase().includes(query) ||
        ex.complexityLevel?.toLowerCase().includes(query) ||
        (ex.kineticChainType?.toLowerCase().includes(query) ?? false)
    );
  }, [exercises, searchQuery]);

  useEffect(() => {
    if (!selectedExercise) {
      setExerciseImages([]);
      return;
    }
    setLoadingImages(true);
    const build = async () => {
      try {
        const list: ExerciseImageOption[] = [];
        if (selectedExercise.imageUrl) {
          list.push({
            id: 'primary',
            imageUrl: selectedExercise.imageUrl,
            roleLabel: 'Primary',
          });
        }
        const gallery = await getExerciseImages(selectedExercise.id);
        for (const img of gallery) {
          list.push({
            id: img.id,
            imageUrl: img.imageUrl,
            roleLabel: img.role.charAt(0).toUpperCase() + img.role.slice(1),
          });
        }
        setExerciseImages(list);
      } catch {
        setExerciseImages(
          selectedExercise.imageUrl
            ? [{ id: 'primary', imageUrl: selectedExercise.imageUrl, roleLabel: 'Primary' }]
            : []
        );
      } finally {
        setLoadingImages(false);
      }
    };
    build();
  }, [selectedExercise]);

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-white/70">From exercise library</p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search exercises by name or level..."
          className="focus:border-orange-light/50 focus:ring-orange-light/20 w-full rounded-lg border border-white/10 bg-black/20 py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-white/50">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading exercises...
        </div>
      ) : error ? (
        <p className="text-xs text-amber-400">{error}</p>
      ) : filteredExercises.length === 0 ? (
        <p className="text-xs text-white/50">
          {searchQuery ? 'No exercises match your search.' : 'No exercises available.'}
        </p>
      ) : (
        <div className="max-h-32 overflow-y-auto rounded-lg border border-white/10 bg-black/20">
          <div className="flex flex-wrap gap-2 p-2">
            {filteredExercises.slice(0, 24).map((exercise) => {
              const isSelected = selectedExercise?.id === exercise.id;
              return (
                <button
                  key={exercise.id}
                  type="button"
                  onClick={() => setSelectedExercise(exercise)}
                  className={`flex items-center gap-2 rounded-lg border p-2 text-left transition-colors ${
                    isSelected
                      ? 'border-orange-light/50 bg-orange-light/20'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-black/40">
                    {exercise.imageUrl ? (
                      <img src={exercise.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImageOff className="h-5 w-5 text-white/30" />
                      </div>
                    )}
                  </div>
                  <span className="max-w-[140px] truncate text-xs font-medium text-white">
                    {exercise.exerciseName}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedExercise && (
        <div className="space-y-2">
          <p className="text-xs text-white/60">
            Primary & gallery for {selectedExercise.exerciseName}
          </p>
          {loadingImages ? (
            <div className="flex items-center gap-2 text-xs text-white/50">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading images...
            </div>
          ) : exerciseImages.length === 0 ? (
            <p className="text-xs text-white/50">No images for this exercise.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {exerciseImages.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col items-center gap-1 rounded-lg border border-white/10 bg-black/20 p-2"
                >
                  <img
                    src={item.imageUrl}
                    alt={item.roleLabel}
                    className="h-14 w-14 rounded object-cover"
                  />
                  <span className="text-xs text-white/60">{item.roleLabel}</span>
                  <button
                    type="button"
                    onClick={() => loadReferenceFromUrl(item.imageUrl)}
                    disabled={loadingReference}
                    className="hover:border-orange-light/30 hover:bg-orange-light/20 rounded border border-white/10 bg-black/20 px-2 py-0.5 text-xs font-medium text-white transition-colors disabled:opacity-50"
                  >
                    Use as reference
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExerciseReferenceImagePicker;
