/**
 * Modal showing recovery PWA QR code and copy link.
 * Used when user dismisses PostWorkoutRecapModal but still wants to access the phone flow.
 */
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export interface RecoveryQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  recoveryUrl: string;
}

export default function RecoveryQrModal({
  isOpen,
  onClose,
  recoveryUrl,
}: RecoveryQrModalProps) {
  const [copyToast, setCopyToast] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(recoveryUrl);
      setCopyToast('success');
      setTimeout(() => setCopyToast(null), 2000);
    } catch {
      setCopyToast('error');
      setTimeout(() => setCopyToast(null), 2000);
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
      aria-labelledby="recovery-qr-modal-title"
      onClick={handleBackdropClick}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d0500] p-6 shadow-xl"
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

        <h2 id="recovery-qr-modal-title" className="mb-2 pr-8 text-lg font-bold text-white">
          Continue on phone
        </h2>
        <p className="mb-4 text-sm text-white/70">
          Scan with your phone to capture heart rate and recovery metrics.
        </p>

        <div className="flex flex-col items-center gap-4">
          <div className="flex-shrink-0 rounded-lg border border-white/10 bg-white p-2">
            <QRCodeSVG value={recoveryUrl} size={160} level="M" />
          </div>
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-white/20"
          >
            Copy link
          </button>
          {copyToast && (
            <p
              role="status"
              aria-live="polite"
              className={`text-sm font-medium ${
                copyToast === 'success' ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {copyToast === 'success' ? 'Copied!' : 'Failed to copy'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
