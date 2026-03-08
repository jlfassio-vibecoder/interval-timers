/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Conversion modal: highlights three AI features and drives upgrade ($6/mo).
 * Opened from AI Optimizer teaser, progress ghost state, saved programs lock, or banner.
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, Zap, Scale, BarChart3, Scan } from 'lucide-react';

export type ConversionModalSource = 'ai_optimizer' | 'progress_chart' | 'saved_programs' | 'banner';

export interface ConversionModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional source for analytics. */
  source?: ConversionModalSource;
  /** When provided, primary CTA can trigger auth (e.g. show auth modal) if user not logged in. */
  onUpgrade?: () => void;
}

const FEATURES = [
  {
    icon: Scale,
    title: 'Weight Autoregulation',
    description: 'Dynamically adjust loads based on fatigue and recovery.',
  },
  {
    icon: BarChart3,
    title: 'Volume Optimization',
    description: 'Smart volume and progression tailored to your response.',
  },
  {
    icon: Scan,
    title: 'Form Analysis',
    description: 'AI-powered form cues and injury-aware recommendations.',
  },
];

const ConversionModal: React.FC<ConversionModalProps> = ({
  isOpen,
  onClose,
  source: _source,
  onUpgrade,
}) => {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] flex cursor-auto items-center justify-center bg-black/95 p-4 backdrop-blur-3xl"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={reduceMotion ? { duration: 0 } : undefined}
            className="relative w-full max-w-xl overflow-hidden rounded-[3rem] border border-white/10 bg-bg-dark p-8 shadow-[0_50px_100px_rgba(0,0,0,0.8)] md:p-10"
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

            <div className="mb-8 text-center">
              <Zap className="mx-auto mb-4 h-12 w-12 text-orange-light" />
              <h3 className="mb-2 font-heading text-2xl font-black uppercase tracking-tighter text-white md:text-3xl">
                Unlock AI Optimization
              </h3>
              <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-orange-light">
                Save client data and get smarter program recommendations.
              </p>
            </div>

            <ul className="mb-10 space-y-6">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <li key={title} className="flex items-start gap-4">
                  <div className="border-orange-light/20 bg-orange-light/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
                    <Icon className="h-5 w-5 text-orange-light" />
                  </div>
                  <div>
                    <h4 className="font-heading text-sm font-black uppercase tracking-tighter text-white">
                      {title}
                    </h4>
                    <p className="mt-1 text-sm font-light italic text-gray-300">{description}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-4">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  onUpgrade?.();
                  onClose();
                }}
                className="w-full rounded-2xl bg-orange-light py-6 font-heading font-black uppercase tracking-[0.3em] text-black shadow-[0_20px_40px_rgba(255,191,0,0.15)] transition-colors hover:bg-orange-medium"
              >
                Upgrade — $6/mo
              </motion.button>
              <button
                type="button"
                onClick={onClose}
                className="font-mono text-[10px] uppercase tracking-widest text-white/50 transition-colors hover:text-white/80"
              >
                Maybe later
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ConversionModal;
