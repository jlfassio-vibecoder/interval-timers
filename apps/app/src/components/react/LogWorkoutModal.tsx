/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, TrendingUp } from 'lucide-react';
import type { Artist, WorkoutLog } from '@/types';

interface LogWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (log: Omit<WorkoutLog, 'id'>) => void;
  selectedArtist: Artist | null;
}

const LogWorkoutModal: React.FC<LogWorkoutModalProps> = ({
  isOpen,
  onClose,
  onSave,
  selectedArtist,
}) => {
  const [effortValue, setEffortValue] = useState(5);
  const [ratingValue, setRatingValue] = useState(0);
  const [notesValue, setNotesValue] = useState('');

  const handleSave = () => {
    if (!selectedArtist) return;

    onSave({
      userId: '', // Will be set by parent
      workoutId: selectedArtist.id,
      workoutName: selectedArtist.name,
      date: new Date().toLocaleDateString(),
      effort: effortValue,
      rating: ratingValue,
      notes: notesValue,
    });

    // Reset values
    setEffortValue(5);
    setRatingValue(0);
    setNotesValue('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/95 p-6 backdrop-blur-3xl"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="border-orange-light/30 relative w-full max-w-lg overflow-hidden rounded-[2.5rem] border bg-bg-dark p-8 shadow-[0_0_50px_rgba(255,191,0,0.1)] md:p-12"
          >
            <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-transparent via-orange-light to-transparent" />

            <div className="mb-10 flex items-center justify-between">
              <div>
                <h3 className="font-heading text-3xl font-black uppercase tracking-tighter text-white">
                  Mission Log
                </h3>
                <span className="font-mono text-[10px] uppercase tracking-widest text-orange-light">
                  Post-Operational Review
                </span>
              </div>
              <button
                onClick={onClose}
                className="rounded-full bg-white/5 p-3 transition-colors hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-10">
              <div>
                <div className="mb-4 flex items-end justify-between">
                  <label className="font-mono text-xs uppercase tracking-[0.2em] text-white/50">
                    Bio-Stress (Effort)
                  </label>
                  <span className="font-mono text-2xl font-black text-orange-light">
                    {effortValue}/10
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={effortValue}
                  onChange={(e) => setEffortValue(parseInt(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/5 accent-orange-light"
                />
              </div>

              <div>
                <label className="mb-6 block font-mono text-xs uppercase tracking-[0.2em] text-white/50">
                  System Output (Rating)
                </label>
                <div className="flex justify-center gap-6">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRatingValue(star)}
                      className="transition-all hover:scale-110 active:scale-90"
                    >
                      <Star
                        className={`h-12 w-12 transition-colors ${ratingValue >= star ? 'fill-orange-light text-orange-light' : 'text-white/5'}`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-3 block font-mono text-xs uppercase tracking-[0.2em] text-white/50">
                  Tactical Notes
                </label>
                <textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  placeholder="Log metabolic state, joint integrity, or engine feedback..."
                  className="focus:border-orange-light/50 h-32 w-full resize-none rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white placeholder-white/20 transition-all focus:outline-none"
                />
              </div>

              <button
                onClick={handleSave}
                className="group flex w-full items-center justify-center gap-4 rounded-2xl bg-orange-light py-6 font-black uppercase tracking-[0.3em] text-black shadow-[0_20px_40px_rgba(255,191,0,0.15)] transition-all hover:bg-white"
              >
                Record Protocol Data{' '}
                <TrendingUp className="h-5 w-5 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LogWorkoutModal;
