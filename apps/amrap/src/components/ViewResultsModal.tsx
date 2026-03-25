/**
 * Modal that displays the workout results text before copying or sharing.
 * Shows the same content that "Copy results" would copy to the clipboard.
 */
import { useEffect } from 'react';
import { X } from 'lucide-react';
import RoundConsistencyChart from './RoundConsistencyChart';

export interface ViewResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  resultsText: string;
  onCopy: () => void;
  onSaveResults?: () => void;
  copyToast?: 'success' | 'error' | null;
  roundDurations?: number[];
  showAccountCta?: boolean;
  onSignIn?: () => void;
  onSignUp?: () => void;
}

export default function ViewResultsModal({
  isOpen,
  onClose,
  resultsText,
  onCopy,
  onSaveResults,
  copyToast,
  roundDurations = [],
  showAccountCta = false,
  onSignIn,
  onSignUp,
}: ViewResultsModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="view-results-modal-title"
      onClick={handleBackdropClick}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0d0500] p-6 shadow-xl"
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

        <h2 id="view-results-modal-title" className="mb-3 pr-8 text-xl font-bold text-white">
          Your results
        </h2>
        <p className="mb-4 text-sm text-white/70">Share, copy, or save this summary.</p>
        {showAccountCta && (
          <div className="mb-4 rounded-xl border border-orange-500/30 bg-orange-600/10 p-3">
            <p className="mb-2 text-sm text-white/90">
              Create an account to save and track results in your history.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onSignIn}
                className="rounded-lg border border-orange-500/50 bg-orange-600/30 px-3 py-2 text-sm font-bold text-orange-200 transition-colors hover:bg-orange-600/50"
              >
                Sign in
              </button>
              {onSignUp && (
                <button
                  type="button"
                  onClick={onSignUp}
                  className="rounded-lg border border-orange-500/50 bg-orange-600/30 px-3 py-2 text-sm font-bold text-orange-200 transition-colors hover:bg-orange-600/50"
                >
                  Sign up
                </button>
              )}
            </div>
          </div>
        )}

        {roundDurations.length > 0 && (
          <RoundConsistencyChart roundDurations={roundDurations} />
        )}

        <pre
          className="mb-6 max-h-48 overflow-y-auto rounded-xl border border-white/20 bg-black/30 p-4 text-sm text-white/90 whitespace-pre-wrap break-words font-sans"
          role="article"
        >
          {resultsText}
        </pre>

        {copyToast && (
          <p
            role="status"
            aria-live="polite"
            className={`mb-4 text-sm font-medium ${
              copyToast === 'success' ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {copyToast === 'success' ? 'Copied to clipboard!' : 'Failed to copy'}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-w-[8rem] flex-1 rounded-xl border border-white/20 px-4 py-3 font-bold text-white/80 transition-colors hover:bg-white/10"
          >
            Close
          </button>
          {onSaveResults && (
            <button
              type="button"
              onClick={onSaveResults}
              className="min-w-[10rem] flex-1 rounded-xl border-2 border-white/20 bg-white/10 px-4 py-3 font-bold text-white transition-colors hover:bg-white/20"
            >
              Save results
            </button>
          )}
          <button
            type="button"
            onClick={onCopy}
            className="min-w-[10rem] flex-1 rounded-xl border-2 border-orange-500 bg-orange-600 px-4 py-3 font-bold text-white transition-colors hover:bg-orange-500"
          >
            Copy results
          </button>
        </div>
      </div>
    </div>
  );
}
