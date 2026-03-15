/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ExternalLink, Zap, X } from 'lucide-react';
import type { Exercise } from '@/types';
import VideoPlayer from './VideoPlayer';
import { formatParagraphContent } from '@/lib/sanitize-paragraph-html';
import { normalizeListItems } from '@/lib/parse-biomechanics';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

export interface ExtendedBiomechanics {
  biomechanicalChain?: string;
  pivotPoints?: string;
  stabilizationNeeds?: string;
  commonMistakes?: string[];
}

interface ExerciseDetailModalProps {
  exercise: Exercise | null;
  onClose: () => void;
  extendedBiomechanics?: ExtendedBiomechanics | null;
  /** When set, show a "View full page" link to the canonical indexable exercise page. */
  exerciseSlug?: string | null;
}

const ExerciseDetailModal: React.FC<ExerciseDetailModalProps> = ({
  exercise,
  onClose,
  extendedBiomechanics,
  exerciseSlug,
}) => {
  const reduceMotion = useReducedMotion();
  const [showAdditionalTacticalData, setShowAdditionalTacticalData] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const tacticalDialogRef = useRef<HTMLDivElement>(null);
  const savedFocusRef = useRef<HTMLElement | null>(null);
  const savedTacticalFocusRef = useRef<HTMLElement | null>(null);

  function restoreMainFocus() {
    const el = savedFocusRef.current;
    if (el && typeof el.focus === 'function' && document.contains(el)) {
      el.focus();
    }
    savedFocusRef.current = null;
  }

  function closeMainModal() {
    restoreMainFocus();
    onClose();
  }

  function restoreTacticalFocus() {
    const el = savedTacticalFocusRef.current;
    if (el && typeof el.focus === 'function' && document.contains(el)) {
      el.focus();
    }
    savedTacticalFocusRef.current = null;
  }

  function closeTacticalModal() {
    restoreTacticalFocus();
    setShowAdditionalTacticalData(false);
  }

  // Main dialog: save focus on open, focus first focusable after paint
  useEffect(() => {
    if (!exercise) return;
    savedFocusRef.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const root = dialogRef.current;
      if (!root) return;
      const focusable = getFocusableElements(root);
      const first = focusable[0];
      if (first) first.focus();
    }, 100);
    return () => clearTimeout(t);
  }, [exercise]);

  // Main dialog: Tab trap
  useEffect(() => {
    if (!exercise) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
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
  }, [exercise]);

  // Main dialog: Escape (inner modal handles its own Escape and stopPropagation).
  // onClose in deps so the listener always invokes the current close handler (parent may pass new ref each render).
  useEffect(() => {
    if (!exercise) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      closeMainModal();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [exercise, onClose]);

  // Tactical modal: focus first focusable on open
  useEffect(() => {
    if (!showAdditionalTacticalData) return;
    const t = setTimeout(() => {
      const root = tacticalDialogRef.current;
      if (!root) return;
      const focusable = getFocusableElements(root);
      const first = focusable[0];
      if (first) first.focus();
    }, 100);
    return () => clearTimeout(t);
  }, [showAdditionalTacticalData]);

  // Tactical modal: Tab trap and Escape (capture phase + stopPropagation so main doesn't close)
  useEffect(() => {
    if (!showAdditionalTacticalData) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeTacticalModal();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = tacticalDialogRef.current;
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
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [showAdditionalTacticalData]);

  if (!exercise) return null;

  return (
    <AnimatePresence>
      {exercise && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/95 p-4 backdrop-blur-3xl md:p-10"
          onClick={closeMainModal}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="exercise-detail-title"
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            transition={reduceMotion ? { duration: 0 } : undefined}
            onClick={(e) => e.stopPropagation()}
            className="relative flex h-[90vh] max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2.5rem] border border-[#ffbf00]/30 bg-bg-dark shadow-[0_0_100px_rgba(255,191,0,0.1)] md:flex-row"
          >
            <button
              type="button"
              onClick={closeMainModal}
              className="absolute right-10 top-10 z-20 rounded-full border border-white/10 bg-black/50 p-5 text-white backdrop-blur-md transition-all hover:bg-white hover:text-black"
              aria-label="Close"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Static Image Column */}
            <div className="relative flex h-[40vh] w-full flex-col overflow-hidden bg-black md:h-auto md:w-1/2">
              <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black via-transparent to-black/40" />

              {/* Static Scrollable Stack */}
              <div className="custom-scrollbar flex h-full flex-col gap-4 overflow-y-auto p-4 md:p-6">
                {exercise.videoUrl && <VideoPlayer videoUrl={exercise.videoUrl} />}
                {exercise.images.map((img, i) => (
                  <div
                    key={i}
                    className="group/img aspect-video w-full shrink-0 overflow-hidden rounded-2xl border border-white/10 md:aspect-auto md:h-80"
                  >
                    <img
                      src={img}
                      alt={`${exercise.name} - Image ${i + 1}`}
                      width={640}
                      height={360}
                      loading="lazy"
                      className="h-full w-full object-cover brightness-75 grayscale transition-all duration-700 group-hover/img:brightness-100 group-hover/img:grayscale-0"
                    />
                  </div>
                ))}
              </div>

              <div className="pointer-events-none absolute bottom-6 left-6 z-20">
                <div className="mb-2 rounded bg-[#ffbf00] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-black">
                  Tactical Recon
                </div>
                <h2
                  id="exercise-detail-title"
                  className="font-heading text-3xl font-black uppercase tracking-tighter text-white drop-shadow-lg md:text-5xl"
                >
                  {exercise.name}
                </h2>
              </div>
            </div>

            {/* Instructions — min-h-0 lets flex child shrink so overflow-y-auto scrolls; no justify-center so content starts at top */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-8 md:p-12">
              <div className="mb-8 flex shrink-0 items-center gap-3 text-[#ffbf00]">
                <Zap className="h-5 w-5 shrink-0 animate-pulse" aria-hidden />
                <h3 className="m-0 font-mono text-[10px] uppercase tracking-[0.4em]">
                  Deployment Steps
                </h3>
              </div>

              <ul className="space-y-6">
                {exercise.instructions.length === 0 ? (
                  <p className="text-sm text-white/50">No deployment steps available.</p>
                ) : (
                  exercise.instructions.map((step, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={
                        reduceMotion ? { duration: 0, delay: 0 } : { delay: i * 0.1 + 0.3 }
                      }
                      className="group flex items-start gap-6"
                    >
                      <span className="font-mono text-lg font-bold text-[#ffbf00] opacity-40 transition-opacity group-hover:opacity-100">
                        {(i + 1)
                          .toString()
                          .padStart(exercise.instructions.length.toString().length, '0')}
                      </span>
                      <div
                        className="text-sm font-light uppercase leading-relaxed tracking-wider text-gray-300 transition-colors group-hover:text-white md:text-base [&_p:last-child]:mb-0 [&_p]:mb-2"
                        dangerouslySetInnerHTML={{ __html: formatParagraphContent(step) }}
                      />
                    </motion.li>
                  ))
                )}
              </ul>

              <div className="mt-12 space-y-4">
                <button
                  type="button"
                  onClick={() => {
                    savedTacticalFocusRef.current = document.activeElement as HTMLElement | null;
                    setShowAdditionalTacticalData(true);
                  }}
                  className="w-full rounded-xl border border-white/10 py-4 font-mono text-[10px] uppercase tracking-widest text-white/40 transition-all hover:border-white hover:bg-white hover:text-black"
                >
                  Additional Tactical Data
                </button>
                {exerciseSlug && (
                  <a
                    href={`/exercises/${exerciseSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-4 font-mono text-[10px] uppercase tracking-widest text-white/40 transition-all hover:border-white hover:bg-white hover:text-black"
                    aria-label={`View full page for ${exercise.name}`}
                    title={`View full page: ${exercise.name} at /exercises/${exerciseSlug}`}
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    View full page
                  </a>
                )}
              </div>
            </div>
          </motion.div>

          {/* Additional Tactical Data modal (stacked above exercise detail) */}
          <AnimatePresence>
            {showAdditionalTacticalData && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm md:p-10"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTacticalModal();
                }}
              >
                <motion.div
                  ref={tacticalDialogRef}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="tactical-dialog-title"
                  initial={{ scale: 0.95, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.95, y: 20 }}
                  transition={reduceMotion ? { duration: 0 } : undefined}
                  onClick={(e) => e.stopPropagation()}
                  className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#ffbf00]/30 bg-bg-dark shadow-[0_0_60px_rgba(255,191,0,0.1)]"
                >
                  <button
                    type="button"
                    onClick={closeTacticalModal}
                    className="absolute right-6 top-6 z-10 rounded-full border border-white/10 bg-black/50 p-3 text-white backdrop-blur-md transition-all hover:bg-white hover:text-black"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>

                  <div className="border-b border-white/10 px-6 py-5">
                    <h3
                      id="tactical-dialog-title"
                      className="font-heading text-xl font-bold uppercase tracking-tight text-white"
                    >
                      Additional Tactical Data
                    </h3>
                  </div>

                  <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-6">
                    <div className="space-y-6">
                      {extendedBiomechanics &&
                      (extendedBiomechanics.biomechanicalChain ||
                        extendedBiomechanics.pivotPoints ||
                        extendedBiomechanics.stabilizationNeeds ||
                        (extendedBiomechanics.commonMistakes &&
                          extendedBiomechanics.commonMistakes.length > 0)) ? (
                        <>
                          {extendedBiomechanics.biomechanicalChain && (
                            <section>
                              <h4 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ffbf00]">
                                Biomechanical Chain
                              </h4>
                              <div
                                className="text-sm leading-relaxed text-gray-300 [&_p:last-child]:mb-0 [&_p]:mb-2"
                                dangerouslySetInnerHTML={{
                                  __html: formatParagraphContent(
                                    extendedBiomechanics.biomechanicalChain
                                  ),
                                }}
                              />
                            </section>
                          )}
                          {extendedBiomechanics.pivotPoints && (
                            <section>
                              <h4 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ffbf00]">
                                Pivot Points
                              </h4>
                              <div
                                className="text-sm leading-relaxed text-gray-300 [&_p:last-child]:mb-0 [&_p]:mb-2"
                                dangerouslySetInnerHTML={{
                                  __html: formatParagraphContent(extendedBiomechanics.pivotPoints),
                                }}
                              />
                            </section>
                          )}
                          {extendedBiomechanics.stabilizationNeeds && (
                            <section>
                              <h4 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ffbf00]">
                                Stabilization Needs
                              </h4>
                              <div
                                className="text-sm leading-relaxed text-gray-300 [&_p:last-child]:mb-0 [&_p]:mb-2"
                                dangerouslySetInnerHTML={{
                                  __html: formatParagraphContent(
                                    extendedBiomechanics.stabilizationNeeds
                                  ),
                                }}
                              />
                            </section>
                          )}
                          {extendedBiomechanics.commonMistakes &&
                            extendedBiomechanics.commonMistakes.length > 0 && (
                              <section>
                                <h4 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ffbf00]">
                                  Common Mistakes
                                </h4>
                                <ul className="space-y-4">
                                  {(() => {
                                    const items = normalizeListItems(
                                      extendedBiomechanics.commonMistakes ?? []
                                    );
                                    return items.map((item, idx) => (
                                      <li key={idx} className="flex items-start gap-6">
                                        <span className="font-mono text-lg font-bold text-[#ffbf00] opacity-80">
                                          {(idx + 1)
                                            .toString()
                                            .padStart(items.length.toString().length, '0')}
                                        </span>
                                        <div
                                          className="text-sm leading-relaxed text-gray-300 [&_p:last-child]:mb-0 [&_p]:mb-0"
                                          dangerouslySetInnerHTML={{
                                            __html: formatParagraphContent(item),
                                          }}
                                        />
                                      </li>
                                    ));
                                  })()}
                                </ul>
                              </section>
                            )}
                        </>
                      ) : (
                        <p className="text-sm leading-relaxed text-white/50">
                          No additional tactical data available for this exercise.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-white/10 p-4">
                    <button
                      type="button"
                      onClick={closeTacticalModal}
                      className="w-full rounded-xl border border-white/10 py-3 font-mono text-[10px] uppercase tracking-widest text-white/60 transition-all hover:bg-white hover:text-black"
                    >
                      Close
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ExerciseDetailModal;
