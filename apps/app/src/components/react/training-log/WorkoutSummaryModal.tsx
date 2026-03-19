/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Modal showing workout log detail: name, date, duration, effort, rating, notes.
 */

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { WorkoutLog } from '@/types';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

export interface WorkoutSummaryModalProps {
  workout: WorkoutLog | null;
  onClose: () => void;
}

const WorkoutSummaryModal: React.FC<WorkoutSummaryModalProps> = ({ workout, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const savedFocusRef = useRef<HTMLElement | null>(null);
  const isMobile = useMediaQuery('(max-width: 640px)');

  function restoreFocus() {
    const el = savedFocusRef.current;
    if (el && typeof el.focus === 'function' && document.contains(el)) {
      el.focus();
    }
    savedFocusRef.current = null;
  }

  function handleClose() {
    restoreFocus();
    onClose();
  }

  useEffect(() => {
    if (!workout) return;
    savedFocusRef.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const root = modalRef.current;
      if (!root) return;
      const focusable = getFocusableElements(root);
      const first = focusable[0];
      if (first) first.focus();
    }, 100);
    return () => clearTimeout(t);
  }, [workout]);

  useEffect(() => {
    if (!workout) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = modalRef.current;
      if (!root) return;
      const focusable = getFocusableElements(root);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [workout, onClose]);

  if (!workout) return null;

  const durationMin = Math.round((workout.durationSeconds ?? 0) / 60);
  const displayFormat =
    workout.workoutFormat ??
    (() => {
      const s = (workout.source ?? '').toLowerCase();
      if (s.includes('tabata')) return 'Tabata';
      if (s.includes('amrap')) return 'AMRAP';
      if (s.includes('emom')) return 'EMOM';
      if (s.includes('warmup') || s.includes('warm-up')) return 'Mobility';
      if (s.includes('hiit')) return 'HIIT';
      if (s.includes('circuit')) return 'Circuit';
      return null;
    })();
  const formattedDate = workout.date
    ? new Date(workout.date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 ${
        isMobile ? 'p-0' : 'p-4'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="workout-modal-title"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        ref={modalRef}
        className={`w-full overflow-y-auto border border-white/10 bg-black/95 shadow-2xl backdrop-blur-sm ${
          isMobile ? 'h-screen max-h-screen rounded-none' : 'max-h-[90vh] max-w-2xl rounded-2xl'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 id="workout-modal-title" className="text-lg font-bold text-white">
            Workout Summary
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-6 p-6">
          <div className="text-center">
            <h3 className="mb-1 text-xl font-semibold text-white">{workout.workoutName}</h3>
            <div className="flex flex-wrap justify-center gap-2">
              {workout.workoutType && (
                <span className="rounded-md bg-white/10 px-2 py-1 text-sm text-white/90">
                  {workout.workoutType}
                </span>
              )}
              {displayFormat && (
                <span className="rounded-md bg-white/10 px-2 py-1 text-sm text-white/90">
                  {displayFormat}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
            {durationMin > 0 && (
              <div className="text-white/90">
                <strong className="text-white">Duration:</strong> {durationMin} min
              </div>
            )}
            <div className="text-white/90">
              <strong className="text-white">Date:</strong> {formattedDate}
            </div>
            {workout.effort != null && (
              <div className="text-white/90">
                <strong className="text-white">Effort:</strong> {workout.effort}/10
              </div>
            )}
            {workout.rating != null && (
              <div className="text-white/90">
                <strong className="text-white">Rating:</strong> {workout.rating}/5
              </div>
            )}
            {workout.intensity && (
              <div className="text-white/90">
                <strong className="text-white">Intensity:</strong> {workout.intensity}
              </div>
            )}
            {workout.focusArea && (
              <div className="text-white/90">
                <strong className="text-white">Focus:</strong> {workout.focusArea}
              </div>
            )}
          </div>

          {workout.notes && workout.notes.trim() && (
            <div className="border-orange-light/20 bg-orange-light/5 rounded-xl border p-4">
              <div className="mb-1 font-mono text-xs font-bold uppercase text-orange-light">
                Your Notes
              </div>
              <div className="text-sm text-white/90">{workout.notes}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-white/10 bg-black/95 px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="min-h-[44px] rounded-lg border border-white/20 bg-white/5 px-5 py-2 font-medium text-white transition-colors hover:bg-white/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkoutSummaryModal;
