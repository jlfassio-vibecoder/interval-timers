/**
 * Mission Control — AI Workout Factory (saves to public.workouts, not workout_sets).
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import WorkoutGeneratorModal from '@/components/react/admin/WorkoutGeneratorModal';

const TrainerWorkoutFactoryView: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-5xl pb-12">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-bold">Workout Factory</h1>
        <p className="mt-2 text-white/60">
          Generate AI programming and save it to your private workout library.
        </p>
      </header>
      <WorkoutGeneratorModal
        isOpen
        layout="page"
        saveTarget="trainer"
        onClose={() => navigate('/')}
        onGenerate={() => {
          /* optional refresh */
        }}
      />
    </div>
  );
};

export default TrainerWorkoutFactoryView;
