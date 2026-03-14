/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Exercise Preview Modal: displays details of an auto-matched published exercise.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ImageOff } from 'lucide-react';
import type { GeneratedExercise } from '@/types/generated-exercise';
import { normalizeListItems } from '@/lib/parse-biomechanics';
import { formatParagraphContent } from '@/lib/sanitize-paragraph-html';

interface ExercisePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The published exercise to preview. */
  exercise: GeneratedExercise;
}

const ExercisePreviewModal: React.FC<ExercisePreviewModalProps> = ({
  isOpen,
  onClose,
  exercise,
}) => {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4 backdrop-blur-3xl"
        onClick={handleBackdropClick}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="relative flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-bg-dark shadow-[0_0_100px_rgba(59,130,246,0.1)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20">
                <span className="text-sm font-bold text-blue-400">M</span>
              </div>
              <div>
                <h2 className="font-heading text-lg font-bold text-white">Matched Exercise</h2>
                <p className="text-xs text-white/50">Auto-detected from published exercises</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Exercise Image */}
            <div className="relative aspect-video w-full overflow-hidden bg-black/40">
              {exercise.imageUrl ? (
                <img
                  src={exercise.imageUrl}
                  alt={exercise.exerciseName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <ImageOff className="h-12 w-12 text-white/20" />
                </div>
              )}
            </div>

            {/* Exercise Details */}
            <div className="p-6">
              {/* Name and badges */}
              <div className="mb-4">
                <h3 className="font-heading text-xl font-bold text-white">
                  {exercise.exerciseName}
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {exercise.complexityLevel && (
                    <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-medium capitalize text-blue-400">
                      {exercise.complexityLevel}
                    </span>
                  )}
                  {exercise.kineticChainType && (
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">
                      {exercise.kineticChainType}
                    </span>
                  )}
                </div>
              </div>

              {/* Performance Cues / Instructions */}
              {exercise.biomechanics?.performanceCues &&
                exercise.biomechanics.performanceCues.length > 0 && (
                  <div className="mb-4">
                    <h4 className="mb-2 text-sm font-medium text-white/80">Performance Cues</h4>
                    <ul className="space-y-2">
                      {(() => {
                        const items = normalizeListItems(
                          exercise.biomechanics!.performanceCues ?? []
                        );
                        return items.map((cue, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-white/70">
                            <span className="font-mono text-xs font-bold text-blue-400 opacity-80">
                              {(i + 1).toString().padStart(items.length.toString().length, '0')}
                            </span>
                            <span>{cue}</span>
                          </li>
                        ));
                      })()}
                    </ul>
                  </div>
                )}

              {/* Common Mistakes */}
              {exercise.biomechanics?.commonMistakes &&
                exercise.biomechanics.commonMistakes.length > 0 && (
                  <div className="mb-4">
                    <h4 className="mb-2 text-sm font-medium text-white/80">Common Mistakes</h4>
                    <ul className="space-y-2">
                      {(() => {
                        const items = normalizeListItems(
                          exercise.biomechanics!.commonMistakes ?? []
                        );
                        return items.map((mistake, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-white/70">
                            <span className="font-mono text-xs font-bold text-[#ffbf00] opacity-80">
                              {(i + 1).toString().padStart(items.length.toString().length, '0')}
                            </span>
                            <span>{mistake}</span>
                          </li>
                        ));
                      })()}
                    </ul>
                  </div>
                )}

              {/* Biomechanical Chain */}
              {exercise.biomechanics?.biomechanicalChain && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <h4 className="mb-2 text-sm font-medium text-white/80">Biomechanical Chain</h4>
                  <div
                    className="text-sm text-white/60 [&_p:last-child]:mb-0 [&_p]:mb-0"
                    dangerouslySetInnerHTML={{
                      __html: formatParagraphContent(exercise.biomechanics.biomechanicalChain),
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-white/10 p-4">
            <p className="text-xs text-white/40">
              This exercise was auto-matched by name. Use Swap to change it.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-400"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ExercisePreviewModal;
