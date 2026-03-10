/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Edit, Trash2, Loader2, AlertCircle, Upload, EyeOff } from 'lucide-react';
import {
  fetchWorkoutLibrary,
  deleteWorkout,
  updateWorkoutStatus,
} from '@/lib/supabase/client/workout-persistence';
import type { WorkoutLibraryItem } from '@/types/ai-workout';
import { getAllZones } from '@/lib/supabase/client/equipment';

interface WorkoutLibraryTableProps {
  /** Optional: called when AI modal edit is triggered. When omitted, Edit links to full-page editor. */
  onEdit?: (workoutId: string) => void;
}

const WorkoutLibraryTable: React.FC<WorkoutLibraryTableProps> = ({ onEdit }) => {
  const [workouts, setWorkouts] = useState<WorkoutLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [zonesMap, setZonesMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    fetchWorkouts();
    fetchZones();
  }, []);

  const fetchZones = async () => {
    try {
      const zonesData = await getAllZones();
      const map = new Map<string, string>();
      zonesData.forEach((zone) => map.set(zone.id, zone.name));
      setZonesMap(map);
    } catch (err) {
      console.error('[WorkoutLibraryTable] Error fetching zones:', err);
    }
  };

  const fetchWorkouts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchWorkoutLibrary();
      const valid = data.filter((w) => w && w.id && w.title);
      setWorkouts(valid);
    } catch (err) {
      console.error('[WorkoutLibraryTable] Error fetching workouts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch workouts');
      setWorkouts([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (workoutId: string) => {
    try {
      setPublishingId(workoutId);
      setError(null);
      await updateWorkoutStatus(workoutId, 'published');
      await fetchWorkouts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish workout');
    } finally {
      setPublishingId(null);
    }
  };

  const handleUnpublish = async (workoutId: string) => {
    try {
      setPublishingId(workoutId);
      setError(null);
      await updateWorkoutStatus(workoutId, 'draft');
      await fetchWorkouts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unpublish workout');
    } finally {
      setPublishingId(null);
    }
  };

  const handleDelete = async (workoutId: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      setDeletingId(workoutId);
      setError(null);
      await deleteWorkout(workoutId);
      await fetchWorkouts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete workout');
    } finally {
      setDeletingId(null);
    }
  };

  const formatPersona = (item: WorkoutLibraryItem): string => {
    const { targetAudience } = item;
    if (!targetAudience) return 'N/A';
    const level = targetAudience.experienceLevel
      ? targetAudience.experienceLevel.charAt(0).toUpperCase() +
        targetAudience.experienceLevel.slice(1)
      : 'Unknown';
    const sex = targetAudience.sex || 'Unknown';
    return `${sex}, ${level}`;
  };

  const formatEquipment = (item: WorkoutLibraryItem): string => {
    if (!item.equipmentProfile?.zoneId) return 'N/A';
    return zonesMap.get(item.equipmentProfile.zoneId) || item.equipmentProfile.zoneId;
  };

  const filtered = workouts.filter((w) => (filter === 'all' ? true : w.status === filter));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-orange-light" />
        <span className="ml-3 text-white/60">Loading workouts...</span>
      </div>
    );
  }

  if (error && workouts.length === 0) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-300">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-white/80">Filter:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'draft' | 'published')}
            className="focus:border-orange-light/50 focus:ring-orange-light/20 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white focus:outline-none focus:ring-2"
          >
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
        {error && workouts.length > 0 && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-black/20 p-12 text-center backdrop-blur-sm">
          <p className="text-lg font-medium text-white/90">
            {filter === 'all' ? 'No workouts yet' : `No ${filter} workouts`}
          </p>
          <p className="mt-2 text-white/60">
            {filter === 'all'
              ? 'Generate your first workout set to get started. New trainers often start with an empty list.'
              : 'Try "All" or generate a new workout set.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/20 backdrop-blur-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 text-left text-sm font-medium text-white/80">Title</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-white/80">
                  Target Persona
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-white/80">Sessions</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-white/80">Equipment</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-white/80">Status</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-white/80">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((item) => {
                if (!item?.id) return null;
                return (
                  <tr key={item.id} className="transition-colors hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">
                        {item.title || 'Untitled Workout Set'}
                      </div>
                      {item.description && (
                        <div className="mt-1 line-clamp-1 text-sm text-white/60">
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-white/80">{formatPersona(item)}</td>
                    <td className="px-4 py-3 text-sm text-white/80">
                      {item.workoutCount ?? 0} workout(s)
                    </td>
                    <td className="px-4 py-3 text-sm text-white/80">{formatEquipment(item)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          item.status === 'published'
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-yellow-500/20 text-yellow-300'
                        }`}
                      >
                        {item.status || 'draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {item.status === 'published' ? (
                          <button
                            onClick={() => handleUnpublish(item.id)}
                            disabled={publishingId === item.id}
                            className="rounded-lg p-2 text-white/70 transition-colors hover:bg-yellow-500/20 hover:text-yellow-300 disabled:opacity-50"
                            title="Unpublish workout"
                          >
                            {publishingId === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePublish(item.id)}
                            disabled={publishingId === item.id}
                            className="rounded-lg p-2 text-white/70 transition-colors hover:bg-green-500/20 hover:text-green-300 disabled:opacity-50"
                            title="Publish workout"
                          >
                            {publishingId === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        {onEdit ? (
                          <button
                            onClick={() => onEdit(item.id)}
                            className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-orange-light"
                            title="Edit workout"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        ) : (
                          <Link
                            to={item.id}
                            className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-orange-light"
                            title="Edit workout"
                          >
                            <Edit className="h-4 w-4" />
                          </Link>
                        )}
                        <button
                          onClick={() =>
                            handleDelete(item.id, item.title || 'Untitled Workout Set')
                          }
                          disabled={deletingId === item.id}
                          className="rounded-lg p-2 text-white/70 transition-colors hover:bg-red-500/20 hover:text-red-300 disabled:opacity-50"
                          title="Delete workout"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default WorkoutLibraryTable;
