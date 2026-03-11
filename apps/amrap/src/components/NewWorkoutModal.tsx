import { useEffect } from 'react';
import WorkoutPicker from './WorkoutPicker';

export interface NewWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (workoutList: string[], durationMinutes: number) => void;
  isHost: boolean;
}

export default function NewWorkoutModal({
  isOpen,
  onClose,
  onSelect,
  isHost,
}: NewWorkoutModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isHost) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, isHost]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-workout-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d0500] p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 id="new-workout-modal-title" className="mb-4 text-xl font-bold text-white">
          New Workout
        </h2>
        {isHost ? (
          <WorkoutPicker
            onSelect={(workoutList, durationMinutes) => {
              onSelect(workoutList, durationMinutes);
              onClose();
            }}
            onCancel={onClose}
          />
        ) : (
          <p className="text-white/80">
            Host is selecting a new workout…
          </p>
        )}
      </div>
    </div>
  );
}
