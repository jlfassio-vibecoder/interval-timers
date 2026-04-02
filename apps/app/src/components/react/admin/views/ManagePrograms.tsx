/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { createProgram } from '@/lib/supabase/admin/programs';
import type { ProgramLibraryItem } from '@/lib/supabase/admin/programs';
import { useAppContext } from '@/contexts/AppContext';
import ProgramLibraryTable from '../ProgramLibraryTable';
import ProgramGeneratorModal from '../ProgramGeneratorModal';
import type { ProgramTemplate } from '@/types/ai-program';

const ManagePrograms: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAppContext();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);

  const handleCreateProgram = async () => {
    if (!user?.uid) return;
    try {
      setIsCreating(true);
      const newProgram = await createProgram({
        title: 'New Program',
        trainer_id: user.uid,
      });
      navigate(`/programs/${newProgram.id}`);
    } catch (err) {
      console.error('Failed to create program:', err);
      toast.error('Failed to create program.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleGenerate = (
    _programData: Omit<ProgramTemplate, 'id' | 'createdAt'>,
    savedProgramId?: string
  ) => {
    if (savedProgramId) {
      setRefreshKey((k) => k + 1);
      navigate(`/programs/${savedProgramId}`);
    }
    setGeneratorOpen(false);
  };

  const handleEdit = (_program: ProgramLibraryItem | null, programId: string) => {
    navigate(`/programs/${programId}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold">Program Factory</h1>
          <p className="mt-2 text-white/60">Create and manage fitness programs</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2 font-medium text-white transition-colors hover:bg-white/10"
            title="Refresh list"
          >
            <RefreshCw className="h-5 w-5" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setGeneratorOpen(true)}
            className="border-orange-light/50 bg-orange-light/10 hover:bg-orange-light/20 flex items-center gap-2 rounded-lg border px-4 py-2 font-medium text-orange-light transition-colors"
          >
            <Sparkles className="h-5 w-5" />
            <span>Generate with AI</span>
          </button>
          <button
            onClick={handleCreateProgram}
            disabled={isCreating}
            className="hover:bg-orange-light/90 flex items-center gap-2 rounded-lg bg-orange-light px-4 py-2 font-medium text-black transition-colors disabled:opacity-50"
          >
            <Plus className="h-5 w-5" />
            <span>{isCreating ? 'Creating...' : 'New Program'}</span>
          </button>
        </div>
      </div>

      <ProgramLibraryTable key={refreshKey} onEdit={handleEdit} />

      <ProgramGeneratorModal
        isOpen={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
        onGenerate={handleGenerate}
      />
    </div>
  );
};

export default ManagePrograms;
