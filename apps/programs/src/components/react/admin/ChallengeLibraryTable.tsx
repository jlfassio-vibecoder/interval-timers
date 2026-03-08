/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Edit, Trash2, Loader2, AlertCircle, Upload, EyeOff } from 'lucide-react';
import {
  fetchChallengeLibrary,
  fetchFullChallenge,
  deleteChallenge,
  updateChallengeStatus,
} from '@/lib/supabase/client/challenge-persistence';
import type { ChallengeLibraryItem, ChallengeTemplate } from '@/types/ai-challenge';
import { getAllZones } from '@/lib/supabase/client/equipment';
import DeleteProgramModal from './DeleteProgramModal';

interface ChallengeLibraryTableProps {
  /** Optional: when provided, Edit opens modal. When omitted, Edit links to full-page editor. */
  onEdit?: (challenge: ChallengeTemplate, challengeId: string) => void;
  onDelete?: (challengeId: string) => Promise<void>;
}

const ChallengeLibraryTable: React.FC<ChallengeLibraryTableProps> = ({ onEdit, onDelete }) => {
  const [challenges, setChallenges] = useState<ChallengeLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [challengeToDelete, setChallengeToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [zonesMap, setZonesMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    fetchChallenges();
    fetchZones();
  }, []);

  const fetchZones = async () => {
    try {
      const zonesData = await getAllZones();
      const map = new Map<string, string>();
      zonesData.forEach((zone) => map.set(zone.id, zone.name));
      setZonesMap(map);
    } catch (err) {
      console.error('[ChallengeLibraryTable] Error fetching zones:', err);
    }
  };

  const fetchChallenges = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchChallengeLibrary();
      const validChallenges = data.filter((c) => c && c.id && c.title);
      setChallenges(validChallenges);
    } catch (err) {
      console.error('[ChallengeLibraryTable] Error fetching challenges:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch challenges');
      setChallenges([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (challengeId: string) => {
    if (onEdit) {
      try {
        setError(null);
        const fullChallenge = await fetchFullChallenge(challengeId);
        onEdit(fullChallenge, challengeId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load challenge for editing');
      }
    }
  };

  const handleDelete = (challengeId: string, challengeTitle: string) => {
    setChallengeToDelete({ id: challengeId, title: challengeTitle });
    setDeleteModalOpen(true);
  };

  const handlePublish = async (challengeId: string) => {
    try {
      setPublishingId(challengeId);
      setError(null);
      await updateChallengeStatus(challengeId, 'published');
      await fetchChallenges();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish challenge');
    } finally {
      setPublishingId(null);
    }
  };

  const handleUnpublish = async (challengeId: string) => {
    try {
      setPublishingId(challengeId);
      setError(null);
      await updateChallengeStatus(challengeId, 'draft');
      await fetchChallenges();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unpublish challenge');
    } finally {
      setPublishingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!challengeToDelete) return;

    try {
      setDeletingId(challengeToDelete.id);
      setError(null);

      if (onDelete) {
        await onDelete(challengeToDelete.id);
      } else {
        await deleteChallenge(challengeToDelete.id);
      }

      await fetchChallenges();
      setDeleteModalOpen(false);
      setChallengeToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete challenge');
    } finally {
      setDeletingId(null);
    }
  };

  const formatPersona = (item: ChallengeLibraryItem): string => {
    const { targetAudience } = item;
    if (!targetAudience) return 'N/A';
    const level = targetAudience.experienceLevel
      ? targetAudience.experienceLevel.charAt(0).toUpperCase() +
        targetAudience.experienceLevel.slice(1)
      : 'Unknown';
    const sex = targetAudience.sex || 'Unknown';
    return `${sex}, ${level}`;
  };

  const formatEquipment = (item: ChallengeLibraryItem): string => {
    if (!item.equipmentProfile?.zoneId) return 'N/A';
    return zonesMap.get(item.equipmentProfile.zoneId) || item.equipmentProfile.zoneId;
  };

  const filteredChallenges = challenges.filter((c) => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-orange-light" />
        <span className="ml-3 text-white/60">Loading challenges...</span>
      </div>
    );
  }

  if (error && challenges.length === 0) {
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
        {error && challenges.length > 0 && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
      </div>

      {filteredChallenges.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-black/20 p-12 text-center backdrop-blur-sm">
          <p className="text-lg font-medium text-white/90">
            {filter === 'all' ? 'No challenges yet' : `No ${filter} challenges`}
          </p>
          <p className="mt-2 text-white/60">
            {filter === 'all'
              ? 'Create your first challenge to get started. New trainers often start with an empty list.'
              : `Try "All" or create a new challenge.`}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/20 backdrop-blur-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 text-left text-sm font-medium text-white/80">Title</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-white/80">Theme</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-white/80">
                  Target Persona
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-white/80">Duration</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-white/80">Equipment</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-white/80">Status</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-white/80">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredChallenges.map((challenge) => {
                if (!challenge || !challenge.id) return null;
                return (
                  <tr key={challenge.id} className="transition-colors hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">
                        {challenge.title || 'Untitled Challenge'}
                      </div>
                      {challenge.description && (
                        <div className="mt-1 line-clamp-1 text-sm text-white/60">
                          {challenge.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-white/80">{challenge.theme || '—'}</td>
                    <td className="px-4 py-3 text-sm text-white/80">{formatPersona(challenge)}</td>
                    <td className="px-4 py-3 text-sm text-white/80">
                      {challenge.durationWeeks || 0} weeks
                    </td>
                    <td className="px-4 py-3 text-sm text-white/80">
                      {formatEquipment(challenge)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          challenge.status === 'published'
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-yellow-500/20 text-yellow-300'
                        }`}
                      >
                        {challenge.status || 'draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {challenge.status === 'draft' ? (
                          <button
                            onClick={() => handlePublish(challenge.id)}
                            disabled={publishingId === challenge.id}
                            className="rounded-lg p-2 text-white/70 transition-colors hover:bg-green-500/20 hover:text-green-300 disabled:opacity-50"
                            title="Publish challenge"
                          >
                            {publishingId === challenge.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUnpublish(challenge.id)}
                            disabled={publishingId === challenge.id}
                            className="rounded-lg p-2 text-white/70 transition-colors hover:bg-yellow-500/20 hover:text-yellow-300 disabled:opacity-50"
                            title="Unpublish challenge"
                          >
                            {publishingId === challenge.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        {onEdit ? (
                          <button
                            onClick={() => handleEdit(challenge.id)}
                            className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-orange-light"
                            title="Edit challenge"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        ) : (
                          <Link
                            to={challenge.id}
                            className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-orange-light"
                            title="Edit challenge"
                          >
                            <Edit className="h-4 w-4" />
                          </Link>
                        )}
                        <button
                          onClick={() =>
                            handleDelete(challenge.id, challenge.title || 'Untitled Challenge')
                          }
                          disabled={deletingId === challenge.id}
                          className="rounded-lg p-2 text-white/70 transition-colors hover:bg-red-500/20 hover:text-red-300 disabled:opacity-50"
                          title="Delete challenge"
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

      <DeleteProgramModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setChallengeToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        programTitle={challengeToDelete?.title || 'Untitled Challenge'}
        isDeleting={deletingId === challengeToDelete?.id}
      />
    </div>
  );
};

export default ChallengeLibraryTable;
