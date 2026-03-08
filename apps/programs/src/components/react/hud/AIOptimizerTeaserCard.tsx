/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AI Optimizer section for workout cards. Free: blur-to-reveal + CTA opening Conversion Modal.
 * Paid: placeholder content (weight autoregulation, volume, form analysis available).
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export interface AIOptimizerTeaserCardProps {
  isPaid: boolean;
  onOpenConversionModal: () => void;
  workoutName?: string;
}

/** Fake chart-like bars for blurred preview. */
function BlurPreviewContent() {
  return (
    <div className="flex h-24 items-end justify-between gap-2 px-1">
      {[40, 65, 55, 80, 70, 90, 75].map((h, i) => (
        <div
          key={i}
          className="w-full min-w-0 flex-1 rounded-t bg-white/20"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

const AIOptimizerTeaserCard: React.FC<AIOptimizerTeaserCardProps> = ({
  isPaid,
  onOpenConversionModal,
  workoutName,
}) => {
  return (
    <div className="bg-orange-light/10 rounded-3xl border border-white/10 p-6 backdrop-blur-sm">
      <h4 className="border-orange-light/20 mb-4 border-b pb-4 font-mono text-[10px] uppercase tracking-[0.4em] text-orange-light">
        AI Optimizer
      </h4>

      {isPaid ? (
        <p className="text-sm font-light italic text-gray-300">
          Weight autoregulation, volume tips, and form analysis available for your clients on
          {workoutName ? ` ${workoutName}` : ' this workout'}.
        </p>
      ) : (
        <div className="relative">
          {/* Blurred preview content */}
          <div className="pointer-events-none select-none blur-md" aria-hidden>
            <div className="text-orange-light/80 mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="font-mono text-[10px] uppercase">Load · Volume · Form</span>
            </div>
            <BlurPreviewContent />
            <p className="mt-2 font-mono text-[10px] uppercase text-white/40">
              Strength curve · Recommendations
            </p>
          </div>
          {/* Gradient overlay for depth */}
          <div
            className="from-bg-dark/90 via-bg-dark/40 pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-t to-transparent"
            aria-hidden
          />
          {/* CTA overlay */}
          <div className="relative mt-4 flex flex-col items-center gap-3">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onOpenConversionModal}
              className="border-orange-light/30 w-full rounded-2xl border bg-orange-light py-4 font-heading text-sm font-black uppercase tracking-[0.3em] text-black shadow-[0_20px_40px_rgba(255,191,0,0.15)] transition-colors hover:border-orange-medium hover:bg-orange-medium"
            >
              Unlock AI Optimizer
            </motion.button>
            <p className="font-mono text-[10px] uppercase text-white/50">
              Weight autoregulation · Volume · Form analysis
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIOptimizerTeaserCard;
