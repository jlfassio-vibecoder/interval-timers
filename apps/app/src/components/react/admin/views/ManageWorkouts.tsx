/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { WorkoutSetTemplate, WorkoutConfig, WorkoutChainMetadata } from '@/types/ai-workout';
import WorkoutLibraryTable from '../WorkoutLibraryTable';
import WorkoutGeneratorModal from '../WorkoutGeneratorModal';

const ManageWorkouts: React.FC = () => {
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutSetTemplate | null>(null);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [editingWorkoutConfig, setEditingWorkoutConfig] = useState<WorkoutConfig | null>(null);
  const [editingChainMetadata, setEditingChainMetadata] = useState<WorkoutChainMetadata | null>(
    null
  );
  const [refreshKey, setRefreshKey] = useState(0);

  const handleNewWorkout = () => {
    setEditingWorkout(null);
    setEditingWorkoutId(null);
    setEditingWorkoutConfig(null);
    setEditingChainMetadata(null);
    setShowGeneratorModal(true);
  };

  const handleCloseModal = () => {
    setShowGeneratorModal(false);
    setEditingWorkout(null);
    setEditingWorkoutId(null);
    setEditingWorkoutConfig(null);
    setEditingChainMetadata(null);
    setRefreshKey((prev) => prev + 1);
  };

  const handleGenerate = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold">Workout Factory</h1>
          <p className="mt-2 text-white/60">Create and manage workout sets (splits, two-a-days)</p>
        </div>
        <button
          onClick={handleNewWorkout}
          className="hover:bg-orange-light/90 flex items-center gap-2 rounded-lg bg-orange-light px-4 py-2 font-medium text-black transition-colors"
        >
          <Sparkles className="h-5 w-5" />
          <span>Generate Workout</span>
        </button>
      </div>

      <WorkoutLibraryTable key={refreshKey} />

      <WorkoutGeneratorModal
        isOpen={showGeneratorModal}
        onClose={handleCloseModal}
        onGenerate={handleGenerate}
        existingWorkout={editingWorkout ?? undefined}
        workoutConfig={editingWorkoutConfig ?? undefined}
        editingWorkoutId={editingWorkoutId ?? undefined}
        editingChainMetadata={editingChainMetadata ?? undefined}
      />
    </div>
  );
};

export default ManageWorkouts;
