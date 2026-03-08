/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Edit, Trash2, Loader2 } from 'lucide-react';
import { fetchPrograms, deleteProgram } from '@/lib/supabase/admin/programs';
import type { ProgramLibraryItem } from '@/lib/supabase/admin/programs';
import { useAppContext } from '@/contexts/AppContext';
import DeleteProgramModal from './DeleteProgramModal';

interface ProgramLibraryTableProps {
  onEdit: (program: ProgramLibraryItem | null, programId: string) => void;
  onDelete?: (programId: string) => Promise<void>;
}

const ProgramLibraryTable: React.FC<ProgramLibraryTableProps> = ({ onEdit, onDelete }) => {
  const { user } = useAppContext();
  const [programs, setPrograms] = useState<ProgramLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'draft' | 'active'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [programToDelete, setProgramToDelete] = useState<{ id: string; title: string } | null>(
    null
  );

  useEffect(() => {
    if (user?.uid) {
      loadPrograms();
    }
  }, [user]);

  const loadPrograms = async () => {
    if (!user?.uid) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchPrograms(user.uid);
      setPrograms(data);
    } catch (err) {
      console.error('[ProgramLibraryTable] Error fetching programs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch programs');
      setPrograms([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (programId: string) => {
    // Navigate to editor page usually handled by parent or router
    // Here we just pass the ID up
    onEdit(null, programId);
  };

  const handleDeleteRequest = (programId: string, programTitle: string) => {
    setProgramToDelete({ id: programId, title: programTitle });
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!programToDelete) return;
    try {
      setDeletingId(programToDelete.id);
      await deleteProgram(programToDelete.id);
      await onDelete?.(programToDelete.id);
      await loadPrograms();
      setDeleteModalOpen(false);
      setProgramToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete program');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredPrograms = programs.filter((program) => {
    if (filter === 'all') return true;
    return program.status === filter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-orange-light" />
        <span className="ml-3 text-white/60">Loading programs...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter and Error */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-white/80">Filter:</label>
          <select
            value={filter}
            onChange={(e) => setFilter((e.target.value as 'all' | 'draft' | 'active') || 'all')}
            className="focus:border-orange-light/50 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white focus:outline-none"
          >
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
          </select>
        </div>
        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
      </div>

      {/* Table */}
      {filteredPrograms.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-black/20 p-12 text-center backdrop-blur-sm">
          <p className="text-white/60">
            {filter === 'all'
              ? 'No programs yet. Create your first program from the generator or editor.'
              : `No ${filter} programs found.`}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/20 backdrop-blur-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 text-white/60">
                <th className="px-6 py-4 font-medium">Title</th>
                <th className="px-6 py-4 font-medium">Difficulty</th>
                <th className="px-6 py-4 font-medium">Duration</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredPrograms.map((program) => (
                <tr key={program.id} className="transition-colors hover:bg-white/5">
                  <td className="px-6 py-4">
                    <div className="font-medium text-white">{program.title}</div>
                    {program.description && (
                      <div className="line-clamp-1 text-sm text-white/40">
                        {program.description}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 capitalize text-white/80">{program.difficulty}</td>
                  <td className="px-6 py-4 text-white/80">{program.durationWeeks} Weeks</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium capitalize ${
                        program.status === 'active'
                          ? 'bg-green-500/20 text-green-300'
                          : 'bg-yellow-500/20 text-yellow-300'
                      }`}
                    >
                      {program.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(program.id)}
                        className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-orange-light"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteRequest(program.id, program.title)}
                        className="rounded-lg p-2 text-white/60 hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Safe Deletion Modal */}
      <DeleteProgramModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setProgramToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        programTitle={programToDelete?.title || 'Untitled Program'}
        isDeleting={deletingId === programToDelete?.id}
      />
    </div>
  );
};

export default ProgramLibraryTable;
