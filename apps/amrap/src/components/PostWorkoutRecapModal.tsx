/**
 * Optional recap modal shown once when the workout finishes.
 * Shows summary and actions: Done, View in History, Copy results.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { HUD_REDIRECT_URL } from '@/lib/account-redirect-url';

export interface PostWorkoutRecapModalProps {
  isOpen: boolean;
  onClose: () => void;
  myRounds: number;
  durationMinutes: number;
  onCopyResults: () => void;
}

export default function PostWorkoutRecapModal({
  isOpen,
  onClose,
  myRounds,
  durationMinutes,
  onCopyResults,
}: PostWorkoutRecapModalProps) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDone = () => {
    onClose();
    navigate('/with-friends');
  };

  const handleViewInHistory = () => {
    onClose();
    window.open(HUD_REDIRECT_URL, '_blank', 'noopener,noreferrer');
  };

  const handleCopyResults = () => {
    onCopyResults();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recap-modal-title"
      onClick={handleBackdropClick}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0500] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 id="recap-modal-title" className="mb-2 pr-8 text-xl font-bold text-white">
          Workout complete!
        </h2>
        <p className="mb-6 text-white/80">
          {myRounds > 0
            ? `You did ${myRounds} round${myRounds === 1 ? '' : 's'} in ${durationMinutes} min.`
            : `${durationMinutes} min AMRAP completed.`}
        </p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleDone}
            className="rounded-xl border-2 border-orange-500 bg-orange-600 px-4 py-3 font-bold text-white transition-colors hover:bg-orange-500"
          >
            Done
          </button>
          <button
            type="button"
            onClick={handleViewInHistory}
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 font-bold text-white transition-colors hover:bg-white/20"
          >
            View in History
          </button>
          <button
            type="button"
            onClick={handleCopyResults}
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 font-bold text-white transition-colors hover:bg-white/20"
          >
            Copy results
          </button>
        </div>
      </div>
    </div>
  );
}
