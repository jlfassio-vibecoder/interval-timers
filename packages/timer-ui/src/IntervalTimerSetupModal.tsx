/**
 * Reusable setup modal for interval timers (Tabata, Mindful, EMOM, etc.).
 * Rendered via portal into document.body so fixed positioning is viewport-relative
 * even when the parent page has backdrop-filter/transform (e.g. interval-timers section).
 * Uses dialog semantics (role="dialog", aria-modal, aria-labelledby/describedby),
 * Escape-to-close, and initial focus for keyboard/screen-reader accessibility.
 */
import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

export type SetupModalStep = 'protocol' | 'workout';

export interface IntervalTimerSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  step: SetupModalStep;
  protocolTitle: string;
  protocolSubtitle: string;
  workoutTitle: string;
  workoutSubtitle: string;
  onBack: () => void;
  protocolContent: React.ReactNode;
  workoutContent: React.ReactNode;
}

const IntervalTimerSetupModal: React.FC<IntervalTimerSetupModalProps> = ({
  isOpen,
  onClose,
  step,
  protocolTitle,
  protocolSubtitle,
  workoutTitle,
  workoutSubtitle,
  onBack,
  protocolContent,
  workoutContent,
}) => {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) dialogRef.current?.focus();
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const title = step === 'protocol' ? protocolTitle : workoutTitle;
  const subtitle = step === 'protocol' ? protocolSubtitle : workoutSubtitle;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden bg-transparent p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? descId : undefined}
        tabIndex={-1}
        className="animate-zoom-in relative flex max-h-[calc(100vh-2rem)] w-full max-w-2xl shrink-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0d0500] shadow-2xl duration-200"
      >
        <div className="relative shrink-0 border-b border-white/10 p-6 text-center">
          <h3 id={titleId} className="font-display text-xl font-bold text-white">
            {title}
          </h3>
          <p id={descId} className="mt-1 text-sm text-white/70">
            {subtitle}
          </p>
          {step === 'workout' && (
            <button
              type="button"
              onClick={onBack}
              className="absolute left-6 top-1/2 -translate-y-1/2 text-sm text-white/70 hover:text-[#ffbf00]"
            >
              ← Back
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {step === 'protocol' ? protocolContent : workoutContent}
        </div>
        <div className="shrink-0 border-t border-white/10 bg-black/20 p-4 text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-bold text-white/60 hover:text-[#ffbf00]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default IntervalTimerSetupModal;
