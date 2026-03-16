/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Trash2,
  X,
  ArrowRight,
  Image,
  Sparkles,
  Loader2,
  Upload,
  EyeOff,
  RefreshCw,
  UserPlus,
} from 'lucide-react';
import { getAllExercises, createExercise, deleteExercise } from '@/lib/supabase/client/exercises';
import type { Exercise } from '@/lib/supabase/client/exercises';
import {
  getGeneratedExercises,
  updateGeneratedExerciseStatus,
} from '@/lib/supabase/client/generated-exercises';
import type { GeneratedExercise, GeneratedExerciseStatus } from '@/types/generated-exercise';
import { EXERCISE_LABELS } from '@/lib/labels/exercises';

type TabType = 'library' | 'generated' | 'manual';

const ManageExercises: React.FC = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('library');

  // Exercise Library (all) state
  const [libraryManual, setLibraryManual] = useState<Exercise[]>([]);
  const [libraryGenerated, setLibraryGenerated] = useState<GeneratedExercise[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  // Manually Added state
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Generated Exercises state
  const [generatedExercises, setGeneratedExercises] = useState<GeneratedExercise[]>([]);
  const [generatedLoading, setGeneratedLoading] = useState(false);
  const [generatedError, setGeneratedError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<GeneratedExerciseStatus | 'all'>('all');
  const [publishingExerciseId, setPublishingExerciseId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: 'strength' as 'strength' | 'cardio' | 'mobility',
    muscleGroups: '',
    videoUrl: '',
    defaultEquipment: '',
  });

  // Fetch Library (all exercises) when tab is library
  useEffect(() => {
    if (activeTab === 'library') {
      fetchLibraryExercises();
    }
  }, [activeTab]);

  // Fetch manual exercises when tab is manual
  useEffect(() => {
    if (activeTab === 'manual') {
      fetchExercises();
    }
  }, [activeTab]);

  // Fetch generated exercises when tab is generated or filter changes
  useEffect(() => {
    if (activeTab === 'generated') {
      fetchGeneratedExercises();
    }
  }, [activeTab, statusFilter]);

  const fetchLibraryExercises = async () => {
    try {
      setLibraryLoading(true);
      setLibraryError(null);
      const [manualData, generatedData] = await Promise.all([
        getAllExercises(),
        getGeneratedExercises(),
      ]);
      setLibraryManual(manualData);
      setLibraryGenerated(generatedData);
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : 'Failed to load exercises');
    } finally {
      setLibraryLoading(false);
    }
  };

  const fetchExercises = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllExercises();
      setExercises(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch exercises');
    } finally {
      setLoading(false);
    }
  };

  const fetchGeneratedExercises = async () => {
    try {
      setGeneratedLoading(true);
      setGeneratedError(null);
      const filter = statusFilter === 'all' ? undefined : statusFilter;
      const data = await getGeneratedExercises(filter);
      setGeneratedExercises(data);
    } catch (err) {
      setGeneratedError(err instanceof Error ? err.message : 'Failed to fetch generated exercises');
    } finally {
      setGeneratedLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      setError('Exercise name is required');
      return;
    }

    if (!formData.muscleGroups.trim()) {
      setError('At least one muscle group is required');
      return;
    }

    try {
      setError(null);

      // Parse comma-separated strings
      const muscleGroups = formData.muscleGroups
        .split(',')
        .map((mg) => mg.trim())
        .filter((mg) => mg.length > 0);

      const defaultEquipment = formData.defaultEquipment
        .split(',')
        .map((eq) => eq.trim())
        .filter((eq) => eq.length > 0);

      const exerciseData: Omit<Exercise, 'id'> = {
        name: formData.name.trim(),
        category: formData.category,
        muscleGroups,
        defaultEquipment,
        ...(formData.videoUrl.trim() && { videoUrl: formData.videoUrl.trim() }),
      };

      await createExercise(exerciseData);

      // Reset form and refresh list
      setFormData({
        name: '',
        category: 'strength',
        muscleGroups: '',
        videoUrl: '',
        defaultEquipment: '',
      });
      setShowForm(false);
      await fetchExercises();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create exercise');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this exercise?')) {
      return;
    }

    try {
      setError(null);
      await deleteExercise(id);
      await fetchExercises();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete exercise');
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'strength':
        return 'bg-blue-500/20 text-blue-300';
      case 'cardio':
        return 'bg-red-500/20 text-red-300';
      case 'mobility':
        return 'bg-green-500/20 text-green-300';
      default:
        return 'bg-gray-500/20 text-gray-300';
    }
  };

  const getStatusColor = (status: GeneratedExerciseStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'approved':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'rejected':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const handlePublishExercise = async (id: string) => {
    try {
      setPublishingExerciseId(id);
      setGeneratedError(null);
      await updateGeneratedExerciseStatus(id, 'approved');
      await fetchGeneratedExercises();
    } catch (err) {
      setGeneratedError(err instanceof Error ? err.message : 'Failed to publish exercise');
    } finally {
      setPublishingExerciseId(null);
    }
  };

  const handleUnpublishExercise = async (id: string) => {
    try {
      setPublishingExerciseId(id);
      setGeneratedError(null);
      await updateGeneratedExerciseStatus(id, 'pending');
      await fetchGeneratedExercises();
    } catch (err) {
      setGeneratedError(err instanceof Error ? err.message : 'Failed to unpublish exercise');
    } finally {
      setPublishingExerciseId(null);
    }
  };

  const formatDate = (timestamp: { toDate?: () => Date } | Date | null) => {
    if (!timestamp) return 'Unknown';
    let date: Date | null = null;
    if (typeof (timestamp as { toDate?: () => Date }).toDate === 'function') {
      date = (timestamp as { toDate: () => Date }).toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    }
    if (!date || Number.isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with title */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">{EXERCISE_LABELS.section}</h1>
          <p className="mt-2 text-white/60">Manage exercise library and AI-generated exercises</p>
        </div>
        <Link
          to="/exercise-image-gen"
          className="flex items-center gap-2 rounded-lg bg-[#ffbf00] px-4 py-2 font-medium text-black transition-colors hover:bg-[#ffbf00]/90"
        >
          <Image className="h-5 w-5" />
          <span>{EXERCISE_LABELS.visualizationLab}</span>
        </Link>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-white/10 pb-4">
        <button
          onClick={() => setActiveTab('library')}
          className={`rounded-lg px-4 py-2 font-medium transition-colors ${
            activeTab === 'library'
              ? 'bg-[#ffbf00] text-black'
              : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
          }`}
        >
          Exercise Library
        </button>
        <button
          onClick={() => setActiveTab('generated')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors ${
            activeTab === 'generated'
              ? 'bg-[#ffbf00] text-black'
              : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Generated Exercises
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors ${
            activeTab === 'manual'
              ? 'bg-[#ffbf00] text-black'
              : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
          }`}
        >
          <UserPlus className="h-4 w-4" />
          Manually Added
        </button>
      </div>

      {/* ============ EXERCISE LIBRARY TAB (all exercises) ============ */}
      {activeTab === 'library' && (
        <>
          {/* Error Message */}
          {libraryError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-300">
              {libraryError}
            </div>
          )}

          {/* Loading State */}
          {libraryLoading && (
            <div className="rounded-lg border border-white/10 bg-black/20 p-12 text-center backdrop-blur-sm">
              <p className="text-white/60">Loading exercises...</p>
            </div>
          )}

          {/* Section: From Visualization Lab */}
          {!libraryLoading && (
            <section className="mb-10">
              <h3 className="mb-1 text-lg font-semibold text-white">From Visualization Lab</h3>
              <p className="mb-4 text-sm text-white/60">
                Exercises created in the Visualization Lab. Click to review and publish.
              </p>
              {libraryGenerated.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-black/20 p-12 text-center backdrop-blur-sm">
                  <p className="text-white/60">
                    No exercises from Visualization Lab yet. Generate your first one.
                  </p>
                  <Link
                    to="/exercise-image-gen"
                    className="mt-4 inline-flex items-center gap-2 text-[#ffbf00] hover:underline"
                  >
                    <Sparkles className="h-4 w-4" />
                    Generate Exercise
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {[...libraryGenerated]
                    .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName))
                    .map((item) => (
                      <div
                        key={`generated-${item.id}`}
                        className="group rounded-lg border border-white/10 bg-black/20 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-black/30"
                      >
                        <Link to={`/exercises/${item.slug}`} className="block">
                          <div className="mb-2 flex items-center gap-2">
                            <span className="rounded-full bg-[#ffbf00]/20 px-2 py-0.5 text-xs font-medium text-[#ffbf00]">
                              From Visualization Lab
                            </span>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${getStatusColor(item.status)}`}
                            >
                              {item.status === 'approved' ? 'Published' : item.status}
                            </span>
                          </div>
                          <div className="relative aspect-video w-full overflow-hidden rounded-t-lg bg-black/40">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.exerciseName}
                                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <Image className="h-12 w-12 text-white/20" />
                              </div>
                            )}
                          </div>
                          <div className="p-4">
                            <h3 className="font-heading text-lg font-bold group-hover:text-[#ffbf00]">
                              {item.exerciseName}
                            </h3>
                            {item.kineticChainType && (
                              <span className="mt-2 inline-block rounded bg-white/10 px-2 py-0.5 font-mono text-xs text-white/70">
                                {item.kineticChainType}
                              </span>
                            )}
                            <p className="mt-3 text-xs text-white/50">
                              Generated {formatDate(item.generatedAt)}
                            </p>
                            <div className="mt-3 flex items-center gap-1 text-sm text-[#ffbf00] group-hover:underline">
                              View Details
                              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </div>
                          </div>
                        </Link>
                      </div>
                    ))}
                </div>
              )}
            </section>
          )}

          {/* Section: Manually added */}
          {!libraryLoading && (
            <section>
              <h3 className="mb-1 text-lg font-semibold text-white">Manually added</h3>
              {libraryManual.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-black/20 p-12 text-center backdrop-blur-sm">
                  <p className="text-white/60">
                    No manually added exercises. Add one from the Manually Added tab.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {[...libraryManual]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((item) => (
                      <div
                        key={`manual-${item.id}`}
                        className="rounded-lg border border-white/10 bg-black/20 p-6 backdrop-blur-sm transition-all hover:border-white/20"
                      >
                        <div className="mb-2">
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/70">
                            Manually added
                          </span>
                        </div>
                        <div className="mb-4 flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-heading text-xl font-bold">{item.name}</h3>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${getCategoryColor(item.category)}`}
                          >
                            {item.category}
                          </span>
                        </div>
                        <div className="mb-4">
                          <p className="mb-2 text-xs font-medium uppercase text-white/60">
                            Muscle Groups
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {item.muscleGroups.map((mg, idx) => (
                              <span
                                key={idx}
                                className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80"
                              >
                                {mg}
                              </span>
                            ))}
                          </div>
                        </div>
                        {item.defaultEquipment.length > 0 && (
                          <div className="mb-4">
                            <p className="mb-2 text-xs font-medium uppercase text-white/60">
                              Equipment
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {item.defaultEquipment.map((eq, idx) => (
                                <span
                                  key={idx}
                                  className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/70"
                                >
                                  {eq}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {item.videoUrl && (
                          <a
                            href={item.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-[#ffbf00] hover:underline"
                          >
                            View Video →
                          </a>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* ============ MANUALLY ADDED TAB ============ */}
      {activeTab === 'manual' && (
        <>
          {/* Add Exercise Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 rounded-lg bg-[#ffbf00] px-4 py-2 font-medium text-black transition-colors hover:bg-[#ffbf00]/90"
            >
              <Plus className="h-5 w-5" />
              <span>Add Exercise</span>
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-300">
              {error}
            </div>
          )}

          {/* Add Exercise Form */}
          {showForm && (
            <div className="rounded-lg border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-heading text-xl font-bold">Add New Exercise</h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/80">
                    Exercise Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white placeholder:text-white/40 focus:border-[#ffbf00]/50 focus:outline-none focus:ring-2 focus:ring-[#ffbf00]/20"
                    placeholder="e.g. Squat"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/80">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        category: e.target.value as 'strength' | 'cardio' | 'mobility',
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white focus:border-[#ffbf00]/50 focus:outline-none focus:ring-2 focus:ring-[#ffbf00]/20"
                    required
                  >
                    <option value="strength">Strength</option>
                    <option value="cardio">Cardio</option>
                    <option value="mobility">Mobility</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/80">
                    Muscle Groups * (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.muscleGroups}
                    onChange={(e) => setFormData({ ...formData, muscleGroups: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white placeholder:text-white/40 focus:border-[#ffbf00]/50 focus:outline-none focus:ring-2 focus:ring-[#ffbf00]/20"
                    placeholder="e.g. quads, glutes"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/80">
                    Video URL (optional)
                  </label>
                  <input
                    type="url"
                    value={formData.videoUrl}
                    onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white placeholder:text-white/40 focus:border-[#ffbf00]/50 focus:outline-none focus:ring-2 focus:ring-[#ffbf00]/20"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/80">
                    Default Equipment (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.defaultEquipment}
                    onChange={(e) => setFormData({ ...formData, defaultEquipment: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-white placeholder:text-white/40 focus:border-[#ffbf00]/50 focus:outline-none focus:ring-2 focus:ring-[#ffbf00]/20"
                    placeholder="e.g. dumbbells, bench"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-[#ffbf00] px-6 py-2 font-medium text-black transition-colors hover:bg-[#ffbf00]/90"
                  >
                    Create Exercise
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="rounded-lg border border-white/10 bg-black/20 px-6 py-2 font-medium text-white transition-colors hover:bg-white/5"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="rounded-lg border border-white/10 bg-black/20 p-12 text-center backdrop-blur-sm">
              <p className="text-white/60">Loading exercises...</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && exercises.length === 0 && (
            <div className="rounded-lg border border-white/10 bg-black/20 p-12 text-center backdrop-blur-sm">
              <p className="text-white/60">
                No manually added exercises. Create your first one to get started.
              </p>
            </div>
          )}

          {/* Manual Exercises Grid */}
          {!loading && exercises.length > 0 && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {exercises.map((exercise) => (
                <div
                  key={exercise.id}
                  className="rounded-lg border border-white/10 bg-black/20 p-6 backdrop-blur-sm transition-all hover:border-white/20"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-heading text-xl font-bold">{exercise.name}</h3>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${getCategoryColor(exercise.category)}`}
                    >
                      {exercise.category}
                    </span>
                  </div>

                  {/* Muscle Groups */}
                  <div className="mb-4">
                    <p className="mb-2 text-xs font-medium uppercase text-white/60">
                      Muscle Groups
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {exercise.muscleGroups.map((mg, idx) => (
                        <span
                          key={idx}
                          className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80"
                        >
                          {mg}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Equipment */}
                  {exercise.defaultEquipment.length > 0 && (
                    <div className="mb-4">
                      <p className="mb-2 text-xs font-medium uppercase text-white/60">Equipment</p>
                      <div className="flex flex-wrap gap-2">
                        {exercise.defaultEquipment.map((eq, idx) => (
                          <span
                            key={idx}
                            className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/70"
                          >
                            {eq}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Video URL */}
                  {exercise.videoUrl && (
                    <div className="mb-4">
                      <a
                        href={exercise.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[#ffbf00] hover:underline"
                      >
                        View Video →
                      </a>
                    </div>
                  )}

                  {/* Delete Button */}
                  <div className="border-t border-white/10 pt-4">
                    <button
                      onClick={() => handleDelete(exercise.id)}
                      className="w-full rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
                    >
                      <Trash2 className="mr-2 inline h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ============ GENERATED EXERCISES TAB ============ */}
      {activeTab === 'generated' && (
        <>
          {/* Header with actions */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Refresh & Status Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fetchGeneratedExercises()}
                disabled={generatedLoading}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                title="Refresh list (e.g. after saving from WOD Engine)"
              >
                {generatedLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span>Refresh</span>
              </button>
              {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                    statusFilter === status
                      ? 'bg-white/20 text-white'
                      : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {/* Generate New Button */}
            <Link
              to="/exercise-image-gen"
              className="flex items-center gap-2 rounded-lg bg-[#ffbf00] px-4 py-2 font-medium text-black transition-colors hover:bg-[#ffbf00]/90"
            >
              <Sparkles className="h-5 w-5" />
              <span>Generate New Exercise</span>
            </Link>
          </div>

          {/* Error Message */}
          {generatedError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-300">
              {generatedError}
            </div>
          )}

          {/* Loading State */}
          {generatedLoading && (
            <div className="rounded-lg border border-white/10 bg-black/20 p-12 text-center backdrop-blur-sm">
              <p className="text-white/60">Loading generated exercises...</p>
            </div>
          )}

          {/* Empty State */}
          {!generatedLoading && generatedExercises.length === 0 && (
            <div className="rounded-lg border border-white/10 bg-black/20 p-12 text-center backdrop-blur-sm">
              <Image className="mx-auto mb-4 h-12 w-12 text-white/30" />
              <p className="text-white/60">
                {statusFilter === 'all'
                  ? 'No generated exercises yet. Create your first one!'
                  : `No ${statusFilter} exercises found.`}
              </p>
              <Link
                to="/exercise-image-gen"
                className="mt-4 inline-flex items-center gap-2 text-[#ffbf00] hover:underline"
              >
                <Sparkles className="h-4 w-4" />
                Generate Exercise
              </Link>
            </div>
          )}

          {/* Generated Exercises Grid */}
          {!generatedLoading && generatedExercises.length > 0 && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {generatedExercises.map((exercise) => (
                <div
                  key={exercise.id}
                  className="group rounded-lg border border-white/10 bg-black/20 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-black/30"
                >
                  <Link to={`/exercises/${exercise.slug}`} className="block">
                    {/* Image Thumbnail */}
                    <div className="relative aspect-video w-full overflow-hidden rounded-t-lg bg-black/40">
                      {exercise.imageUrl ? (
                        <img
                          src={exercise.imageUrl}
                          alt={exercise.exerciseName}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Image className="h-12 w-12 text-white/20" />
                        </div>
                      )}
                      {/* Status Badge: show "Published" when approved */}
                      <span
                        className={`absolute right-2 top-2 rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${getStatusColor(exercise.status)}`}
                      >
                        {exercise.status === 'approved' ? 'Published' : exercise.status}
                      </span>
                    </div>

                    {/* Card Content */}
                    <div className="p-4">
                      <h3 className="font-heading text-lg font-bold group-hover:text-[#ffbf00]">
                        {exercise.exerciseName}
                      </h3>

                      {/* Kinetic Chain Type */}
                      {exercise.kineticChainType && (
                        <span className="mt-2 inline-block rounded bg-white/10 px-2 py-0.5 font-mono text-xs text-white/70">
                          {exercise.kineticChainType}
                        </span>
                      )}

                      {/* Generated Date */}
                      <p className="mt-3 text-xs text-white/50">
                        Generated {formatDate(exercise.generatedAt)}
                      </p>

                      {/* View Details Link */}
                      <div className="mt-3 flex items-center gap-1 text-sm text-[#ffbf00] group-hover:underline">
                        View Details
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </Link>

                  {/* Publish / Unpublish actions */}
                  <div className="flex items-center justify-end gap-2 border-t border-white/10 p-3">
                    {exercise.status === 'approved' ? (
                      <button
                        type="button"
                        onClick={() => handleUnpublishExercise(exercise.id)}
                        disabled={publishingExerciseId === exercise.id}
                        className="rounded-lg p-2 text-white/70 transition-colors hover:bg-yellow-500/20 hover:text-yellow-300 disabled:opacity-50"
                        title="Unpublish exercise"
                      >
                        {publishingExerciseId === exercise.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePublishExercise(exercise.id)}
                        disabled={publishingExerciseId === exercise.id}
                        className="rounded-lg p-2 text-white/70 transition-colors hover:bg-green-500/20 hover:text-green-300 disabled:opacity-50"
                        title="Publish exercise"
                      >
                        {publishingExerciseId === exercise.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ManageExercises;
