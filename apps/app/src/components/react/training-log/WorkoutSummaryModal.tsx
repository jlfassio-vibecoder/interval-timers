/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Modal showing workout log detail: name, date, duration, effort, rating, notes.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import type { WorkoutLog } from '@/types';
import { getWorkoutMetSessionData, type ProfileBaseline } from '@/lib/met';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAppContext } from '@/contexts/AppContext';
import { buildPhysiologicalCalibration } from '@/lib/calculations';
import { computeGoalAlignment, ALIGNMENT_SCORER_VERSION } from '@/lib/fitness-goal-alignment';
import {
  labelForFitnessGoalId,
  normalizeFitnessGoalRanking,
  type FitnessGoalId,
} from '@/lib/fitness-goal-taxonomy';
import { getProfileHealthSummary } from '@/lib/profile-health-taxonomy';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

export interface WorkoutSummaryModalProps {
  workout: WorkoutLog | null;
  onClose: () => void;
  profileBaseline: ProfileBaseline | null;
}

const WorkoutSummaryModal: React.FC<WorkoutSummaryModalProps> = ({
  workout,
  onClose,
  profileBaseline,
}) => {
  const { user } = useAppContext();
  const healthSummary = getProfileHealthSummary(user);
  const modalRef = useRef<HTMLDivElement>(null);
  const savedFocusRef = useRef<HTMLElement | null>(null);
  const isMobile = useMediaQuery('(max-width: 640px)');

  const metSessionData = useMemo(
    () => (workout ? getWorkoutMetSessionData(workout, profileBaseline) : null),
    [workout, profileBaseline]
  );

  const orderedSnapshotGoals = useMemo((): FitnessGoalId[] => {
    if (!workout?.goalSnapshot?.length) return [];
    return normalizeFitnessGoalRanking(workout.goalSnapshot);
  }, [workout?.goalSnapshot]);

  const physiologicalCalibration = useMemo(
    () =>
      buildPhysiologicalCalibration({
        dateOfBirth: user?.dateOfBirth ?? null,
        manualMaxHrBpm: user?.maxHrBpm ?? null,
        restingHrBpm: user?.restingHrBpm ?? null,
      }),
    [user?.dateOfBirth, user?.maxHrBpm, user?.restingHrBpm]
  );

  const goalAlignment = useMemo(
    () =>
      workout
        ? computeGoalAlignment(workout, workout.goalSnapshot ?? null, physiologicalCalibration)
        : null,
    [workout, physiologicalCalibration]
  );

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
      data-met-baseline={metSessionData ? '1' : '0'}
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

          {goalAlignment && orderedSnapshotGoals.length > 0 ? (
            <section
              className="rounded-xl border border-white/10 bg-white/5 p-4"
              aria-labelledby="workout-goal-fit-heading"
            >
              <h4
                id="workout-goal-fit-heading"
                className="mb-1 text-sm font-semibold text-white/90"
              >
                Goal fit (estimate)
              </h4>
              <p className="mb-4 text-xs leading-relaxed text-white/50">
                Heuristic match to the goals stored with this session—not medical advice. Numbers
                may change when the model updates (v{ALIGNMENT_SCORER_VERSION}).
              </p>
              <div className="mb-4 flex items-center justify-between gap-3 text-sm">
                <span className="text-white/70">Overall alignment</span>
                <span className="font-semibold tabular-nums text-white" aria-live="polite">
                  {goalAlignment.composite}%
                </span>
              </div>
              <div
                className="mb-5 h-2 w-full overflow-hidden rounded-full bg-white/15"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={goalAlignment.composite}
                aria-label={`Overall goal alignment ${goalAlignment.composite} percent`}
              >
                <div
                  className="h-full max-w-full rounded-full"
                  style={{
                    width: `${goalAlignment.composite}%`,
                    // Solid var: Tailwind `bg-accent/85` does not apply when `accent` is a hex CSS variable.
                    backgroundColor: 'var(--color-accent)',
                  }}
                />
              </div>
              <ul className="space-y-4">
                {orderedSnapshotGoals.map((goalId, index) => {
                  const value = goalAlignment.byGoalId[goalId] ?? 0;
                  const rank = index + 1;
                  const label = labelForFitnessGoalId(goalId);
                  return (
                    <li key={goalId}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                        <span className="text-white/80">
                          <span className="sr-only">Priority {rank}. </span>
                          {label}
                        </span>
                        <span className="tabular-nums text-white/90">{value}%</span>
                      </div>
                      <div
                        className="h-2 w-full overflow-hidden rounded-full bg-white/15"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={value}
                        aria-label={`${label}, priority ${rank}, ${value} percent match`}
                      >
                        <div
                          className="h-full max-w-full rounded-full opacity-90"
                          style={{
                            width: `${value}%`,
                            backgroundColor: 'var(--color-accent)',
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : (
            <p className="text-center text-xs text-white/45">
              No goal snapshot for this session—older logs, or no ranked goals on your profile when
              it was saved.
            </p>
          )}

          {healthSummary.showHealthReminder && (
            <p className="text-center text-xs text-white/50">
              Reminder: adjust intensity and exercise choices to match the health filters on your
              profile.
            </p>
          )}

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
