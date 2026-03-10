/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Modal to set or change program start date for the native app calendar.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, Calendar } from 'lucide-react';

export interface SyncToCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  programId: string;
  programName: string;
  /** Current start date if already synced (ISO YYYY-MM-DD). */
  currentStartDate?: string | null;
  onSave: (startDate: string) => void;
  onRemove?: () => void;
  saving?: boolean;
}

function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

const SyncToCalendarModal: React.FC<SyncToCalendarModalProps> = ({
  isOpen,
  onClose,
  programId: _programId,
  programName,
  currentStartDate,
  onSave,
  onRemove,
  saving = false,
}) => {
  const reduceMotion = useReducedMotion();
  const [startDate, setStartDate] = useState(todayISO());

  useEffect(() => {
    if (isOpen) {
      setStartDate(currentStartDate ?? todayISO());
    }
  }, [isOpen, currentStartDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(startDate);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[140] flex cursor-auto items-center justify-center bg-black/95 p-4 backdrop-blur-3xl"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          transition={reduceMotion ? { duration: 0 } : undefined}
          className="relative w-full max-w-md overflow-hidden rounded-[3rem] border border-white/10 bg-bg-dark p-8 shadow-[0_50px_100px_rgba(0,0,0,0.8)]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-6 top-6 rounded-full border border-white/10 bg-black/50 p-2 text-white backdrop-blur-md transition-all hover:bg-white hover:text-black"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mb-6 flex items-center gap-3 text-orange-light">
            <Calendar className="h-8 w-8" />
            <h3 className="font-heading text-xl font-black uppercase tracking-tighter text-white">
              Sync to Calendar
            </h3>
          </div>
          <p className="mb-4 text-gray-300">
            Set the start date for <strong className="text-white">{programName}</strong>. Workouts
            will appear on the app calendar from this date.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="sync-start-date"
                className="mb-2 block font-mono text-[10px] uppercase tracking-widest text-white/60"
              >
                Start date
              </label>
              <input
                id="sync-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="focus:border-orange-light/50 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition-colors"
                required
              />
            </div>
            <div className="flex flex-col gap-3">
              <motion.button
                type="submit"
                disabled={saving}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full rounded-2xl bg-orange-light py-4 font-heading font-black uppercase tracking-[0.3em] text-black shadow-[0_20px_40px_rgba(255,191,0,0.15)] transition-colors hover:bg-orange-medium disabled:opacity-50"
              >
                {saving ? 'Saving…' : currentStartDate ? 'Update date' : 'Add to calendar'}
              </motion.button>
              {currentStartDate && onRemove && (
                <button
                  type="button"
                  onClick={() => {
                    onRemove();
                    onClose();
                  }}
                  disabled={saving}
                  className="font-mono text-[10px] uppercase tracking-widest text-white/50 transition-colors hover:text-white/80 disabled:opacity-50"
                >
                  Remove from calendar
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="font-mono text-[10px] uppercase tracking-widest text-white/40"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SyncToCalendarModal;
