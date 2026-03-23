/**
 * Optional recap modal shown once when the workout finishes.
 * Primary action "Continue" dismisses the recap and keeps the user in the live session.
 * Other actions: View in History, View results (when onViewResults provided), Copy results.
 * Optionally shows "Continue on phone" QR when recoveryUrl is provided.
 */
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { HUD_REDIRECT_URL } from '@/lib/account-redirect-url';

export interface PostWorkoutRecapModalProps {
  isOpen: boolean;
  onClose: () => void;
  myRounds: number;
  durationMinutes: number;
  onCopyResults: () => void;
  /** When provided, shows "View results" button that closes recap and opens the results modal */
  onViewResults?: () => void;
  /** When provided, shows "Continue on phone" section with QR code and copy link */
  recoveryUrl?: string | null;
  /** When true, shows "Sign in to save sessions to your History" CTA for guests */
  showSignInCta?: boolean;
  /** Called when guest taps sign-in CTA; use to open auth modal */
  onSignInClick?: () => void;
}

export default function PostWorkoutRecapModal({
  isOpen,
  onClose,
  myRounds,
  durationMinutes,
  onCopyResults,
  onViewResults,
  recoveryUrl = null,
  showSignInCta = false,
  onSignInClick,
}: PostWorkoutRecapModalProps) {
  const [recoveryCopyToast, setRecoveryCopyToast] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleContinue = () => {
    onClose();
  };

  const handleViewInHistory = () => {
    onClose();
    // Append hud=1 so account page opens with HUD visible (HistoryZone + AMRAP results).
    const url = new URL(HUD_REDIRECT_URL);
    url.searchParams.set('hud', '1');
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  };

  const handleViewResults = () => {
    onClose();
    onViewResults?.();
  };

  const handleCopyResults = () => {
    onCopyResults();
  };

  const handleCopyRecoveryLink = async () => {
    if (!recoveryUrl) return;
    try {
      await navigator.clipboard.writeText(recoveryUrl);
      setRecoveryCopyToast('success');
      setTimeout(() => setRecoveryCopyToast(null), 2000);
    } catch {
      setRecoveryCopyToast('error');
      setTimeout(() => setRecoveryCopyToast(null), 2000);
    }
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
        {showSignInCta && onSignInClick && (
          <div className="mb-4 rounded-xl border border-orange-500/30 bg-orange-600/10 p-4">
            <p className="mb-2 text-sm text-white/90">
              Sign in to save sessions to your History across devices.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onSignInClick();
              }}
              className="rounded-lg border border-orange-500/50 bg-orange-600/30 px-3 py-2 text-sm font-bold text-orange-200 transition-colors hover:bg-orange-600/50"
            >
              Sign in
            </button>
          </div>
        )}
        <p className="mb-6 text-white/80">
          {myRounds > 0
            ? `You did ${myRounds} round${myRounds === 1 ? '' : 's'} in ${durationMinutes} min.`
            : `${durationMinutes} min AMRAP completed.`}
        </p>

        {recoveryUrl && (
          <div className="mb-6 rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="mb-3 text-sm font-bold text-white/90">
              Continue on phone
            </p>
            <p className="mb-3 text-xs text-white/70">
              Scan with your phone to capture heart rate and recovery metrics.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <div className="flex-shrink-0 rounded-lg border border-white/10 bg-white p-2">
                <QRCodeSVG value={recoveryUrl} size={120} level="M" />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <button
                  type="button"
                  onClick={handleCopyRecoveryLink}
                  className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-white/20"
                >
                  Copy link
                </button>
                {recoveryCopyToast && (
                  <p
                    role="status"
                    aria-live="polite"
                    className={`text-xs font-medium ${
                      recoveryCopyToast === 'success' ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {recoveryCopyToast === 'success' ? 'Copied!' : 'Failed to copy'}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleContinue}
            className="rounded-xl border-2 border-orange-500 bg-orange-600 px-4 py-3 font-bold text-white transition-colors hover:bg-orange-500"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={handleViewInHistory}
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 font-bold text-white transition-colors hover:bg-white/20"
          >
            View in History
          </button>
          {onViewResults != null && (
            <button
              type="button"
              onClick={handleViewResults}
              className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 font-bold text-white transition-colors hover:bg-white/20"
            >
              View results
            </button>
          )}
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
