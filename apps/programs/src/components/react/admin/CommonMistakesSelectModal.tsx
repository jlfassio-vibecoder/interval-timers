/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Modal for selecting an exercise to pull commonMistakes from.
 * Displays search candidates; on select, calls onSelect with the chosen exercise.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCw } from 'lucide-react';
import type { CommonMistakesCandidate } from '@/lib/supabase/client/generated-exercises';

interface CommonMistakesSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Search results: exercises with commonMistakes to choose from */
  candidates: CommonMistakesCandidate[];
  /** Called when admin selects an exercise */
  onSelect: (candidate: CommonMistakesCandidate) => void;
  /** Optional: re-run search with same query (e.g. after data refresh) */
  onSearchAgain?: () => void;
  isSearchingAgain?: boolean;
}

const CommonMistakesSelectModal: React.FC<CommonMistakesSelectModalProps> = ({
  isOpen,
  onClose,
  candidates,
  onSelect,
  onSearchAgain,
  isSearchingAgain = false,
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
          className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-bg-dark shadow-[0_0_100px_rgba(255,191,0,0.1)]"
        >
          <div className="flex items-center justify-between border-b border-white/10 p-6">
            <h2 className="font-heading text-xl font-bold text-white">
              Select exercise to pull commonMistakes from
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {candidates.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/60">No matches</p>
            ) : (
              <ul className="space-y-2">
                {candidates.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(c)}
                      className="flex w-full flex-col rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-left transition-colors hover:border-amber-500/50 hover:bg-amber-500/10"
                    >
                      <span className="font-medium text-white">{c.exerciseName}</span>
                      {c.slug && (
                        <span className="mt-1 font-mono text-xs text-white/50">{c.slug}</span>
                      )}
                      <span className="mt-1 text-xs text-white/40">
                        {c.commonMistakes.length} mistake{c.commonMistakes.length !== 1 ? 's' : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-white/10 p-4">
            {onSearchAgain && (
              <button
                type="button"
                onClick={onSearchAgain}
                disabled={isSearchingAgain}
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                {isSearchingAgain ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                    Searching…
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Search again
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CommonMistakesSelectModal;
